import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Trash2, CalendarClock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface InstallmentPlan {
  id: number;
  months: number;
  interestPercent: string;
  isActive: boolean;
}

export default function InstallmentPlansSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [months, setMonths] = useState("");
  const [interestPercent, setInterestPercent] = useState("");

  const { data: plans, isLoading } = useQuery<InstallmentPlan[]>({
    queryKey: ["installment-plans"],
    queryFn: () => api("/installment-plans"),
  });

  const createMutation = useMutation({
    mutationFn: (vars: { months: number; interestPercent: number }) =>
      api("/installment-plans", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment-plans"] });
      setDialogOpen(false);
      setMonths("");
      setInterestPercent("");
      toast.success(t("installments.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/installment-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["installment-plans"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("installments.title")}</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("installments.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("installments.list_title")}</CardTitle>
          <CardDescription>{t("installments.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {plans?.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                <div className="font-medium text-sm">
                  {t("installments.months_label", { months: p.months })} · {t("installments.interest_label", { percent: p.interestPercent })}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("installments.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("installments.months")}</Label>
              <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="12" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("installments.interest_percent")}</Label>
              <Input type="number" step="0.01" value={interestPercent} onChange={(e) => setInterestPercent(e.target.value)} placeholder="50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={createMutation.isPending || !months}
              onClick={() => createMutation.mutate({ months: Number(months), interestPercent: Number(interestPercent) || 0 })}
            >
              {createMutation.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
