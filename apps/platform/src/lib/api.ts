/**
 * Minimal API client for the platform admin console. Unlike the tenant apps
 * there is no refresh-token rotation here (platform-auth.service.ts issues a
 * single short-lived access token) — a 401 just signs the admin out.
 */
const BASE = "/api/v1";
const TOKEN_KEY = "spruvex:platform:token";

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setAccessToken(null);
    onSessionExpired?.();
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join("، ") : (body.message ?? message);
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
