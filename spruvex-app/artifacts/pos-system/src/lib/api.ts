import { TOKEN_KEY } from "@/contexts/AuthContext";

/**
 * Lightweight authenticated fetch for endpoints not covered by the generated
 * client. Sends the stored JWT and throws on non-2xx with the server message.
 */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
