import { db } from "./connection";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Repositories accept this so the same method works whether called plainly
// (uses the pooled `db`) or from inside withTransaction (passed `tx`).
export type DbOrTx = typeof db | Transaction;

export function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
