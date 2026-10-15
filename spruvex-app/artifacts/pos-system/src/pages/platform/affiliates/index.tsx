import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Handshake } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetch } from "../platformFetch";

interface Affiliate { id: string; name: string; email: string; referralCode: string; status: string; commissionRatePercent: string; }
interface ReferralConversion {
  id: string; affiliateId: string; product: string; companyName: string; planCode: string;
  subscriptionValueSar: string; commissionAmountSar: string; status: string; reportedAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  pending: "outline",
  approved: "default",
  paid: "secondary",
};

export default function PlatformAffiliatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("10");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: affiliates, isLoading: affLoading } = useQuery<Affiliate[]>({
    queryKey: ["platform-affiliates"],
    queryFn: () => platformFetch("/affiliates"),
  });

  const { data: conversions, isLoading: convLoading } = useQuery<ReferralConversion[]>({
    queryKey: ["platform-conversions", statusFilter],
    queryFn: () => platformFetch(`/conversions${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: () => platformFetch("/affiliates", { method: "POST", body: JSON.stringify({ name, email, commissionRatePercent: Number(rate) || 10 }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-affiliates"] });
      setCreateOpen(false);
      setName(""); setEmail(""); setRate("10");
      toast.success(t("platform.affiliate_created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => platformFetch(`/conversions/${id}/approve`, { method: "POST" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-conversions"] }); toast.success(t("platform.conversion_approved")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => platformFetch(`/conversions/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-conversions"] }); toast.success(t("platform.conversion_paid")); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("platform.affiliates_title")}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("platform.new_affiliate")}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("platform.affiliates_list_title")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {affLoading && <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
          {!affLoading && affiliates?.length === 0 && (
            <div className="p-8"><EmptyState icon={Handshake} title={t("platform.no_affiliates")} /></div>
          )}
          <div className="divide-y">
            {affiliates?.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-sm">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <div className="text-end">
                  <Badge variant="outline" className="font-mono">{a.referralCode}</Badge>
                  <div className="text-xs text-muted-foreground mt-1">{a.commissionRatePercent}%</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("platform.conversions_title")}</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue>{statusFilter === "all" ? t("common.status") : t(`platform.conversion_status_${statusFilter}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.status")}</SelectItem>
                <SelectItem value="pending">{t("platform.conversion_status_pending")}</SelectItem>
                <SelectItem value="approved">{t("platform.conversion_status_approved")}</SelectItem>
                <SelectItem value="paid">{t("platform.conversion_status_paid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {convLoading && <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
          {!convLoading && conversions?.length === 0 && (
            <div className="p-8"><EmptyState icon={Handshake} title={t("platform.no_conversions")} /></div>
          )}
          <div className="divide-y">
            {conversions?.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium text-sm">{c.companyName}</div>
                  <div className="text-xs text-muted-foreground">{c.product} · {c.planCode} · {c.commissionAmountSar} SAR</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[c.status]}>{t(`platform.conversion_status_${c.status}`)}</Badge>
                  {c.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(c.id)} disabled={approveMutation.isPending}>
                      {t("platform.approve")}
                    </Button>
                  )}
                  {c.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(c.id)} disabled={markPaidMutation.isPending}>
                      {t("platform.mark_paid")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {createOpen && (
        <Dialog open onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("platform.new_affiliate")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("common.name")}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.email")}</Label>
                <Input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("platform.commission_rate")}</Label>
                <Input type="number" value={rate} onChange={e => setRate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button disabled={createMutation.isPending || !name.trim() || !email.trim()} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
