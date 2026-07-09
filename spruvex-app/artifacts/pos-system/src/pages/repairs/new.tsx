import { useCreateRepair, useGetCustomers, getGetRepairsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";
import { QuickAddCustomerDialog } from "@/components/QuickAddCustomerDialog";
import { useState } from "react";

export default function NewRepairPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createRepair = useCreateRepair();
  const { data: customers, refetch: refetchCustomers } = useGetCustomers();
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<any>();
  const { t } = useTranslation();
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

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
    if (data.customerId) payload.customerId = Number(data.customerId);
    if (data.deviceBrand) payload.deviceBrand = data.deviceBrand;
    if (data.deviceModel) payload.deviceModel = data.deviceModel;
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
                      const c = customers?.find(c => c.id === Number(val));
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
                <Input {...register("deviceBrand")} placeholder={t("repairs.brand_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("repairs.model")}</Label>
                <Input {...register("deviceModel")} placeholder={t("repairs.model_placeholder")} />
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
    </div>
  );
}
