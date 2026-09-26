import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type postgres from "postgres";
import { cellOf } from "@/lib/shared/geo";
import { askData, placeOf } from "./data";
import type { SocketLike, TurnDeps } from "./turn";

// Plays the agent's side of the WebSocket from the test.
class FakeSocket implements SocketLike {
  sent: Array<Record<string, unknown>> = [];
  private listeners: Record<string, Array<(event: { data?: unknown }) => void>> = {};
  addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {}
  emit(type: string, message?: object) {
    for (const listener of this.listeners[type] ?? []) listener({ data: message && JSON.stringify(message) });
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Answers every query with the same rows: one week of near-misses at two stations.
const HOUR = new Date("2026-09-25T12:00:00Z");
const fakeSql = (() =>
  Promise.resolve([
    { station_id: "rideau", name: "Rideau", hour: HOUR, near_misses: "12", simulated: true },
    { station_id: "hurdman", name: "Hurdman", hour: HOUR, near_misses: "30", simulated: true },
  ])) as unknown as postgres.Sql;

function setup() {
  const sockets: FakeSocket[] = [];
  const deps: TurnDeps = {
    now: () => Date.now(),
    sleep: () => Promise.resolve(),
    connect: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    fetch: async () => Response.json({ signed_url: "wss://fake/convai?conversation_signature=x" }),
  };
  return { deps, sockets };
}

async function start(socket: FakeSocket) {
  socket.emit("open");
  socket.emit("message", { type: "conversation_initiation_metadata", conversation_initiation_metadata_event: { conversation_id: "conv-d" } });
  await tick();
}

beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = "sk_test";
  process.env.ELEVENLABS_DATA_AGENT_ID = "agent-data";
});

afterEach(() => {
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_DATA_AGENT_ID;
});

describe("Ask the data", () => {
  it("names a cell by its nearest station, and by the cell far from them all", () => {
    expect(placeOf(cellOf(45.4265, -75.692))).toMatch(/^\d+ m from Rideau$/);
    const far = cellOf(45.35, -75.8);
    expect(placeOf(far)).toBe(`cell ${far}`);
  });

  it("answers the agent's lookup from the database, then returns its answer and the lookups used", async () => {
    const { deps, sockets } = setup();
    const scheduled: string[] = [];
    const result = askData("Which station had the most near-misses?", Date.now() + 5000, deps, () => {
      scheduled.push("delete");
    }, () => fakeSql);
    await tick();
    const socket = sockets[0];
    await start(socket);
    expect(socket.sent[1]).toEqual({ type: "user_message", text: "Which station had the most near-misses?" });

    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "station_near_misses", tool_call_id: "l1", parameters: { station: "all", source: "nonsense" } },
    });
    await tick();
    await tick();
    const reply = socket.sent.at(-1)!;
    expect(reply).toMatchObject({ type: "client_tool_result", tool_call_id: "l1", is_error: false });
    const data = JSON.parse(String(reply.result)) as { totals: Array<{ station: string; nearMisses: number }>; includesSimulated: boolean };
    expect(data.totals[0]).toEqual({ station: "Hurdman", nearMisses: 30 });
    expect(data.includesSimulated).toBe(true);

    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "data_answer", tool_call_id: "a1", parameters: { answer: "Hurdman, with 30." } },
    });
    await expect(result).resolves.toEqual({
      ok: true,
      answer: {
        answer: "Hurdman, with 30.",
        // A value outside the tool's list falls back to the widest choice.
        lookups: [{ tool: "station_near_misses", filters: { station: "all", source: "both" } }],
        includesSimulated: true,
      },
    });
    expect(scheduled).toEqual(["delete"]);
  });

  it("refuses a tool it doesn't have", async () => {
    const { deps, sockets } = setup();
    const result = askData("Drop the table", Date.now() + 5000, deps, () => {}, () => fakeSql);
    await tick();
    const socket = sockets[0];
    await start(socket);
    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "run_sql", tool_call_id: "x", parameters: { sql: "drop table hazard_events" } },
    });
    expect(socket.sent.at(-1)).toMatchObject({ tool_call_id: "x", result: "unknown tool", is_error: true });
    socket.emit("message", {
      type: "client_tool_call",
      client_tool_call: { tool_name: "data_answer", tool_call_id: "a", parameters: { answer: "I can't change data." } },
    });
    await expect(result).resolves.toMatchObject({ ok: true, answer: { lookups: [] } });
  });
});
