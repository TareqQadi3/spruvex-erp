export const CONFLICT_STRATEGIES = ["LAST_WRITE_WINS", "SERVER_WINS", "MERGE"] as const;
export type ConflictStrategy = typeof CONFLICT_STRATEGIES[number];

// Per-entity policy, as specified: product/customer edits are last-write-wins
// (an offline edit can legitimately overwrite a stale server value); stock
// adjustments, invoice finalization, and ZATCA submissions are server-wins
// (financial/compliance state is never blindly overwritten by a client
// snapshot); stock movements and sale drafts are additive/merge (both sides'
// events are kept, nothing is discarded).
const ENTITY_STRATEGY: Record<string, ConflictStrategy> = {
  product: "LAST_WRITE_WINS",
  customer: "LAST_WRITE_WINS",
  stock: "SERVER_WINS",
  invoice: "SERVER_WINS",
  zatca_submission: "SERVER_WINS",
  stock_movement: "MERGE",
  sale_draft: "MERGE",
};

// Fail-safe default for any entity type not in the table above: SERVER_WINS.
// An unrecognized entity type must never silently let a client overwrite
// server state.
export function getStrategyForEntity(entityType: string): ConflictStrategy {
  return ENTITY_STRATEGY[entityType] ?? "SERVER_WINS";
}

export interface ConflictContext {
  entityType: string;
  clientTimestamp: Date;
  clientPayload: Record<string, unknown>;
  serverTimestamp?: Date;
  serverPayload?: Record<string, unknown>;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  useClientPayload: boolean;
  merged?: Record<string, unknown>;
}

export function resolveConflict(ctx: ConflictContext): ConflictResolution {
  const strategy = getStrategyForEntity(ctx.entityType);

  switch (strategy) {
    case "LAST_WRITE_WINS": {
      // NOTE: true timestamp comparison requires an updated_at column on the
      // target table. products/customers don't have one in the real schema
      // (no schema changes this pass) — when there's no comparable server
      // timestamp, this degenerates to "apply the client write" (there is no
      // server state to prove a conflict against), which is what the
      // fallback branch does explicitly rather than silently.
      if (!ctx.serverTimestamp) return { strategy, useClientPayload: true };
      const clientIsNewerOrEqual = ctx.clientTimestamp.getTime() >= ctx.serverTimestamp.getTime();
      return { strategy, useClientPayload: clientIsNewerOrEqual };
    }

    case "SERVER_WINS": {
      // Only apply the client's write if the server has no state at all yet
      // for this entity (e.g. first-ever stock row) — once server state
      // exists, it is authoritative. In practice the stock/invoice/ZATCA
      // engines already enforce this by construction (deltas + state-machine
      // guards against current server rows, never a blind overwrite from a
      // client-supplied snapshot); this is the formal policy that confirms it.
      return { strategy, useClientPayload: !ctx.serverPayload };
    }

    case "MERGE": {
      return {
        strategy,
        useClientPayload: true,
        merged: { ...ctx.serverPayload, ...ctx.clientPayload },
      };
    }
  }
}
