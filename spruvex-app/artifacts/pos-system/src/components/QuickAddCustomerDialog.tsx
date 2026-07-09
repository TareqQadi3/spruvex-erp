import { useState } from "react";
import { useCreateCustomer, getGetCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useTranslation } from "@/i18n";

interface Props {
  onCreated: (customer: { id: number; name: string; phone?: string | null }) => void;
  trigger?: React.ReactNode;
}

export function QuickAddCustomerDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const createCustomer = useCreateCustomer();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();
  const { t } = useTranslation();

  const onSubmit = (data: any) => {
    createCustomer.mutate({ data }, {
      onSuccess: (customer: any) => {
        toast.success(t("customers.save_success"));
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        onCreated({ id: customer.id, name: customer.name, phone: customer.phone });
        reset();
        setOpen(false);
      },
      onError: () => toast.error(t("customers.save_failed")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <UserPlus className="me-1.5 h-4 w-4" />
            {t("customers.add_customer")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("customers.new_customer")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("customers.full_name_required")}</Label>
            <Input
              {...register("name", { required: true })}
              placeholder={t("customers.name_placeholder")}
              className={errors.name ? "border-destructive" : ""}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("common.phone")}</Label>
              <Input {...register("phone")} placeholder={t("customers.phone_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input {...register("email")} type="email" placeholder={t("customers.email_placeholder")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? t("common.saving") : t("customers.save_customer")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
