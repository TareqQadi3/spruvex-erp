import { useCreateRepair, useGetCustomers, useGetBrands, useCreateBrand, getGetRepairsQueryKey, getGetBrandsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";
import { QuickAddCustomerDialog } from "@/components/QuickAddCustomerDialog";
import { useState } from "react";
import { api } from "@/lib/api";

interface DeviceModel { id: string; name: string; brandId: string; }

export default function NewRepairPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createRepair = useCreateRepair();
  const { data: customers, refetch: refetchCustomers } = useGetCustomers();
  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<any>();
  const { t } = useTranslation();
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

  const { data: brands, refetch: refetchBrands } = useGetBrands();
  const createBrand = useCreateBrand();
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");

  const selectedBrandId = watch("deviceBrandId");
  const { data: models, refetch: refetchModels } = useQuery<DeviceModel[]>({
    queryKey: ["device-models", selectedBrandId],
    queryFn: () => api(`/device-models?brandId=${selectedBrandId}`),
    enabled: !!selectedBrandId,
  });

  const handleCreateBrand = () => {
    if (!newBrandName.trim()) return;
    createBrand.mutate({ data: { name: newBrandName.trim() } }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetBrandsQueryKey() });
        refetchBrands();
        setValue("deviceBrandId", String((created as any).id));
        setNewBrandName("");
        setIsBrandDialogOpen(false);
        toast.success(t("inventory.brand_created"));
      },
      onError: () => toast.error(t("inventory.brand_create_failed")),
    });
  };

  const handleCreateModel = async () => {
    if (!newModelName.trim() || !selectedBrandId) return;
    try {
      const created = await api<DeviceModel>("/device-models", {
        method: "POST",
        body: JSON.stringify({ brandId: selectedBrandId, name: newModelName.trim() }),
      });
      await refetchModels();
      setValue("deviceModelId", String(created.id));
      setNewModelName("");
      setIsModelDialogOpen(false);
      toast.success(t("repairs.model_created"));
    } catch {
      toast.error(t("repairs.model_create_failed"));
    }
  };

  const DEVICE_TYPES = [
    { value: "mobile", label: t("repairs.device_type_mobile") },
    { value: "laptop", label: t("repairs.device_type_laptop") },
    { value: "tablet", label: t("repairs.device_type_tablet") },
    { value: "desktop", label: t("repairs.device_type_desktop") },
    { value: "other", label: t("repairs.device_type_other") },
  ];

  const onSubmit = (data: any) => {
    const payload: any = {
      deviceType: data.deviceType,
      problemDescription: data.problemDescription,
    };
    if (data.customerId) payload.customerId = data.customerId;
    if (data.deviceBrandId) {
      const brand = brands?.find(b => String(b.id) === data.deviceBrandId);
      if (brand) payload.deviceBrand = brand.name;
    }
    if (data.deviceModelId) {
      const model = models?.find(m => String(m.id) === data.deviceModelId);
      if (model) payload.deviceModel = model.name;
    }
    if (data.imei) payload.imei = data.imei;
    if (data.estimatedCost) payload.estimatedCost = Number(data.estimatedCost);
    if (data.technicianNotes) payload.technicianNotes = data.technicianNotes;

    createRepair.mutate({ data: payload }, {
      onSuccess: (repair) => {
        toast.success(t("repairs.ticket_created", { number: (repair as any).ticketNumber }));
        queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
        navigate("/repairs");
      },
      onError: () => toast.error(t("repairs.create_failed")),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/repairs">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("repairs.new_title")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("repairs.customer")}</CardTitle>
                <QuickAddCustomerDialog
                  onCreated={async (c) => {
                    await refetchCustomers();
                    setValue("customerId", String(c.id));
                    setSelectedCustomerName(c.name);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={val => {
                      field.onChange(val);
                      const c = customers?.find((c: any) => c.id === val);
                      setSelectedCustomerName(c?.name ?? "");
                    }}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("repairs.select_customer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} {c.phone ? `— ${c.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {selectedCustomerName && (
                <p className="text-xs text-primary font-medium">{t("repairs.customer")}: {selectedCustomerName}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("repairs.device_info")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("repairs.device_type_required")}</Label>
                <Controller
                  name="deviceType"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={errors.deviceType ? "border-destructive" : ""}>
                        <SelectValue placeholder={t("repairs.device_type_required")} />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_TYPES.map(dt => (
                          <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("repairs.brand")}</Label>
                <div className="flex gap-2">
                  <Controller
                    name="deviceBrandId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={v => { field.onChange(v); setValue("deviceModelId", ""); }}
                        value={field.value}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("repairs.select_brand")} />
                        </SelectTrigger>
                        <SelectContent>
                          {brands?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setIsBrandDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("repairs.model")}</Label>
                <div className="flex gap-2">
                  <Controller
                    name="deviceModelId"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedBrandId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={selectedBrandId ? t("repairs.select_model") : t("repairs.select_brand_first")} />
                        </SelectTrigger>
                        <SelectContent>
                          {models?.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button type="button" variant="outline" size="icon" disabled={!selectedBrandId} onClick={() => setIsModelDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("repairs.imei")}</Label>
                <Input {...register("imei")} placeholder={t("repairs.imei_placeholder")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("repairs.problem_section")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("repairs.problem_required")}</Label>
                <Textarea
                  {...register("problemDescription", { required: true })}
                  placeholder={t("repairs.problem_placeholder")}
                  rows={4}
                  className={errors.problemDescription ? "border-destructive" : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("repairs.estimated_cost")}</Label>
                <Input type="number" step="0.01" {...register("estimatedCost")} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("repairs.tech_notes_optional")}</Label>
                <Textarea {...register("technicianNotes")} placeholder={t("repairs.tech_notes_placeholder")} rows={2} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href="/repairs">
              <Button type="button" variant="outline">{t("common.cancel")}</Button>
            </Link>
            <Button type="submit" disabled={createRepair.isPending}>
              {createRepair.isPending ? t("common.creating") : t("repairs.create_ticket")}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={isBrandDialogOpen} onOpenChange={setIsBrandDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inventory.new_brand_title")}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("inventory.brand_name")}</Label>
            <Input
              value={newBrandName}
              onChange={e => setNewBrandName(e.target.value)}
              placeholder={t("inventory.brand_placeholder")}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateBrand(); } }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBrandDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={handleCreateBrand} disabled={createBrand.isPending || !newBrandName.trim()}>
              {createBrand.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("repairs.new_model_title")}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("repairs.model_name")}</Label>
            <Input
              value={newModelName}
              onChange={e => setNewModelName(e.target.value)}
              placeholder={t("repairs.model_placeholder")}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateModel(); } }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsModelDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={handleCreateModel} disabled={!newModelName.trim()}>
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
