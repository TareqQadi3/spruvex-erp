import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge, Button, Card, CardContent, Dialog, Input, Select, Spinner } from "@spruvex-r/ui";

import { ApiError } from "../lib/api";
import { platformApi, type TenantListItem, type TenantStatus } from "../lib/platform-api";

function localizedName(item: { name: string; nameEn?: string | null }, language: string): string {
  return language === "en" && item.nameEn ? item.nameEn : item.name;
}

export function TenantsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");
  const { data, isLoading } = useQuery({
    queryKey: ["tenants", search, status],
    queryFn: () => platformApi.listTenants({ search: search || undefined, status: status || undefined }),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["tenant", selectedId],
    queryFn: () => platformApi.getTenant(selectedId!),
    enabled: Boolean(selectedId),
  });

  const setTenantStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TenantStatus }) =>
      platformApi.setTenantStatus(id, next),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant", selectedId] }),
      ]);
    },
    onError: (e) => alert(e instanceof ApiError ? e.message : t("common.error")),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("tenants.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-56"
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value as TenantStatus | "")}>
            <option value="">{t("common.all")}</option>
            <option value="active">{t("tenants.active")}</option>
            <option value="suspended">{t("tenants.suspended")}</option>
          </Select>
        </div>
      </div>

      {isLoading && <Spinner />}
      {data?.length === 0 && <p className="text-muted-foreground">{t("tenants.empty")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((tenant: TenantListItem) => (
          <Card
            key={tenant.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setSelectedId(tenant.id)}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{localizedName(tenant, i18n.language)}</span>
                <Badge variant={tenant.status === "active" ? "success" : "destructive"}>
                  {tenant.status === "active" ? t("tenants.active") : t("tenants.suspended")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {tenant.slug}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("tenants.branches", { count: tenant.branchCount })}</span>
                {tenant.subscription && (
                  <Badge variant="muted">
                    {localizedName(
                      { name: tenant.subscription.plan.name, nameEn: tenant.subscription.plan.nameEn },
                      i18n.language,
                    )}
                    {tenant.subscription.status === "trialing" ? ` · ${t("tenants.trial")}` : ""}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={selectedId !== null} onClose={() => setSelectedId(null)} title={t("tenants.detail")}>
        {detail.isLoading && <Spinner />}
        {detail.data && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{localizedName(detail.data, i18n.language)}</h3>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {detail.data.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={detail.data.status === "active" ? "success" : "destructive"}>
                {detail.data.status === "active" ? t("tenants.active") : t("tenants.suspended")}
              </Badge>
              <Badge variant="muted">{t("tenants.users", { count: detail.data.userCount })}</Badge>
              <Badge variant="muted">{t("tenants.branches", { count: detail.data.branches.length })}</Badge>
              {detail.data.subscription && (
                <Badge variant="default">
                  {t("tenants.plan")}: {detail.data.subscription.plan.name}
                </Badge>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {detail.data.status === "active" ? (
                <Button
                  variant="destructive"
                  disabled={setTenantStatus.isPending}
                  onClick={() => {
                    if (confirm(t("tenants.confirmSuspend"))) {
                      setTenantStatus.mutate({ id: detail.data!.id, next: "suspended" });
                    }
                  }}
                >
                  {t("tenants.suspend")}
                </Button>
              ) : (
                <Button
                  disabled={setTenantStatus.isPending}
                  onClick={() => setTenantStatus.mutate({ id: detail.data!.id, next: "active" })}
                >
                  {t("tenants.reactivate")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
