import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Truck, Phone } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  outstandingBalance: string;
}

export default function SuppliersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Supplier | "new" | null>(null);

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers", search],
    queryFn: () => api(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const saveMutation = useMutation({
    mutationFn: (vars: Partial<Supplier> & { id?: number }) =>
      vars.id
        ? api(`/suppliers/${vars.id}`, { method: "PUT", body: JSON.stringify(vars) })
        : api("/suppliers", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialog(null);
      toast.success(t("suppliers.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("suppliers.title")}</h1>
        <Button onClick={() => setDialog("new")}>
          <Plus className="me-2 h-4 w-4" />
          {t("suppliers.add")}
        </Button>
      </div>

      <Input
        placeholder={t("suppliers.search_placeholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        {suppliers?.length === 0 && (
          <p className="text-muted-foreground text-sm col-span-full">{t("suppliers.empty")}</p>
        )}
        {suppliers?.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-medium">{s.name}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              {s.phone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {s.phone}
                </div>
              )}
              {Number(s.outstandingBalance) > 0 && (
                <div className="text-sm text-destructive">
                  {t("suppliers.outstanding", { amount: s.outstandingBalance })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {dialog && (
        <SupplierDialog
          supplier={dialog === "new" ? null : dialog}
          onClose={() => setDialog(null)}
          onSave={(vars) => saveMutation.mutate(vars)}
          isPending={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function SupplierDialog({
  supplier, onClose, onSave, isPending,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (vars: Partial<Supplier> & { id?: number }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? t("suppliers.edit") : t("suppliers.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("suppliers.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={isPending || !name.trim()}
            onClick={() => onSave({
              id: supplier?.id,
              name: name.trim(),
              phone: phone || null,
              email: email || null,
              address: address || null,
              notes: notes || null,
            })}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
