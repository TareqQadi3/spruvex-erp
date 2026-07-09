import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const TOKEN_KEY = "pos_auth_token";
const API_BASE = "/api";

async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wire up the global API client to send the JWT on every request
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

  // On mount, check if there's a saved token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    verifyToken(token).then(u => {
      if (u) {
        setUser(u);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Invalid credentials");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Role-based permission helpers
export const ROLE_PAGES: Record<string, string[]> = {
  admin: ["*"],
  store_manager: ["/", "/pos", "/sales", "/repairs", "/inventory", "/customers", "/suppliers", "/purchases", "/vouchers", "/accounting", "/reports", "/settings"],
  cashier: ["/", "/pos", "/sales", "/customers", "/repairs"],
  warehouse_staff: ["/", "/inventory", "/suppliers", "/purchases"],
  accountant: ["/", "/accounting", "/reports", "/vouchers"],
};

export function canAccess(role: string, path: string): boolean {
  const allowed = ROLE_PAGES[role] ?? ["/"];
  if (allowed.includes("*")) return true;
  if (allowed.includes(path)) return true;
  // Check prefix match (e.g. /repairs for /repairs/new)
  return allowed.some(p => p !== "/" && path.startsWith(p));
}
