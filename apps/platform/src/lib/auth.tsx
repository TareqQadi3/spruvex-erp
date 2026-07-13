import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, getAccessToken, post, setAccessToken, setSessionExpiredHandler } from "./api";

export interface PlatformAdminSession {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  status: "loading" | "guest" | "authenticated";
  admin: PlatformAdminSession | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [admin, setAdmin] = useState<PlatformAdminSession | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setStatus("guest");
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ accessToken: string }>("/platform/auth/login", { email, password });
    setAccessToken(res.accessToken);
    const me = await api<PlatformAdminSession>("/platform/auth/me");
    setAdmin(me);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAdmin(null);
      setStatus("guest");
    });

    (async () => {
      if (!getAccessToken()) {
        setStatus("guest");
        return;
      }
      try {
        const me = await api<PlatformAdminSession>("/platform/auth/me");
        setAdmin(me);
        setStatus("authenticated");
      } catch {
        setAccessToken(null);
        setStatus("guest");
      }
    })();
  }, []);

  const value = useMemo(() => ({ status, admin, login, logout }), [status, admin, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
