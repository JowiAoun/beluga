import { describe, expect, it } from "vitest";
import { EventSchema, type HazardUpdate, type TriageResponse } from "@/lib/shared/contracts";
import { NETWORK } from "@/lib/shared/params";
import { civicReport, fromHazardEvent } from "./build";
import { deviceKey, newDeviceKey, reportingOn, setReporting, type KeyValueStore } from "./consent";
import { EventQueue } from "./queue";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const hazard: HazardUpdate = {
  id: "obstacle-2-1",
  kind: "obstacle",
  distance: 0.9,
  angle: -12,
  label: "bicycle",
  blocking: 0.7,
  active: true,
  firstSeenAt: 0,
  updatedAt: 0,
};
const where = { lat: 45.42654321, lon: -75.69198765 };

describe("consent", () => {
  it("is off until turned on, and off again for an older consent wording", () => {
    const s = memory();
    expect(reportingOn(s)).toBe(false);
    setReporting(true, s);
    expect(reportingOn(s)).toBe(true);
    s.setItem("beluga.consent", JSON.stringify({ on: true, version: 0 }));
    expect(reportingOn(s)).toBe(false);
  });

  it("keeps one device key until a new demo reporter is made", () => {
    const s = memory();
    const first = deviceKey(s);
    expect(deviceKey(s)).toBe(first);
    expect(newDeviceKey(s)).not.toBe(first);
  });
});

describe("events", () => {
  it("coarsens the place before an event is queued, and passes the intake schema", () => {
    const event = fromHazardEvent({ type: "near_miss", t: 0, hazard }, where, "device-key-1", "sidewalk");
    expect(event).toMatchObject({ lat: 45.427, lon: -75.692, kind: "near_miss", detectorClass: "bicycle", context: "sidewalk" });
    expect(EventSchema.safeParse(event).success).toBe(true);
  });

  it("makes a civic report only when the backend said to report", () => {
    const triage: TriageResponse = {
      report: true,
      category: "sidewalk_obstruction",
      isPublic: true,
      leftOrFixed: true,
      wayAround: "narrow",
      caneWarning: false,
      tripOrDrop: false,
      severity: 3,
      confidence: 0.9,
      description: "Bike lying across the sidewalk",
      context: "sidewalk",
      box: null,
      budgetRemaining: 10,
      latencyMs: 1200,
    };
    const report = civicReport(hazard, triage, where, "device-key-1");
    expect(report?.civic).toEqual({ category: "sidewalk_obstruction", severity: 3, confidence: 0.9, description: "Bike lying across the sidewalk" });
    expect(EventSchema.safeParse(report).success).toBe(true);
    expect(civicReport(hazard, { ...triage, report: false }, where, "device-key-1")).toBeNull();
  });
});

describe("EventQueue", () => {
  const event = fromHazardEvent({ type: "hazard_seen", t: 0, hazard }, where, "device-key-1", null);

  it("keeps events in storage and sends them in one batch with the consent version", async () => {
    const s = memory();
    const bodies: string[] = [];
    const queue = new EventQueue(s, async (body) => {
      bodies.push(body);
      return Response.json({ accepted: 2, rejected: 0 });
    });
    queue.add(event);
    queue.add(event);
    expect(new EventQueue(s).stats().queued).toBe(2);
    await queue.flush();
    expect(JSON.parse(bodies[0])).toMatchObject({ consentVersion: 1 });
    expect(JSON.parse(bodies[0]).events).toHaveLength(2);
    expect(queue.stats()).toEqual({ queued: 0, sent: 2, lastError: null });
    expect(new EventQueue(s).stats().queued).toBe(0);
  });

  it("keeps the batch after a failure and waits longer each time", async () => {
    let calls = 0;
    const queue = new EventQueue(memory(), async () => {
      calls++;
      return new Response(null, { status: 503 });
    });
    queue.add(event);
    await queue.flush(0);
    await queue.flush(NETWORK.eventBatchIntervalMs - 1);
    expect(calls).toBe(1);
    await queue.flush(NETWORK.eventBatchIntervalMs);
    await queue.flush(NETWORK.eventBatchIntervalMs * 2);
    expect(calls).toBe(2);
    expect(queue.stats()).toMatchObject({ queued: 1, lastError: "events: 503" });
  });

  it("sends at once when 50 events are waiting", async () => {
    let calls = 0;
    const queue = new EventQueue(memory(), async () => {
      calls++;
      return Response.json({ accepted: 50, rejected: 0 });
    });
    for (let i = 0; i < NETWORK.eventBatchMaxEvents; i++) queue.add(event);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(1);
  });
});
