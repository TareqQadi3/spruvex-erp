import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  getRefreshToken,
  post,
  setAccessToken,
  setRefreshToken,
  setSessionExpiredHandler,
} from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  tenantId?: string;
  permissions: string[];
  onboardingCompleted: boolean;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  status: "loading" | "guest" | "authenticated";
  user: SessionUser | null;
  /** Applies a fresh token pair (login/verify/onboarding step 2) and reloads the profile. */
  adoptSession: (tokens: TokenPair) => Promise<SessionUser>;
  refreshProfile: () => Promise<SessionUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const refreshProfile = useCallback(async () => {
    const me = await api<SessionUser>("/auth/me");
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const adoptSession = useCallback(
    async (tokens: TokenPair) => {
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      return refreshProfile();
    },
    [refreshProfile],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
      setStatus("guest");
    });

    // Boot: exchange a persisted refresh token for a session.
    (async () => {
      if (!getRefreshToken()) {
        setStatus("guest");
        return;
      }
      try {
        const tokens = await post<TokenPair>("/auth/refresh", {
          refreshToken: getRefreshToken(),
        });
        await adoptSession(tokens);
      } catch {
        setRefreshToken(null);
        setStatus("guest");
      }
    })();
  }, [adoptSession]);

  const value = useMemo(
    () => ({ status, user, adoptSession, refreshProfile, logout }),
    [status, user, adoptSession, refreshProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
