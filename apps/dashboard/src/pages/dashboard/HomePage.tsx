import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@spruvex-r/ui";

import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canBranches = user?.permissions.includes("branches.manage");
  const canUsers = user?.permissions.includes("users.manage");

  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<unknown[]>("/branches"),
    enabled: Boolean(canBranches),
  });
  const members = useQuery({
    queryKey: ["users"],
    queryFn: () => api<unknown[]>("/users"),
    enabled: Boolean(canUsers),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("home.welcome", { name: user?.name ?? "" })}</h1>
        <p className="text-muted-foreground">{t("home.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canBranches && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {t("home.branchesCard")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {branches.data?.length ?? "—"}
              </div>
            </CardContent>
          </Card>
        )}
        {canUsers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{t("home.teamCard")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{members.data?.length ?? "—"}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          {t("home.nextUp")}
        </CardContent>
      </Card>
    </div>
  );
}
