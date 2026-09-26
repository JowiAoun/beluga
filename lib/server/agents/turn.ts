import "server-only";

// Best Use of ElevenLabs: one text-only turn with an agent over its WebSocket. The frame goes up
// as a file in the conversation, the agent sees it with Gemini and answers by calling its client
// tool, and the socket closes. The caller deletes the conversation afterwards (rule 5). Ask the
// data sends no frame; its agent calls lookup tools first, and the backend answers them with data.

import { env } from "../env";
import type { AgentSpec } from "./config";

const API = "https://api.elevenlabs.io/v1";
// The server takes a moment to register a new conversation. An upload sent the instant it says the
// conversation started comes back 404, "not found", or hangs 5 s and comes back 408, "not active".
// 400 ms later it mostly goes through; when it doesn't, it is sent again after a short wait.
const UPLOAD_WAIT_MS = 400;
const UPLOAD_RETRY_WAIT_MS = 300;
// An upload takes about a second. One stuck for longer is cut short and sent again.
const UPLOAD_ATTEMPT_MS = 3000;
const UPLOAD_ATTEMPTS = 3;
const NOT_READY = new Set([404, 408]);

export class AgentError extends Error {}

// The parts of a WebSocket this uses, so tests can hand in a fake one.
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "error" | "close", listener: (event: { data?: unknown }) => void): void;
}

export interface TurnDeps {
  fetch: typeof fetch;
  connect(url: string): SocketLike;
  now(): number;
  sleep(ms: number): Promise<void>;
}

const LIVE: TurnDeps = {
  fetch: (...args) => fetch(...args),
  // The same subprotocol the ElevenLabs client sends.
  connect: (url) => new WebSocket(url, ["convai"]) as unknown as SocketLike,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface AgentTurn {
  agent: AgentSpec;
  text: string;
  // The frame the agent sees. Without one the text goes alone.
  jpeg?: Uint8Array;
  // Answers the agent's lookup tools (AgentSpec.lookups). What it returns goes back as JSON.
  onLookup?: (tool: string, parameters: unknown) => Promise<unknown>;
  // Epoch milliseconds by which the answer must be in.
  deadline: number;
  // Called once the conversation exists, so the caller can delete it later whatever happens.
  onConversation?: (conversationId: string) => void;
}

export interface TurnResult {
  parameters: unknown;
  conversationId: string;
}

interface ServerEvent {
  type?: string;
  conversation_initiation_metadata_event?: { conversation_id?: string };
  ping_event?: { event_id?: number };
  client_tool_call?: { tool_name?: string; tool_call_id?: string; parameters?: unknown };
  error_event?: { message?: string; error_type?: string };
}

function timeLeft(deadline: number, deps: TurnDeps): number {
  return Math.max(1, deadline - deps.now());
}

async function uploadFrame(conversationId: string, jpeg: Uint8Array, key: string, deadline: number, deps: TurnDeps) {
  await deps.sleep(UPLOAD_WAIT_MS);
  for (let attempt = 1; ; attempt++) {
    if (attempt > 1) await deps.sleep(UPLOAD_RETRY_WAIT_MS);
    const last = attempt === UPLOAD_ATTEMPTS;
    const form = new FormData();
    form.append("file", new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }), "frame.jpg");
    const limit = last ? timeLeft(deadline, deps) : Math.min(UPLOAD_ATTEMPT_MS, timeLeft(deadline, deps));
    const response = await deps
      .fetch(`${API}/convai/conversations/${conversationId}/files`, {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
        signal: AbortSignal.timeout(limit),
      })
      .catch((err: unknown) => {
        if (last) throw new AgentError(`frame upload: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
    if (response?.ok) {
      const { file_id: fileId } = (await response.json()) as { file_id?: string };
      if (!fileId) throw new AgentError("frame upload: no file id");
      return fileId;
    }
    if (response && (last || !NOT_READY.has(response.status))) {
      const detail = await response.text().catch(() => "");
      throw new AgentError(`frame upload: ${response.status} ${detail.slice(0, 200)}`.trim());
    }
  }
}

export async function runAgentTurn(turn: AgentTurn, deps: TurnDeps = LIVE): Promise<TurnResult> {
  const { ELEVENLABS_API_KEY: key, [turn.agent.idEnv]: agentId } = env("ELEVENLABS_API_KEY", turn.agent.idEnv);
  const signed = await deps.fetch(`${API}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(timeLeft(turn.deadline, deps)),
  });
  if (!signed.ok) throw new AgentError(`signed url: ${signed.status}`);
  const { signed_url: url } = (await signed.json()) as { signed_url?: string };
  if (!url) throw new AgentError("signed url: none in the answer");

  const socket = deps.connect(url);
  try {
    return await new Promise<TurnResult>((resolve, reject) => {
      let conversationId: string | null = null;
      let settled = false;
      const timer = setTimeout(() => fail("timed out"), timeLeft(turn.deadline, deps));
      function fail(message: string) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new AgentError(message));
      }
      const send = (message: object) => socket.send(JSON.stringify(message));

      socket.addEventListener("open", () => send({ type: "conversation_initiation_client_data" }));
      socket.addEventListener("error", () => fail("socket error"));
      socket.addEventListener("close", () => fail("closed before an answer"));
      socket.addEventListener("message", (event) => {
        let message: ServerEvent;
        try {
          message = JSON.parse(String(event.data)) as ServerEvent;
        } catch {
          return;
        }
        switch (message.type) {
          case "conversation_initiation_metadata": {
            const id = message.conversation_initiation_metadata_event?.conversation_id;
            if (!id) return fail("no conversation id");
            conversationId = id;
            turn.onConversation?.(id);
            if (!turn.jpeg) return send({ type: "user_message", text: turn.text });
            uploadFrame(id, turn.jpeg, key, turn.deadline, deps).then(
              (fileId) =>
                // Both spellings, as the ElevenLabs client sends them: `file` alone is the older one.
                send({
                  type: "multimodal_message",
                  text: { type: "user_message", text: turn.text },
                  file: { type: "file_input", file_id: fileId },
                  files: [{ type: "file_input", file_id: fileId }],
                }),
              (err: unknown) => fail(err instanceof Error ? err.message : String(err)),
            );
            return;
          }
          case "ping":
            // Unanswered pings close the conversation.
            return send({ type: "pong", event_id: message.ping_event?.event_id });
          case "client_tool_call": {
            const call = message.client_tool_call;
            if (!call?.tool_call_id) return;
            const reply = (result: string, isError: boolean) => {
              if (!settled) send({ type: "client_tool_result", tool_call_id: call.tool_call_id, result, is_error: isError });
            };
            const { onLookup } = turn;
            if (onLookup && call.tool_name && turn.agent.lookups?.some((l) => l.name === call.tool_name)) {
              onLookup(call.tool_name, call.parameters).then(
                (result) => reply(JSON.stringify(result), false),
                (err: unknown) => reply(`lookup failed: ${err instanceof Error ? err.message : String(err)}`, true),
              );
              return;
            }
            const ours = call.tool_name === turn.agent.tool.name;
            send({
              type: "client_tool_result",
              tool_call_id: call.tool_call_id,
              result: ours ? "ok" : "unknown tool",
              is_error: !ours,
            });
            if (!ours || settled || !conversationId) return;
            settled = true;
            clearTimeout(timer);
            resolve({ parameters: call.parameters ?? {}, conversationId });
            return;
          }
          case "agent_response_complete":
            // The agent ended its turn in plain text, without the tool: retry or fail safe.
            return fail("answered without its tool");
          case "error":
          case "client_error":
            return fail(`agent error: ${message.error_event?.error_type ?? message.error_event?.message ?? "unknown"}`);
        }
      });
    });
  } finally {
    try {
      socket.close(1000, "done");
    } catch {
      // Already closed.
    }
  }
}

