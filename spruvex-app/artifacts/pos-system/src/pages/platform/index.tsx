import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetch } from "./platformFetch";

interface MarketingSummary {
  totalCompanies: number;
  companiesByStatus: Record<string, number>;
  companiesBySubscriptionStatus: Record<string, number>;
  companiesByPlan: Record<string, number>;
  companiesByBusinessType: Record<string, number>;
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PlatformDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<MarketingSummary>({
    queryKey: ["platform-marketing-summary"],
    queryFn: () => platformFetch("/marketing-summary"),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("platform.dashboard_title")}</h1>

      {isLoading ? <Skeleton className="h-32 w-full" /> : data && (
        <>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold">{data.totalCompanies}</div>
                <div className="text-sm text-muted-foreground">{t("platform.total_companies")}</div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <BreakdownCard title={t("platform.by_status")} data={data.companiesByStatus} />
            <BreakdownCard title={t("platform.by_plan")} data={data.companiesByPlan} />
            <BreakdownCard title={t("platform.by_subscription_status")} data={data.companiesBySubscriptionStatus} />
          </div>
        </>
      )}
    </div>
  );
}
