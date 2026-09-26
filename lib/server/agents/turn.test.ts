import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { askAgent } from "./ask";
import { AGENTS } from "./config";
import { deleteConversation, runAgentTurn, sweepConversations, type SocketLike, type TurnDeps } from "./turn";

// Plays the ElevenLabs side of the WebSocket from the test.
class FakeSocket implements SocketLike {
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  private listeners: Record<string, Array<(event: { data?: unknown }) => void>> = {};
  addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, message?: object) {
    for (const listener of this.listeners[type] ?? []) listener({ data: message && JSON.stringify(message) });
  }
}

interface Fake {
  deps: TurnDeps;
  sockets: FakeSocket[];
  calls: string[];
}

// `uploads` are the statuses the file upload answers with, in turn; 200 once they run out.
function fake(uploads: number[] = []): Fake {
  const sockets: FakeSocket[] = [];
  const calls: string[] = [];
  const deps: TurnDeps = {
    now: () => Date.now(),
    sleep: () => Promise.resolve(),
    connect: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    fetch: async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url.replace("https://api.elevenlabs.io/v1", "")}`);
      if (url.includes("get-signed-url")) return Response.json({ signed_url: "wss://fake/convai?conversation_signature=x" });
      if (url.endsWith("/files")) {
        const status = uploads.shift() ?? 200;
        return status === 200 ? Response.json({ file_id: "file-1" }) : new Response(null, { status });
      }
      return new Response(null, { status: 200 });
    },
  };
  return { deps, sockets, calls };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const TURN = { agent: AGENTS.triage, text: "Hazard: obstacle", jpeg: new Uint8Array([0xff, 0xd8, 0xff]) };

async function startConversation(f: Fake) {
  const socket = f.sockets.at(-1)!;
  socket.emit("open");
  socket.emit("message", { type: "conversation_initiation_metadata", conversation_initiation_metadata_event: { conversation_id: "conv-1" } });
  await tick();
  await tick();
  return socket;
}

beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = "sk_test";
  process.env.ELEVENLABS_TRIAGE_AGENT_ID = "agent-triage";
});

afterEach(() => {
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_TRIAGE_AGENT_ID;
});

describe("runAgentTurn", () => {
  it("uploads the frame, sends it with the note, and returns the tool's parameters", async () => {
    const f = fake();
    const seen: string[] = [];
    const result = runAgentTurn({ ...TURN, deadline: Date.now() + 5000, onConversation: (id) => seen.push(id) }, f.deps);
    await tick();
    const socket = await startConversation(f);
    expect(socket.sent[0]).toEqual({ type: "conversation_initiation_client_data" });
    expect(socket.sent[1]).toEqual({
      type: "multimodal_message",
      text: { type: "user_message", text: "Hazard: obstacle" },
      file: { type: "file_input", file_id: "file-1" },
      files: [{ type: "file_input", file_id: "file-1" }],
    });
    socket.emit("message", { type: "ping", ping_event: { event_id: 7, ping_ms: 50 } });
    expect(socket.sent[2]).toEqual({ type: "pong", event_id: 7 });
    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "triage_answer", tool_call_id: "call-1", parameters: { category: "none" } },
    });
    await expect(result).resolves.toEqual({ parameters: { category: "none" }, conversationId: "conv-1" });
    expect(socket.sent[3]).toEqual({ type: "client_tool_result", tool_call_id: "call-1", result: "ok", is_error: false });
    expect(socket.closed).toBe(true);
    expect(seen).toEqual(["conv-1"]);
    expect(f.calls).toEqual([
      "GET /convai/conversation/get-signed-url?agent_id=agent-triage",
      "POST /convai/conversations/conv-1/files",
    ]);
  });

  it("sends the frame again while the conversation isn't ready for it, three times at most", async () => {
    const once = fake([408]);
    const result = runAgentTurn({ ...TURN, deadline: Date.now() + 5000 }, once.deps);
    await tick();
    const socket = await startConversation(once);
    await tick();
    expect(once.calls.filter((c) => c.endsWith("/files"))).toHaveLength(2);
    expect(socket.sent[1]).toMatchObject({ type: "multimodal_message", file: { file_id: "file-1" } });
    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "triage_answer", tool_call_id: "c", parameters: {} },
    });
    await expect(result).resolves.toMatchObject({ conversationId: "conv-1" });

    const twice = fake([404, 408, 408]);
    const failed = expect(runAgentTurn({ ...TURN, deadline: Date.now() + 5000 }, twice.deps)).rejects.toThrow(
      "frame upload: 408",
    );
    await tick();
    await startConversation(twice);
    await failed;
  });

  it("fails when the agent answers in plain text, or with another tool", async () => {
    const f = fake();
    const plain = runAgentTurn({ ...TURN, deadline: Date.now() + 5000 }, f.deps);
    await tick();
    const socket = await startConversation(f);
    socket.emit("message", { type: "client_tool_call", client_tool_call: { tool_name: "other", tool_call_id: "c" } });
    expect(socket.sent.at(-1)).toMatchObject({ type: "client_tool_result", is_error: true });
    socket.emit("message", { type: "agent_response_complete", agent_response_complete_event: { event_id: 3 } });
    await expect(plain).rejects.toThrow("answered without its tool");
  });

  it("gives up at the deadline and on an error event", async () => {
    const f = fake();
    await expect(runAgentTurn({ ...TURN, deadline: Date.now() + 30 }, f.deps)).rejects.toThrow("timed out");
    const g = fake();
    const errored = runAgentTurn({ ...TURN, deadline: Date.now() + 5000 }, g.deps);
    await tick();
    g.sockets[0].emit("message", { type: "error", error_event: { code: 1011, error_type: "llm_error" } });
    await expect(errored).rejects.toThrow("llm_error");
  });

  it("waits for ElevenLabs to save a conversation before deleting it, then checks it stays gone", async () => {
    const calls: string[] = [];
    const states = ["processing", "done"];
    let gone = false;
    const deps = {
      now: () => Date.now(),
      sleep: () => Promise.resolve(),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"}`);
        if (init?.method === "DELETE") {
          gone = true;
          return new Response(null, { status: 204 });
        }
        if (gone) return new Response(null, { status: 404 });
        return Response.json({ status: states.shift() ?? "done" });
      },
    } as unknown as TurnDeps;
    await expect(deleteConversation("conv-1", deps)).resolves.toBe(true);
    expect(calls).toEqual(["GET", "GET", "DELETE", "GET"]);
  });

  it("sweeps an agent's finished conversations and leaves a live one", async () => {
    process.env.ELEVENLABS_ASK_AGENT_ID = "agent-ask";
    const deleted: string[] = [];
    const deps = {
      now: () => Date.now(),
      sleep: () => Promise.resolve(),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "DELETE") {
          deleted.push(url.split("/").at(-1)!);
          return new Response(null, { status: 204 });
        }
        expect(url).toContain("agent_id=agent-ask");
        return Response.json({
          conversations: [
            { conversation_id: "a", status: "done" },
            { conversation_id: "b", status: "in-progress" },
            { conversation_id: "c", status: "failed" },
          ],
        });
      },
    } as unknown as TurnDeps;
    await expect(sweepConversations(AGENTS.ask, deps)).resolves.toBe(2);
    expect(deleted).toEqual(["a", "c"]);
    delete process.env.ELEVENLABS_ASK_AGENT_ID;
  });
});

describe("askAgent", () => {
  const schema = z.object({ category: z.enum(["none", "snow_ice"]) });

  it("retries once when the answer doesn't fit, and schedules every delete", async () => {
    const f = fake();
    const deletes: Array<() => Promise<unknown>> = [];
    const asked = askAgent(AGENTS.triage, "note", TURN.jpeg, Date.now() + 10_000, schema, f.deps, (task) => deletes.push(task));
    for (const parameters of [{ category: "pothole" }, { category: "snow_ice" }]) {
      await tick();
      const socket = await startConversation(f);
      socket.emit("message", { type: "client_tool_call", client_tool_call: { tool_name: "triage_answer", tool_call_id: "c", parameters } });
    }
    await expect(asked).resolves.toEqual({ ok: true, answer: { category: "snow_ice" } });
    expect(deletes).toHaveLength(2);
  });

  it("says not_configured without the agent id", async () => {
    delete process.env.ELEVENLABS_TRIAGE_AGENT_ID;
    const asked = await askAgent(AGENTS.triage, "note", TURN.jpeg, Date.now() + 5000, schema, fake().deps, () => {});
    expect(asked).toEqual({ ok: false, reason: "not_configured" });
  });
});