// Rule 5: the conversation holds the frame, so it goes as soon as the answer is in. ElevenLabs saves
// a conversation a few seconds after it ends ("processing", then "done"), and that save brings back
// one deleted before it. So the delete waits for "done", then checks the conversation stays gone.
const DELETE_POLL_MS = 1000;
const DELETE_WITHIN_MS = 20_000;
const FINISHED = new Set(["done", "failed"]);

type CleanupDeps = Pick<TurnDeps, "fetch" | "now" | "sleep">;

export async function deleteConversation(conversationId: string, deps: CleanupDeps = LIVE): Promise<boolean> {
  const { ELEVENLABS_API_KEY: key } = env("ELEVENLABS_API_KEY");
  const url = `${API}/convai/conversations/${conversationId}`;
  const headers = { "xi-api-key": key };
  const until = deps.now() + DELETE_WITHIN_MS;
  let deleted = false;
  while (deps.now() < until) {
    const got = await deps.fetch(url, { headers }).catch(() => null);
    if (got?.status === 404 && deleted) return true;
    const { status } = got?.ok ? ((await got.json().catch(() => ({}))) as { status?: string }) : {};
    if (status && FINISHED.has(status)) {
      const response = await deps.fetch(url, { method: "DELETE", headers }).catch(() => null);
      deleted = Boolean(response && (response.ok || response.status === 404));
      if (deleted) continue;
    }
    await deps.sleep(DELETE_POLL_MS);
  }
  // Out of time: delete anyway. The sweep and the agents' 1-day retention catch it if it comes back.
  await deps.fetch(url, { method: "DELETE", headers }).catch(() => null);
  console.error(JSON.stringify({ route: "agents", outcome: "delete_unconfirmed", conversationId }));
  return false;
}

// Deletes every finished conversation an agent still has: one left by a function that stopped
// before its delete, or one saved again after it. Returns how many went.
export async function sweepConversations(agent: AgentSpec, deps: CleanupDeps = LIVE): Promise<number> {
  const { ELEVENLABS_API_KEY: key, [agent.idEnv]: agentId } = env("ELEVENLABS_API_KEY", agent.idEnv);
  const headers = { "xi-api-key": key };
  const list = await deps
    .fetch(`${API}/convai/conversations?agent_id=${encodeURIComponent(agentId)}&page_size=100`, { headers })
    .catch(() => null);
  if (!list?.ok) return 0;
  const { conversations = [] } = (await list.json()) as {
    conversations?: Array<{ conversation_id: string; status?: string }>;
  };
  let swept = 0;
  for (const conversation of conversations) {
    if (!FINISHED.has(conversation.status ?? "")) continue;
    const response = await deps
      .fetch(`${API}/convai/conversations/${conversation.conversation_id}`, { method: "DELETE", headers })
      .catch(() => null);
    if (response && (response.ok || response.status === 404)) swept++;
  }
  return swept;
}
