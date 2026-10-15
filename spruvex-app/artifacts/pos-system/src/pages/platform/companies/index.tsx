import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Building2, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetch } from "../platformFetch";

interface CompanySummary {
  id: string;
  name: string;
  plan: string;
  businessType: string | null;
  status: "active" | "suspended";
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  activeAddonCodes: string[];
}

const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  active: "default",
  suspended: "destructive",
  trial: "outline",
  expired: "destructive",
  cancelled: "secondary",
};

export default function PlatformCompaniesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const { data: companies, isLoading, isError, refetch } = useQuery<CompanySummary[]>({
    queryKey: ["platform-companies"],
    queryFn: () => platformFetch("/companies"),
  });

  const filtered = companies?.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("platform.companies_title")}</h1>
        <div className="relative w-64">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t("common.search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {isError && <div className="p-4"><QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} /></div>}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="p-8"><EmptyState icon={Building2} title={t("platform.no_companies")} /></div>
          )}
          <div className="divide-y">
            {filtered.map(c => (
              <Link key={c.id} href={`/platform/companies/${c.id}`}>
                <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer">
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.plan} · {c.businessType ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.activeAddonCodes.length > 0 && (
                      <Badge variant="secondary">{t("platform.addons_count", { count: c.activeAddonCodes.length })}</Badge>
                    )}
                    <Badge variant={STATUS_VARIANT[c.subscriptionStatus ?? ""] ?? "outline"}>{c.subscriptionStatus ?? "—"}</Badge>
                    <Badge variant={STATUS_VARIANT[c.status]}>{t(`platform.company_status_${c.status}`)}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
