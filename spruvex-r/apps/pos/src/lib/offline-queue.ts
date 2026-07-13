/**
 * Degraded-mode foundation (plan §8.5): a client-side queue for order
 * creation during short connectivity gaps. Queued requests carry their
 * original Idempotency-Key, so retries can never double-create.
 * Payments are intentionally NOT queued — money operations require a live
 * connection. Full offline-first POS remains a v2 item.
 */

import { post } from "./api";

const QUEUE_KEY = "spruvex:pos:orderQueue";
const RETRY_INTERVAL_MS = 20_000;

export interface QueuedOrder {
  idempotencyKey: string;
  body: Record<string, unknown>;
  queuedAt: string;
}

export interface SyncState {
  pending: number;
  syncing: boolean;
}

type Listener = (state: SyncState) => void;

function readQueue(): QueuedOrder[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOrder[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** fetch() rejects with TypeError on network failure — 4xx/5xx do not. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

class OfflineOrderQueue {
  private listeners = new Set<Listener>();
  private syncing = false;
  private timer: number | null = null;

  start(): void {
    window.addEventListener("online", () => void this.flush());
    this.timer ??= window.setInterval(() => void this.flush(), RETRY_INTERVAL_MS);
    void this.flush();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get state(): SyncState {
    return { pending: readQueue().length, syncing: this.syncing };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  enqueue(idempotencyKey: string, body: Record<string, unknown>): void {
    writeQueue([...readQueue(), { idempotencyKey, body, queuedAt: new Date().toISOString() }]);
    this.notify();
  }

  /** Retries queued orders in FIFO order. Stops at the first network failure. */
  async flush(): Promise<void> {
    if (this.syncing) return;
    let queue = readQueue();
    if (queue.length === 0) return;

    this.syncing = true;
    this.notify();
    try {
      while (queue.length > 0) {
        const next = queue[0];
        try {
          await post("/orders", next.body, { "Idempotency-Key": next.idempotencyKey });
          queue = queue.slice(1);
          writeQueue(queue);
          this.notify();
        } catch (error) {
          if (isNetworkError(error)) {
            return; // still offline — try again later
          }
          // Rejected by the server (validation/permission): drop it so the
          // queue cannot jam; the cashier re-enters the order if needed.
          queue = queue.slice(1);
          writeQueue(queue);
          this.notify();
        }
      }
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  private notify(): void {
    const state = this.state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export const offlineQueue = new OfflineOrderQueue();
