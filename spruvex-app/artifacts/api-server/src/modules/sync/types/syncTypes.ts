import type { OfflineOperationType } from "@workspace/db";

export interface OfflineOperationInput {
  clientGeneratedId: string;
  entityType: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
}

export interface SyncPushRequest {
  deviceId: string;
  branchId?: string;
  operations: OfflineOperationInput[];
}

export interface AcceptedOperation {
  clientGeneratedId: string;
  entityType: string;
  operationType: string;
  result: unknown;
}

export interface RejectedOperation {
  clientGeneratedId: string;
  entityType: string;
  operationType: string;
  reason: string;
}

export interface SyncPushResponse {
  accepted: AcceptedOperation[];
  rejected: RejectedOperation[];
  serverTime: string;
}

export interface SyncChangeRecord {
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  updatedAt: string;
  payload: Record<string, unknown>;
}

export interface SyncPullResponse {
  changes: SyncChangeRecord[];
  serverTime: string;
}

export interface SyncStatusResponse {
  deviceId: string;
  lastSyncAt: string | null;
  pendingCount: number;
  lastSuccessCount: number | null;
  lastFailedCount: number | null;
}
