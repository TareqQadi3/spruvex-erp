import { useEffect, useState } from "react";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface PermissionsResponse {
  role: string;
  permissions: string[];
}

let cache: { key: string; permissions: string[] } | null = null;

// Resolved, DB-backed permission codes for the current user (roles ->
// role_permissions -> permissions), not the coarse ROLE_PAGES route
// allowlist — used to hide/disable specific actions (buttons, form
// controls) within a page that ROLE_PAGES already let the user reach.
export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>(cache?.permissions ?? []);
  const [isLoading, setIsLoading] = useState(!cache);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (cache?.key === token) {
      setPermissions(cache.permissions);
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me/permissions", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: PermissionsResponse) => {
        cache = { key: token, permissions: data.permissions };
        setPermissions(data.permissions);
      })
      .catch(() => setPermissions([]))
      .finally(() => setIsLoading(false));
  }, []);

  const has = (code: string) => permissions.includes(code);
  return { permissions, has, isLoading };
}
