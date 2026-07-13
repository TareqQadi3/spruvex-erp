/**
 * Server-side API client for SSR pages: talks directly to the API's public
 * endpoints (no auth — QR token / restaurant slug is the access control).
 * Runs on the server so the API_ORIGIN is never exposed to the browser
 * bundle (the browser reaches the same routes through the Next.js rewrite
 * in next.config.mjs, kept same-origin for the client-side order tracker).
 */

// Some platforms (e.g. Render's `fromService` blueprint wiring) can only
// hand us a bare `host:port`, not a full URL with scheme — accept both.
const rawApiOrigin = process.env.API_ORIGIN ?? "http://localhost:3000";
const API_ORIGIN = rawApiOrigin.includes("://") ? rawApiOrigin : `http://${rawApiOrigin}`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string, opts?: { revalidate?: number }): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    next: { revalidate: opts?.revalidate ?? 0 },
  });
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
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
