import { useGetRepair, useUpdateRepairStatus, useUpdateRepair, getGetRepairQueryKey, getGetRepairsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Printer, Phone, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

const STATUS_KEYS = [
  { value: "received", color: "bg-gray-500 text-white" },
  { value: "under_inspection", color: "bg-yellow-500 text-black" },
  { value: "waiting_parts", color: "bg-orange-500 text-white" },
  { value: "in_repair", color: "bg-blue-500 text-white" },
  { value: "completed", color: "bg-green-500 text-white" },
  { value: "delivered", color: "bg-teal-500 text-white" },
];

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: repair, isLoading } = useGetRepair(Number(id), { query: { enabled: !!id } as any });
  const updateStatus = useUpdateRepairStatus();
  const updateRepair = useUpdateRepair();
  const { t } = useTranslation();

  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [repairCost, setRepairCost] = useState("");

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    updateStatus.mutate(
      { id: Number(id), data: { status: newStatus as any, technicianNotes: notes || undefined } },
      {
        onSuccess: () => {
          toast.success(t("repairs.status_updated"));
          setNewStatus("");
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(Number(id)) });
          queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
        },
        onError: () => toast.error(t("repairs.status_failed")),
      }
    );
  };

  const handleMarkPaid = () => {
    const cost = repairCost ? Number(repairCost) : undefined;
    updateRepair.mutate(
      { id: Number(id), data: { isPaid: true, ...(cost ? { repairCost: cost } : {}) } },
      {
        onSuccess: () => {
          toast.success(t("repairs.mark_paid_success"));
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(Number(id)) });
        },
        onError: () => toast.error(t("repairs.mark_paid_failed")),
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!repair) return <div className="text-center py-8 text-muted-foreground">{t("repairs.not_found")}</div>;

  const statusInfo = STATUS_KEYS.find(s => s.value === repair.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/repairs">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{repair.ticketNumber}</h1>
            <p className="text-sm text-muted-foreground">{t("repairs.created_date", { date: format(new Date(repair.createdAt), "MMM d, yyyy HH:mm") })}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="me-2 h-4 w-4" /> {t("repairs.print_receipt")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("repairs.device_info")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">{t("repairs.device_type_required").replace(" *", "")}</div>
                <div className="font-medium capitalize">{t(`repairs.device_type_${repair.deviceType}`)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("repairs.brand_model")}</div>
                <div className="font-medium">{[repair.deviceBrand, repair.deviceModel].filter(Boolean).join(" ") || "—"}</div>
              </div>
              {repair.imei && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">{t("repairs.imei_serial")}</div>
                  <div className="font-mono font-medium">{repair.imei}</div>
                </div>
              )}
              <div className="col-span-2">
                <div className="text-muted-foreground mb-1">{t("repairs.problem_desc")}</div>
                <div className="bg-muted/50 rounded p-3">{repair.problemDescription}</div>
              </div>
              {repair.technicianNotes && (
                <div className="col-span-2">
                  <div className="text-muted-foreground mb-1">{t("repairs.tech_notes_label")}</div>
                  <div className="bg-muted/50 rounded p-3">{repair.technicianNotes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("repairs.update_status")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("repairs.select_status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_KEYS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{t(`repairs.status_${s.value}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleStatusUpdate} disabled={!newStatus || updateStatus.isPending}>
                  {updateStatus.isPending ? t("common.updating") : t("repairs.update_btn")}
                </Button>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">{t("repairs.tech_notes_optional")}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("repairs.add_notes")} rows={3} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("common.status")}</CardTitle></CardHeader>
            <CardContent>
              <Badge variant="outline" className={`border-transparent text-sm px-3 py-1 ${statusInfo?.color || "bg-gray-500 text-white"}`}>
                {t(`repairs.status_${repair.status}`)}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("repairs.customer")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{repair.customerName || t("repairs.walk_in")}</div>
              {repair.customerPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {repair.customerPhone}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("repairs.payment")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">{t("repairs.estimated")}</div>
                <div className="font-medium text-end">{repair.estimatedCost ? Number(repair.estimatedCost).toFixed(2) : "—"}</div>
                <div className="text-muted-foreground">{t("repairs.final_cost")}</div>
                <div className="font-medium text-end">{repair.repairCost ? Number(repair.repairCost).toFixed(2) : "—"}</div>
                <div className="text-muted-foreground">{t("common.paid")}</div>
                <div className="text-end">
                  {repair.isPaid
                    ? <span className="text-green-500 font-medium">{t("common.yes")}</span>
                    : <span className="text-destructive font-medium">{t("common.no")}</span>}
                </div>
              </div>
              {!repair.isPaid && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder={t("repairs.cost_placeholder")} value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
                    <Button size="sm" onClick={handleMarkPaid} disabled={updateRepair.isPending}>
                      <CheckCircle className="me-1 h-4 w-4" /> {t("common.paid")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
