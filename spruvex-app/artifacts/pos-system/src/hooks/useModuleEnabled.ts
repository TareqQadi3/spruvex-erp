import { useEffect, useState } from "react";
import { TOKEN_KEY } from "@/contexts/AuthContext";

// Checks whether a paid add-on module (advanced_reports, ecommerce, ...) is
// active for the current company, via the generic
// /api/subscriptions/modules/:moduleCode/status endpoint — the counterpart
// to the two hardcoded settings booleans (repairsModuleEnabled,
// ecommerceModuleEnabled) for every other add-on module that doesn't get
// its own settings column. Never 403s server-side, so this just reflects
// {enabled: false} rather than throwing when the module isn't active.
export function useModuleEnabled(moduleCode: string): { enabled: boolean; isLoading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch(`/api/subscriptions/modules/${moduleCode}/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((body: { data: { enabled: boolean } }) => setEnabled(body.data.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setIsLoading(false));
  }, [moduleCode]);

  return { enabled, isLoading };
}
