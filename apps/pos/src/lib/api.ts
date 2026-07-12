/** Compact API client for kiosk apps (KDS): token in memory + persisted refresh token. */

const BASE = "/api/v1";
const REFRESH_KEY = "spruvex:pos:refreshToken";

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const setRefreshToken = (token: string | null) => {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
};
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, { ...options, headers });
}

export async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    setRefreshToken(null);
    setAccessToken(null);
    return false;
  }
  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  setAccessToken(body.accessToken);
  setRefreshToken(body.refreshToken);
  return true;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (await tryRefresh()) {
      res = await rawRequest(path, options);
    } else {
      onSessionExpired?.();
    }
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join("، ") : (body.message ?? message);
    } catch {
      // non-JSON body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const post = <T>(path: string, body: unknown, headers?: Record<string, string>) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body), headers });
