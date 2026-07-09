import { useState } from "react";
import { useGetCustomers, useDeleteCustomer, useCreateCustomer, getGetCustomersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Eye } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";

function NewCustomerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const createCustomer = useCreateCustomer();
  const { register, handleSubmit, reset } = useForm<any>();
  const { t } = useTranslation();

  const onSubmit = (data: any) => {
    createCustomer.mutate({ data }, {
      onSuccess: () => {
        toast.success(t("customers.save_success"));
        reset();
        setOpen(false);
        onCreated();
      },
      onError: () => toast.error(t("customers.save_failed")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="me-2 h-4 w-4" /> {t("customers.add_customer")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("customers.new_customer")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>{t("customers.full_name_required")}</Label>
              <Input {...register("name", { required: true })} placeholder={t("customers.name_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.phone")}</Label>
              <Input {...register("phone")} placeholder={t("customers.phone_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input {...register("email")} type="email" placeholder={t("customers.email_placeholder")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("common.address")}</Label>
              <Input {...register("address")} placeholder={t("customers.address_placeholder")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useGetCustomers(search ? { search } : undefined);
  const deleteCustomer = useDeleteCustomer();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(t("customers.delete_confirm", { name }))) {
      deleteCustomer.mutate({ id }, {
        onSuccess: () => {
          toast.success(t("customers.delete_success"));
          queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        },
        onError: () => toast.error(t("customers.delete_failed")),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("customers.title")}</h1>
        <NewCustomerDialog onCreated={() => queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() })} />
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("customers.search_placeholder")}
              className="ps-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.phone")}</TableHead>
                <TableHead>{t("common.email")}</TableHead>
                <TableHead className="text-end">{t("customers.purchases")}</TableHead>
                <TableHead className="text-end">{t("customers.balance")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-[80px]" /></TableCell>)}
                  </TableRow>
                ))
              ) : customers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("customers.no_customers")}</TableCell>
                </TableRow>
              ) : (
                customers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                    <TableCell className="text-end">
                      <Badge variant="secondary">{customer.totalPurchases}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      {Number(customer.outstandingBalance) > 0 ? (
                        <span className="text-destructive font-medium">{Number(customer.outstandingBalance).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end space-x-1">
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id, customer.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
