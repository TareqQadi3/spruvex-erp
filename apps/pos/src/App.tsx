import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@spruvex-r/ui";

import {
  post,
  setAccessToken,
  setRefreshToken,
  setSessionExpiredHandler,
  tryRefresh,
} from "./lib/api";
import { BranchSelectScreen } from "./screens/BranchSelectScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { PosScreen } from "./screens/PosScreen";

type Stage = "loading" | "login" | "branch" | "pos";

export default function App() {
  useTranslation();
  const [stage, setStage] = useState<Stage>("loading");
  const [branchId, setBranchId] = useState<string | null>(
    localStorage.getItem("spruvex:pos:branchId"),
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("spruvex:pos:refreshToken");
    if (refreshToken) {
      await post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    setAccessToken(null);
    setRefreshToken(null);
    setStage("login");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setStage("login"));
    (async () => {
      const ok = await tryRefresh().catch(() => false);
      if (!ok) {
        setStage("login");
      } else {
        setStage(branchId ? "pos" : "branch");
      }
    })();
  }, []);

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }
  if (stage === "login") {
    return <LoginScreen onSuccess={() => setStage("branch")} />;
  }
  if (stage === "branch" || !branchId) {
    return (
      <BranchSelectScreen
        onSelect={(id) => {
          localStorage.setItem("spruvex:pos:branchId", id);
          setBranchId(id);
          setStage("pos");
        }}
      />
    );
  }
  return (
    <PosScreen branchId={branchId} onSwitchBranch={() => setStage("branch")} onLogout={logout} />
  );
}
