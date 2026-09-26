// Best Use of ElevenLabs: creates or updates beluga's three agents (triage, Ask and Ask the data)
// and their client tools from lib/server/agents/config.ts, so the agents' setup lives in the repo.
//
// Run `npm run agents`, then copy the printed ids into .env.local and Vercel.
// Run `npm run agents -- --check photo.jpg` for the Phase 5 image check: one triage turn on the
// photo, its answer and time, then the conversation deleted and checked gone.
// Run `npm run agents -- --sweep` to delete every finished conversation both agents still have.

import { readFileSync } from "node:fs";
import { AGENTS, triageNote, type AgentSpec, type ToolSpec } from "@/lib/server/agents/config";
import { deleteConversation, runAgentTurn, sweepConversations } from "@/lib/server/agents/turn";

const API = "https://api.elevenlabs.io/v1";
// The shortest the API allows. A turn takes a few seconds and the conversation is deleted after.
const LONGEST_CONVERSATION_S = 60;
// Anything the backend fails to delete goes after this many days.
const RETENTION_DAYS = 1;
// Google says Gemini 3 models can loop below 1.0; ElevenLabs agents default to 0.
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
    if (!agent.seesPhotos) {
      console.info(`${agent.name}: ${agent.llm}`);
      continue;
    }
    if (!model.supports_image_input) fail(`${agent.llm} can't see images. Pick another in lib/server/agents/config.ts.`);
    console.info(`${agent.name}: ${agent.llm} takes images`);
  }
}

function toolBody(tool: ToolSpec) {
  return {
    tool_config: {
      type: "client",
      name: tool.name,
      description: tool.description,
      expects_response: true,
      response_timeout_secs: 10,
      parameters: {
        type: "object",
        required: tool.required,
        properties: Object.fromEntries(
          Object.entries(tool.properties).map(([name, p]) => [
            name,
            { type: p.type, description: p.description, ...(p.enum ? { enum: [...p.enum] } : {}) },
          ]),
        ),
      },
    },
  };
}

async function upsertTool(tool: ToolSpec): Promise<string> {
  const { tools } = await api<{ tools?: Array<{ id: string; tool_config?: { name?: string } }> }>(
    `/convai/tools?search=${encodeURIComponent(tool.name)}&types=client`,
  );
  const existing = tools?.find((t) => t.tool_config?.name === tool.name);
  if (existing) {
    await api(`/convai/tools/${existing.id}`, { method: "PATCH", body: toolBody(tool) });
    return existing.id;
  }
  const { id } = await api<{ id: string }>("/convai/tools", { method: "POST", body: toolBody(tool) });
  return id;
}

function agentBody(agent: AgentSpec, toolIds: string[]) {
  return {
    name: agent.name,
    tags: ["beluga"],
    conversation_config: {
      agent: {
        // Empty, so the agent waits for the frame instead of speaking first.
        first_message: "",
        language: "en",
        prompt: { prompt: agent.prompt, llm: agent.llm, temperature: TEMPERATURE, tool_ids: toolIds },
      },
      conversation: {
        text_only: true,
        max_duration_seconds: LONGEST_CONVERSATION_S,
        client_events: CLIENT_EVENTS,
        // Three, in case an upload that was cut short and sent again lands every time.
        file_input: agent.seesPhotos
          ? { enabled: true, max_files_in_memory: 1, max_files_per_conversation: 3 }
          : { enabled: false },
      },
    },
    platform_settings: {
      // Frames are in these conversations: keep as little as the account allows (rule 5). Zero
      // Retention Mode would keep less, but ElevenLabs turns off file uploads with it on, so the
      // agent would never see the frame. The backend deletes each conversation after its answer.
      privacy: {
        record_voice: false,
        delete_audio: true,
        delete_transcript_and_pii: true,
        zero_retention_mode: false,
        retention_days: RETENTION_DAYS,
      },
      // Private agents: a conversation needs a signed URL from our backend.
      auth: { enable_auth: true },
    },
  };
}

async function upsertAgent(agent: AgentSpec, toolIds: string[]): Promise<string> {
  const existingId = process.env[agent.idEnv];
  if (existingId) {
    await api(`/convai/agents/${existingId}`, { method: "PATCH", body: agentBody(agent, toolIds) });
    return existingId;
  }
  const { agent_id: agentId } = await api<{ agent_id: string }>("/convai/agents/create", {
    method: "POST",
    body: agentBody(agent, toolIds),
  });
  return agentId;
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
      const read = async () =>
        (await fetch(`${API}/convai/conversations/${conversationId}`, { headers: { "xi-api-key": key } })).status;
      const now = await read();
      // A delete that came too early shows up here: the conversation is saved again a few seconds on.
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const later = await read();
      console.info(`Conversation ${deleted ? "deleted" : "NOT deleted"}; reading it back gives ${now}, and ${later} 5 s on.`);
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
  if (process.argv.includes("--sweep")) {
    for (const agent of Object.values(AGENTS)) {
      console.info(`${agent.name}: deleted ${await sweepConversations(agent)} finished conversations`);
    }
    return;
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
    const tools = [agent.tool, ...(agent.lookups ?? [])];
    const toolIds: string[] = [];
    for (const tool of tools) toolIds.push(await upsertTool(tool));
    const agentId = await upsertAgent(agent, toolIds);
    console.info(`${agent.name}: agent ${agentId}, tools ${tools.map((t) => t.name).join(", ")}`);
    lines.push(`${agent.idEnv}=${agentId}`);
  }
  console.info(`\nPut these in .env.local and in Vercel:\n${lines.join("\n")}`);
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
