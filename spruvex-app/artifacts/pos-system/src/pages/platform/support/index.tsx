import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { LifeBuoy } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetchPaginated } from "../platformFetch";

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  companyId: string;
  createdAt: string;
}

const STATUSES = ["open", "pending", "in_progress", "resolved", "closed"];
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  pending: "outline",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

export default function PlatformSupportPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading, isError, refetch } = useQuery<{ data: SupportTicket[] }>({
    queryKey: ["platform-support-tickets", status],
    queryFn: () => platformFetchPaginated(`/support/tickets?pageSize=100${status !== "all" ? `&status=${status}` : ""}`),
  });
  const tickets = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("platform.support_title")}</h1>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue>{status === "all" ? t("common.status") : t(`support.status_${status}`)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.status")}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`support.status_${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {isError && <div className="p-4"><QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} /></div>}
          {!isLoading && !isError && tickets.length === 0 && (
            <div className="p-8"><EmptyState icon={LifeBuoy} title={t("platform.no_tickets")} /></div>
          )}
          <div className="divide-y">
            {tickets.map(ticket => (
              <Link key={ticket.id} href={`/platform/support/${ticket.id}`}>
                <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge variant={STATUS_VARIANT[ticket.status]}>{t(`support.status_${ticket.status}`)}</Badge>
                    </div>
                    <div className="font-medium text-sm">{ticket.subject}</div>
                    <div className="text-xs text-muted-foreground font-mono">{ticket.companyId}</div>
                  </div>
                  <div className="text-end">
                    <Badge variant="outline">{t(`support.priority_${ticket.priority}`)}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(ticket.createdAt).toLocaleDateString()}</div>
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
