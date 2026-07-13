import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@spruvex-r/ui";

import { platformApi } from "../lib/platform-api";

export function SystemStatusPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: platformApi.systemStatus,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("system.title")}</h1>
      {isLoading && <Spinner />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{t("system.database")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={data.database === "ok" ? "success" : "destructive"}>
                  {data.database}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{t("system.totalTenants")}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-primary">{data.tenants.total}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{t("system.activeTenants")}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-primary">{data.tenants.active}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">{t("system.suspendedTenants")}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-destructive">
                {data.tenants.suspended}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("system.subscriptionsByStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(data.subscriptions).map(([status, count]) => (
                <Badge key={status} variant="muted">
                  {status}: {count}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
