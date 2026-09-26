import "server-only";

// Best Use of ElevenLabs: one text-only turn with an agent over its WebSocket. The frame goes up
// as a file in the conversation, the agent sees it and answers by calling its client
// tool, and the socket closes. The caller deletes the conversation afterwards (rule 5).

import { env } from "../env";
import type { AgentSpec } from "./config";

const API = "https://api.elevenlabs.io/v1";

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
}

const LIVE: TurnDeps = {
  fetch: (...args) => fetch(...args),
  // The same subprotocol the ElevenLabs client sends.
  connect: (url) => new WebSocket(url, ["convai"]) as unknown as SocketLike,
  now: () => Date.now(),
};

export interface AgentTurn {
  agent: AgentSpec;
  text: string;
  jpeg: Uint8Array;
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
  const form = new FormData();
  form.append("file", new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: "image/jpeg" }), "frame.jpg");
  const response = await deps.fetch(`${API}/convai/conversations/${conversationId}/files`, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
    signal: AbortSignal.timeout(timeLeft(deadline, deps)),
  });
  if (!response.ok) throw new AgentError(`frame upload: ${response.status}`);
  const { file_id: fileId } = (await response.json()) as { file_id?: string };
  if (!fileId) throw new AgentError("frame upload: no file id");
  return fileId;
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
            uploadFrame(id, turn.jpeg, key, turn.deadline, deps).then(
              (fileId) =>
                send({
                  type: "multimodal_message",
                  text: { type: "user_message", text: turn.text },
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

// Rule 5: the conversation holds the frame, so it goes as soon as the answer is in.
export async function deleteConversation(
  conversationId: string,
  deps: Pick<TurnDeps, "fetch"> = LIVE,
): Promise<boolean> {
  const { ELEVENLABS_API_KEY: key } = env("ELEVENLABS_API_KEY");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await deps
      .fetch(`${API}/convai/conversations/${conversationId}`, { method: "DELETE", headers: { "xi-api-key": key } })
      .catch(() => null);
    if (response && (response.ok || response.status === 404)) return true;
    // A conversation that just closed may still be processing.
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  console.error(JSON.stringify({ route: "agents", outcome: "delete_failed", conversationId }));
  return false;
}
