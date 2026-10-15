import { TOKEN_KEY } from "@/contexts/AuthContext";

// Shared fetch helper for every /api/platform/* route — all routes there are
// requireAuth + requirePlatformAdmin only (cross-tenant by design, see
// platformAdmin.middleware.ts), so a tenant's own companyId/role is
// irrelevant here; the same JWT just needs isPlatformAdmin=true on the row.
export async function platformFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api/platform${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error?.message ?? err.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  const body = await res.json();
  return body?.data ?? body;
}

// Same as platformFetch but returns the full paginated envelope ({data, meta})
// instead of unwrapping to just `data` — needed by list pages that show a
// total count or paginate.
export async function platformFetchPaginated(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api/platform${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error?.message ?? err.error ?? "Request failed");
  }
  return res.json();
}
