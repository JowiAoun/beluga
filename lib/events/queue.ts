// The on-phone event queue: batches to /api/events every 10 s or at 50 events, kept in storage so
// nothing is lost when the network drops or the app closes, and retried with backoff. Events are
// only queued while reporting is on; the caller checks that before adding.

import type { BelugaEvent, EventBatchResult } from "@/lib/shared/contracts";
import { CONSENT_VERSION } from "@/lib/shared/enums";
import { NETWORK } from "@/lib/shared/params";
import type { KeyValueStore } from "./consent";

const QUEUE_KEY = "beluga.queue";
// Past this, the oldest events go: a week offline shouldn't fill the phone.
const MAX_QUEUED = 2000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export interface QueueStats {
  queued: number;
  sent: number;
  lastError: string | null;
}

export class EventQueue {
  private events: BelugaEvent[];
  private sent = 0;
  private lastError: string | null = null;
  private sending = false;
  private nextTryAt = 0;
  private backoffMs: number = NETWORK.eventBatchIntervalMs;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly storage: KeyValueStore | null,
    private readonly post: (body: string) => Promise<Response> = (body) =>
      fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body }),
  ) {
    this.events = this.load();
  }

  add(event: BelugaEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_QUEUED) this.events.splice(0, this.events.length - MAX_QUEUED);
    this.save();
    if (this.events.length >= NETWORK.eventBatchMaxEvents) void this.flush();
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => void this.flush(), NETWORK.eventBatchIntervalMs);
    void this.flush();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  stats(): QueueStats {
    return { queued: this.events.length, sent: this.sent, lastError: this.lastError };
  }

  // Sends the oldest batch. On failure the events stay, and the next try waits twice as long.
  async flush(now = Date.now()): Promise<void> {
    if (this.sending || this.events.length === 0 || now < this.nextTryAt) return;
    this.sending = true;
    const batch = this.events.slice(0, NETWORK.eventBatchLimit);
    try {
      const response = await this.post(JSON.stringify({ events: batch, consentVersion: CONSENT_VERSION }));
      // A 400 means the batch itself is bad; sending it again won't help.
      if (!response.ok && response.status !== 400) throw new Error(`events: ${response.status}`);
      if (response.ok) {
        const result = (await response.json().catch(() => null)) as EventBatchResult | null;
        this.sent += result?.accepted ?? batch.length;
      }
      this.events.splice(0, batch.length);
      this.save();
      this.lastError = null;
      this.backoffMs = NETWORK.eventBatchIntervalMs;
      this.nextTryAt = 0;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.nextTryAt = now + this.backoffMs;
      this.backoffMs = Math.min(MAX_BACKOFF_MS, this.backoffMs * 2);
    } finally {
      this.sending = false;
    }
  }

  private load(): BelugaEvent[] {
    try {
      const saved = JSON.parse(this.storage?.getItem(QUEUE_KEY) ?? "[]") as unknown;
      return Array.isArray(saved) ? (saved as BelugaEvent[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(QUEUE_KEY, JSON.stringify(this.events));
    } catch {
      // Storage full or private mode: the events still send from memory.
    }
  }
}
