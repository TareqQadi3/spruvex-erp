import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@spruvex-r/ui";

import { ApiError } from "../../lib/api";
import { billingApi } from "../../lib/billing-api";
import { localizedName } from "../../lib/catalog-api";
import { useAuth } from "../../lib/auth";

const STATUS_VARIANT: Record<string, "success" | "muted" | "destructive"> = {
  trialing: "muted",
  active: "success",
  past_due: "destructive",
  suspended: "destructive",
  cancelled: "destructive",
};

export function BillingPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.permissions.includes("billing.manage");

  const subscription = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: billingApi.getSubscription,
  });
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: billingApi.listPlans });

  const changePlan = useMutation({
    mutationFn: (planKey: string) => billingApi.changePlan(planKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing"] }),
    onError: (e) => alert(e instanceof ApiError ? e.message : t("common.error")),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("billing.title")}</h1>

      {subscription.isLoading && <Spinner />}
      {subscription.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t("billing.currentPlan")}
              <Badge variant={STATUS_VARIANT[subscription.data.status] ?? "muted"}>
                {t(`billing.statuses.${subscription.data.status}`)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold">
              {localizedName(subscription.data.plan, i18n.language)}
            </p>
            {subscription.data.trialDaysRemaining !== null && (
              <Alert>{t("billing.trialRemaining", { count: subscription.data.trialDaysRemaining })}</Alert>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <UsageStat
                label={t("billing.branches")}
                used={subscription.data.usage.branches}
                limit={subscription.data.plan.maxBranches}
              />
              <UsageStat
                label={t("billing.users")}
                used={subscription.data.usage.users}
                limit={subscription.data.plan.maxUsers}
              />
              <UsageStat
                label={t("billing.ordersThisMonth")}
                used={subscription.data.usage.ordersThisMonth}
                limit={subscription.data.plan.maxOrdersPerMonth}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("billing.availablePlans")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.data?.map((plan) => {
            const isCurrent = subscription.data?.plan.key === plan.key;
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {localizedName(plan, i18n.language)}
                    {isCurrent && <Badge variant="success">{t("billing.current")}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold text-primary" dir="ltr">
                    {(plan.priceMonthlyHalalas / 100).toFixed(2)} SAR
                    <span className="text-sm font-normal text-muted-foreground"> / {t("billing.month")}</span>
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>{t("billing.branches")}: {plan.maxBranches}</li>
                    <li>{t("billing.users")}: {plan.maxUsers}</li>
                    <li>
                      {t("billing.ordersPerMonth")}: {plan.maxOrdersPerMonth ?? t("billing.unlimited")}
                    </li>
                  </ul>
                  {canManage && !isCurrent && (
                    <Button
                      className="w-full"
                      disabled={changePlan.isPending}
                      onClick={() => changePlan.mutate(plan.key)}
                    >
                      {t("billing.switchToPlan")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const { t } = useTranslation();
  const overLimit = limit !== null && used >= limit;
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${overLimit ? "text-destructive" : ""}`} dir="ltr">
        {used} / {limit ?? t("billing.unlimited")}
      </p>
    </div>
  );
}
