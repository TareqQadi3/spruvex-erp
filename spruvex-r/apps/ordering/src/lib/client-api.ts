"use client";

/**
 * Browser-side POST helper. Requests go through the same-origin
 * `/api/v1/*` path, which next.config.mjs rewrites to the API server —
 * keeps the API origin out of the client bundle and avoids CORS.
 */
import { ApiError } from "./api";

export async function clientPost<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = Array.isArray(data.message) ? data.message.join("، ") : (data.message ?? message);
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function clientGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }
  return res.json() as Promise<T>;
}
