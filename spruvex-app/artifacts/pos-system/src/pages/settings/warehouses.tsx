import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowLeftRight, Plus, Trash2, Warehouse } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface WarehouseItem {
  id: number;
  name: string;
  isRepairStock: boolean;
}

export default function WarehousesSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [isRepairStock, setIsRepairStock] = useState(false);

  const { data: warehouses, isLoading } = useQuery<WarehouseItem[]>({
    queryKey: ["warehouses"],
    queryFn: () => api("/warehouses"),
  });

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; isRepairStock: boolean }) =>
      api("/warehouses", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setDialogOpen(false);
      setName("");
      setIsRepairStock(false);
      toast.success(t("warehouses.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("warehouses.title")}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/movements">
            <Button variant="outline">
              <ArrowLeftRight className="me-2 h-4 w-4" />
              {t("warehouses.transfer_stock")}
            </Button>
          </Link>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("warehouses.add")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("warehouses.list_title")}</CardTitle>
          <CardDescription>{t("warehouses.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {warehouses?.map(w => (
            <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Warehouse className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{w.name}</div>
                  {w.isRepairStock && <div className="text-xs text-muted-foreground">{t("warehouses.repair_stock")}</div>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(w.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("warehouses.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("warehouses.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("warehouses.name_placeholder")} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">{t("warehouses.is_repair_stock")}</Label>
              <Switch checked={isRepairStock} onCheckedChange={setIsRepairStock} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={createMutation.isPending || !name.trim()} onClick={() => createMutation.mutate({ name: name.trim(), isRepairStock })}>
              {createMutation.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
