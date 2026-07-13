import { api, post } from "./api";

export interface Floor {
  id: string;
  branchId: string;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  branch: { id: string; name: string; nameEn: string | null };
  _count?: { tables: number };
}

export type TableStatus = "available" | "occupied" | "reserved" | "disabled";

export interface DiningTable {
  id: string;
  branchId: string;
  floorId: string;
  number: string;
  capacity: number;
  status: TableStatus;
  qrToken: string;
  qrGeneratedAt: string;
  floor: { id: string; name: string; nameEn: string | null };
  branch: { id: string; name: string; nameEn: string | null };
}

export const tablesApi = {
  listFloors: (branchId?: string) =>
    api<Floor[]>(`/floors${branchId ? `?branchId=${branchId}` : ""}`),
  createFloor: (body: unknown) => post<Floor>("/floors", body),
  updateFloor: (id: string, body: unknown) =>
    api<Floor>(`/floors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFloor: (id: string) => api(`/floors/${id}`, { method: "DELETE" }),

  listTables: (filter: { branchId?: string; floorId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.floorId) params.set("floorId", filter.floorId);
    const qs = params.toString();
    return api<DiningTable[]>(`/tables${qs ? `?${qs}` : ""}`);
  },
  createTable: (body: unknown) => post<DiningTable>("/tables", body),
  updateTable: (id: string, body: unknown) =>
    api<DiningTable>(`/tables/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTable: (id: string) => api(`/tables/${id}`, { method: "DELETE" }),
  regenerateQr: (id: string) => post<DiningTable>(`/tables/${id}/regenerate-qr`, {}),
  openSession: (id: string) => post(`/tables/${id}/sessions/open`, {}),
  closeSession: (id: string) => post(`/tables/${id}/sessions/close`, {}),
};
