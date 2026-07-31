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
import { ArrowLeft, Printer, Phone, CheckCircle, UserCog, ShieldCheck, Wrench, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface RepairUser {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

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
  const { data: repair, isLoading } = useGetRepair((id as any), { query: { enabled: !!id } as any });
  const updateStatus = useUpdateRepairStatus();
  const updateRepair = useUpdateRepair();
  const { t } = useTranslation();

  // totalCost/technicianId/approvedAt aren't in the generated OpenAPI client yet — the API
  // route already returns them (see artifacts/api-server/src/routes/repairs.ts), so read
  // them off the same response the generated hook already fetched.
  const repairExtra = repair as unknown as { totalCost?: number; technicianId?: string | null; approvedAt?: string | null } | undefined;

  const { data: users } = useQuery<RepairUser[]>({
    queryKey: ["auth-users"],
    queryFn: () => authFetch("/auth/users"),
  });

  interface RepairPart { id: string; repairId: string; productId: string | null; partName: string; quantity: number; partCost: string; laborFee: string; }

  const { data: parts, refetch: refetchParts } = useQuery<RepairPart[]>({
    queryKey: ["repair-parts", id],
    queryFn: () => authFetch(`/repair-parts?repairId=${id}`),
    enabled: !!id,
  });

  const [showAddPart, setShowAddPart] = useState(false);
  const [addPartName, setAddPartName] = useState("");
  const [addProductId, setAddProductId] = useState<string | null>(null);
  const [addPartQty, setAddPartQty] = useState("1");
  const [addPartCost, setAddPartCost] = useState("");
  const [addPartFee, setAddPartFee] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    setSearching(true);
    try {
      const res = await authFetch(`/products?search=${encodeURIComponent(q)}&limit=8`);
      setProductResults(Array.isArray(res) ? res : []);
    } catch {
      setProductResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectProduct = (p: any) => {
    setAddProductId(p.id);
    setAddPartName(p.name);
    setAddPartCost(p.costPrice ? String(p.costPrice) : "");
    setProductSearch("");
    setProductResults([]);
  };

  const addPartMutation = useMutation({
    mutationFn: () => authFetch("/repair-parts", {
      method: "POST",
      body: JSON.stringify({
        repairId: id,
        partName: addPartName.trim(),
        productId: addProductId,
        quantity: Number(addPartQty) || 1,
        partCost: Number(addPartCost) || 0,
        laborFee: Number(addPartFee) || 0,
      }),
    }),
    onSuccess: () => {
      refetchParts();
      setShowAddPart(false);
      setAddPartName("");
      setAddProductId(null);
      setAddPartQty("1");
      setAddPartCost("");
      setAddPartFee("");
      setProductSearch("");
      toast.success(t("repairs.part_added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePart = useMutation({
    mutationFn: (partId: string) => authFetch(`/repair-parts/${partId}`, { method: "DELETE" }),
    onSuccess: () => { refetchParts(); toast.success(t("repairs.part_deleted")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignTechnician = useMutation({
    mutationFn: (technicianId: string | null) =>
      authFetch(`/repairs/${id}/technician`, { method: "PATCH", body: JSON.stringify({ technicianId }) }),
    onSuccess: () => {
      toast.success(t("repairs.technician_assigned"));
      queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey((id as any)) });
    },
    onError: () => toast.error(t("repairs.technician_assign_failed")),
  });

  const approveRepair = useMutation({
    mutationFn: () => authFetch(`/repairs/${id}/approve`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success(t("repairs.approved_success"));
      queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey((id as any)) });
    },
    onError: () => toast.error(t("repairs.approved_failed")),
  });

  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [repairCost, setRepairCost] = useState("");

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    updateStatus.mutate(
      { id: (id as any), data: { status: newStatus as any, technicianNotes: notes || undefined } },
      {
        onSuccess: () => {
          toast.success(t("repairs.status_updated"));
          setNewStatus("");
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey((id as any)) });
          queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
        },
        onError: () => toast.error(t("repairs.status_failed")),
      }
    );
  };

  const handleMarkPaid = () => {
    const cost = repairCost ? Number(repairCost) : undefined;
    updateRepair.mutate(
      { id: (id as any), data: { isPaid: true, ...(cost ? { repairCost: cost } : {}) } },
      {
        onSuccess: () => {
          toast.success(t("repairs.mark_paid_success"));
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey((id as any)) });
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  {t("repairs.parts_used")}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowAddPart(!showAddPart)}>
                  <Plus className="me-1 h-3.5 w-3.5" />
                  {t("repairs.parts_add")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddPart && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 mb-3">
                  <div className="space-y-1.5 relative">
                    <Label className="text-xs">{t("repairs.search_product")}</Label>
                    <Input value={productSearch} onChange={e => searchProducts(e.target.value)} placeholder={t("repairs.search_product_placeholder")} className="h-8 text-sm" />
                    {productResults.length > 0 && (
                      <div className="absolute z-10 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                        {productResults.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-start px-3 py-2 text-sm hover:bg-accent flex justify-between"
                            onClick={() => selectProduct(p)}
                          >
                            <span>{p.name}</span>
                            <span className="text-muted-foreground text-xs">{t("common.stock")}: {p.stock}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searching && <div className="text-xs text-muted-foreground mt-1">{t("common.searching")}...</div>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("repairs.part_name")}</Label>
                    <Input value={addPartName} onChange={e => { setAddPartName(e.target.value); setAddProductId(null); }} placeholder={t("repairs.part_name_placeholder")} className="h-8 text-sm" />
                    {addProductId && <div className="text-[10px] text-emerald-600">{t("repairs.linked_to_inventory")}</div>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("repairs.quantity")}</Label>
                      <Input type="number" min="1" step="1" value={addPartQty} onChange={e => setAddPartQty(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("repairs.part_cost")}</Label>
                      <Input type="number" min="0" step="0.01" value={addPartCost} onChange={e => setAddPartCost(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("repairs.labor_fee")}</Label>
                      <Input type="number" min="0" step="0.01" value={addPartFee} onChange={e => setAddPartFee(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => addPartMutation.mutate()} disabled={!addPartName.trim() || addPartMutation.isPending}>
                      {addPartMutation.isPending ? t("common.saving") : t("common.add")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddPart(false)}>{t("common.cancel")}</Button>
                  </div>
                </div>
              )}
              {!parts || parts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("repairs.no_parts")}</p>
              ) : (
                <div className="space-y-2">
                  {parts.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.partName}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("pos.items")}: {p.quantity} · {t("repairs.part_cost")}: {Number(p.partCost).toFixed(2)} · {t("repairs.labor_fee")}: {Number(p.laborFee).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-semibold ms-3 shrink-0">
                        {((Number(p.partCost) + Number(p.laborFee)) * p.quantity).toFixed(2)}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 ms-1 text-destructive" onClick={() => {
                        if (window.confirm(t("repairs.part_delete_confirm"))) deletePart.mutate(p.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
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
            <CardContent className="space-y-3">
              <Badge variant="outline" className={`border-transparent text-sm px-3 py-1 ${statusInfo?.color || "bg-gray-500 text-white"}`}>
                {t(`repairs.status_${repair.status}`)}
              </Badge>
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">{t("repairs.customer_approval")}</span>
                {repairExtra?.approvedAt ? (
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" /> {t("repairs.approved_on", { date: format(new Date(repairExtra.approvedAt), "MMM d, yyyy HH:mm") })}
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => approveRepair.mutate()} disabled={approveRepair.isPending}>
                    {approveRepair.isPending ? t("common.updating") : t("repairs.mark_approved")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("repairs.technician")}</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={repairExtra?.technicianId ? String(repairExtra.technicianId) : "unassigned"}
                onValueChange={(value) => assignTechnician.mutate(value === "unassigned" ? null : value)}
                disabled={assignTechnician.isPending}
              >
                <SelectTrigger>
                  <UserCog className="me-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={t("repairs.select_technician")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t("repairs.unassigned")}</SelectItem>
                  {users?.filter(u => u.isActive).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <div className="text-muted-foreground">{t("repairs.total_cost")}</div>
                <div className="font-medium text-end">{repairExtra?.totalCost !== undefined ? repairExtra.totalCost.toFixed(2) : "—"}</div>
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
