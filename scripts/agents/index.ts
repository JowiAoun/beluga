// Best Use of ElevenLabs: creates or updates beluga's two agents (triage and Ask) and their client
// tools from lib/server/agents/config.ts, so the agents' setup lives in the repo.
//
// Run `npm run agents`, then copy the printed ids into .env.local and Vercel.
// Run `npm run agents -- --check photo.jpg` for the Phase 5 image check: one triage turn on the
// photo, its answer and time, then the conversation deleted and checked gone.

import { readFileSync } from "node:fs";
import { AGENTS, triageNote, type AgentSpec } from "@/lib/server/agents/config";
import { deleteConversation, runAgentTurn } from "@/lib/server/agents/turn";

const API = "https://api.elevenlabs.io/v1";
const LONGEST_CONVERSATION_S = 30;
// Use the provider's supported default temperature.
const TEMPERATURE = 1;
// Server events the backend reads over the WebSocket.
const CLIENT_EVENTS = [
  "conversation_initiation_metadata",
  "ping",
  "agent_response",
  "agent_response_complete",
  "client_tool_call",
  "agent_tool_response",
  "client_error",
];

const key = process.env.ELEVENLABS_API_KEY ?? "";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function api<T>(route: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const response = await fetch(`${API}${route}`, {
    method: init.method ?? "GET",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: init.body && JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${route}: ${response.status} ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function checkModels(): Promise<void> {
  const { llms } = await api<{ llms?: Array<{ llm: string; supports_image_input?: boolean }> }>("/convai/llm/list");
  for (const agent of Object.values(AGENTS)) {
    const model = llms?.find((m) => m.llm === agent.llm);
    if (!model) fail(`${agent.llm} isn't in this account's model list. Pick another in lib/server/agents/config.ts.`);
    if (!model.supports_image_input) fail(`${agent.llm} can't see images. Pick another in lib/server/agents/config.ts.`);
    console.info(`${agent.name}: ${agent.llm} takes images`);
  }
}

function toolBody(agent: AgentSpec) {
  return {
    tool_config: {
      type: "client",
      name: agent.tool.name,
      description: agent.tool.description,
      expects_response: true,
      response_timeout_secs: 10,
      parameters: {
        type: "object",
        required: agent.tool.required,
        properties: Object.fromEntries(
          Object.entries(agent.tool.properties).map(([name, p]) => [
            name,
            { type: p.type, description: p.description, ...(p.enum ? { enum: [...p.enum] } : {}) },
          ]),
        ),
      },
    },
  };
}

async function upsertTool(agent: AgentSpec): Promise<string> {
  const { tools } = await api<{ tools?: Array<{ id: string; tool_config?: { name?: string } }> }>(
    `/convai/tools?search=${encodeURIComponent(agent.tool.name)}&types=client`,
  );
  const existing = tools?.find((t) => t.tool_config?.name === agent.tool.name);
  if (existing) {
    await api(`/convai/tools/${existing.id}`, { method: "PATCH", body: toolBody(agent) });
    return existing.id;
  }
  const { id } = await api<{ id: string }>("/convai/tools", { method: "POST", body: toolBody(agent) });
  return id;
}

function agentBody(agent: AgentSpec, toolId: string, zeroRetention: boolean) {
  return {
    name: agent.name,
    tags: ["beluga"],
    conversation_config: {
      agent: {
        // Empty, so the agent waits for the frame instead of speaking first.
        first_message: "",
        language: "en",
        prompt: { prompt: agent.prompt, llm: agent.llm, temperature: TEMPERATURE, tool_ids: [toolId] },
      },
      conversation: {
        text_only: true,
        max_duration_seconds: LONGEST_CONVERSATION_S,
        client_events: CLIENT_EVENTS,
        file_input: { enabled: true, max_files_in_memory: 1, max_files_per_conversation: 1 },
      },
    },
    platform_settings: {
      // Frames are in these conversations: keep as little as the account allows (rule 5).
      privacy: {
        record_voice: false,
        delete_audio: true,
        delete_transcript_and_pii: true,
        ...(zeroRetention ? { zero_retention_mode: true } : {}),
      },
      // Private agents: a conversation needs a signed URL from our backend.
      auth: { enable_auth: true },
    },
  };
}

async function upsertAgent(agent: AgentSpec, toolId: string): Promise<string> {
  const existingId = process.env[agent.idEnv];
  const send = (zeroRetention: boolean) =>
    existingId
      ? api(`/convai/agents/${existingId}`, { method: "PATCH", body: agentBody(agent, toolId, zeroRetention) }).then(
          () => existingId,
        )
      : api<{ agent_id: string }>("/convai/agents/create", {
          method: "POST",
          body: agentBody(agent, toolId, zeroRetention),
        }).then((r) => r.agent_id);
  try {
    return await send(true);
  } catch (err) {
    console.warn(`${agent.name}: Zero Retention Mode refused (${String(err).slice(0, 160)}). Trying without it.`);
    return send(false);
  }
}

async function check(photo: string): Promise<void> {
  const jpeg = readFileSync(photo);
  const began = Date.now();
  let conversationId: string | null = null;
  try {
    const { parameters } = await runAgentTurn({
      agent: AGENTS.triage,
      text: triageNote(
        { kind: "obstacle", distance: 1.8, angle: 0, heightBand: null, blocking: 0.5, detectorClass: "unknown" },
        null,
      ),
      jpeg,
      deadline: Date.now() + 20_000,
      onConversation: (id) => (conversationId = id),
    });
    console.info(`Answer in ${Date.now() - began} ms:`, JSON.stringify(parameters, null, 2));
  } finally {
    if (conversationId) {
      const deleted = await deleteConversation(conversationId);
      const gone = await fetch(`${API}/convai/conversations/${conversationId}`, { headers: { "xi-api-key": key } });
      console.info(`Conversation ${deleted ? "deleted" : "NOT deleted"}; reading it back gives ${gone.status}.`);
    }
  }
}

async function main(): Promise<void> {
  if (!key) fail("Set ELEVENLABS_API_KEY in .env.local first.");
  if (!key.startsWith("sk_")) {
    fail(
      "ELEVENLABS_API_KEY doesn't start with sk_: that looks like the key's ID. " +
        "Create a key in ElevenLabs (Developers, API keys) and paste the secret it shows once.",
    );
  }
  const photoAt = process.argv.indexOf("--check");
  if (photoAt !== -1) {
    const photo = process.argv[photoAt + 1];
    if (!photo) fail("Give a photo: npm run agents -- --check path/to/photo.jpg");
    await check(photo);
    return;
  }
  await checkModels();
  const lines: string[] = [];
  for (const agent of Object.values(AGENTS)) {
    const toolId = await upsertTool(agent);
    const agentId = await upsertAgent(agent, toolId);
    console.info(`${agent.name}: agent ${agentId}, tool ${agent.tool.name} ${toolId}`);
    lines.push(`${agent.idEnv}=${agentId}`);
  }
  console.info(`\nPut these in .env.local and in Vercel:\n${lines.join("\n")}`);
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
