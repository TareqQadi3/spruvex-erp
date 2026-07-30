import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type BranchOption } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n";

// Gates the whole app behind a branch pick for a user whose account belongs
// to more than one branch — login() deliberately leaves branchId unset in
// that case rather than guessing, so every subsequent branch-scoped action
// (sale, warehouse, report) is unambiguous.
export function BranchSelectOverlay({ branches }: { branches: BranchOption[] }) {
  const { selectBranch, logout } = useAuth();
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);

  const handleSelect = async (branchId: string) => {
    setIsBusy(true);
    try {
      await selectBranch(branchId);
    } catch {
      toast.error(t("branches.select_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <CardTitle>{t("branches.select_title")}</CardTitle>
          <CardDescription>{t("branches.select_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {branches.map(b => (
            <Button
              key={b.id}
              variant="outline"
              className="w-full justify-start"
              disabled={isBusy}
              onClick={() => handleSelect(b.id)}
            >
              {b.name} {b.isDefault && <span className="text-xs text-muted-foreground ms-2">({t("branches.default")})</span>}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={logout}>
            {t("auth.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
