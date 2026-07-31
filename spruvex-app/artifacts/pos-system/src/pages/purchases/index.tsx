import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProducts, useGetSettings } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Undo2, Printer, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { openServerPrint } from "@/utils/openServerPrint";

interface Purchase {
  id: string;
  productId: string;
  supplierId: string;
  supplierName: string | null;
  quantity: number;
  returnedQuantity: number;
  totalCost: string;
  amountPaid: string;
  createdAt: string;
}

export default function PurchasesPage() {
  const { t } = useTranslation();
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: purchases, isLoading, isError, refetch } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: () => api("/purchases"),
  });
  const { data: products } = useGetProducts();
  const { data: settings } = useGetSettings();
  const printType = settings?.invoiceType ?? "a4";

  const productName = (productId: string) =>
    products?.find(p => String(p.id) === String(productId))?.name ?? productId;

  // Purchase invoice documents are on-demand too — created (or idempotently
  // reused) only when printed, same pattern as sales invoices.
  const [printingPurchaseId, setPrintingPurchaseId] = useState<string | null>(null);
  const handlePrintPurchase = async (purchase: Purchase) => {
    setPrintingPurchaseId(purchase.id);
    try {
      const doc = await api<{ id: string }>(`/purchase-invoices/from-purchase/${purchase.id}`, { method: "POST" });
      await openServerPrint(`/invoicing/print/purchases/${doc.id}?printType=${printType}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPrintingPurchaseId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("purchases.title")}</h1>
        <Button onClick={() => setNewPurchaseOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> {t("purchases.new_purchase")}
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <p className="text-sm text-muted-foreground">{t("purchases.subtitle")}</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("purchases.product")}</TableHead>
                <TableHead>{t("suppliers.title")}</TableHead>
                <TableHead className="text-end">{t("purchases.quantity")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
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
              ) : purchases?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("purchases.empty")}</TableCell>
                </TableRow>
              ) : (
                purchases?.map((purchase) => {
                  const available = purchase.quantity - (purchase.returnedQuantity ?? 0);
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell className="text-sm">{format(new Date(purchase.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>{productName(purchase.productId)}</TableCell>
                      <TableCell>{purchase.supplierName || "—"}</TableCell>
                      <TableCell className="text-end">
                        {purchase.quantity}
                        {purchase.returnedQuantity > 0 && (
                          <Badge variant="secondary" className="ms-2">{t("purchases.returned", { count: purchase.returnedQuantity })}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end font-medium">{Number(purchase.totalCost).toFixed(2)}</TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={printingPurchaseId === purchase.id}
                          onClick={() => handlePrintPurchase(purchase)}
                        >
                          <Printer className="me-2 h-3.5 w-3.5" />
                          {t("purchases.print_invoice")}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={available <= 0} onClick={() => setReturnPurchase(purchase)}>
                          <Undo2 className="me-2 h-3.5 w-3.5" />
                          {t("purchases.return")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {returnPurchase && (
        <PurchaseReturnDialog
          purchase={returnPurchase}
          productLabel={productName(returnPurchase.productId)}
          onClose={() => setReturnPurchase(null)}
        />
      )}

      {newPurchaseOpen && (
        <NewPurchaseDialog
          onClose={() => setNewPurchaseOpen(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["purchases"] })}
        />
      )}
    </div>
  );
}

interface SupplierOption { id: string; name: string; }
interface ProductOption { id: string; name: string; sku: string; costPrice: string; }

interface PurchaseLine {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
}

// The backend has no multi-line purchase-invoice concept (POST /purchases
// creates exactly one purchases row per product — see purchaseService.ts).
// Rather than add a new grouping table/migration for a beta-polish pass,
// this dialog is a real multi-product cart client-side and submits one
// POST /purchases call per line sequentially, all against the same
// supplier — each line still gets its own accurate stock movement and
// supplier-debt entry (already proven correct), it just isn't wrapped in a
// single "invoice header" row. Discount is applied by proportionally
// reducing each line's totalCost before it's sent; amountPaid is
// distributed the same way.
function NewPurchaseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([
    { key: crypto.randomUUID(), productId: "", quantity: "1", unitCost: "" },
  ]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [taxPercent, setTaxPercent] = useState("0");
  const [amountPaid, setAmountPaid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: suppliers } = useQuery<SupplierOption[]>({
    queryKey: ["suppliers"],
    queryFn: () => api("/suppliers"),
  });
  const { data: products } = useQuery<ProductOption[]>({
    queryKey: ["products-for-purchase"],
    queryFn: () => api("/products"),
  });

  const addLine = () => setLines(prev => [...prev, { key: crypto.randomUUID(), productId: "", quantity: "1", unitCost: "" }]);
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));
  const updateLine = (key: string, patch: Partial<PurchaseLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const onProductChange = (key: string, productId: string) => {
    const product = products?.find(p => String(p.id) === productId);
    updateLine(key, { productId, unitCost: product ? product.costPrice : "" });
  };

  const lineTotal = (line: PurchaseLine) => (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountAmount = subtotal * ((Number(discountPercent) || 0) / 100);
  const taxAmount = (subtotal - discountAmount) * ((Number(taxPercent) || 0) / 100);
  const grandTotal = subtotal - discountAmount + taxAmount;
  const paidNum = Math.min(Number(amountPaid) || 0, grandTotal);

  // A freshly-added, still-empty row (no product picked yet) isn't a
  // mistake to block on — it's just an unused slot. Only a row where the
  // merchant started picking a product but left quantity/cost incomplete
  // counts as invalid and blocks submission.
  const attemptedLines = lines.filter(l => l.productId);
  const validLines = attemptedLines.filter(l => Number(l.quantity) > 0 && Number(l.unitCost) >= 0);
  const isValid = !!supplierId && attemptedLines.length > 0 && validLines.length === attemptedLines.length && subtotal > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      for (const line of validLines) {
        const rawTotal = lineTotal(line);
        const lineShare = subtotal > 0 ? rawTotal / subtotal : 0;
        const discountedTotal = rawTotal - discountAmount * lineShare + taxAmount * lineShare;
        const linePaid = paidNum * lineShare;
        await api("/purchases", {
          method: "POST",
          body: JSON.stringify({
            productId: line.productId,
            supplierId,
            quantity: Number(line.quantity),
            totalCost: Math.round(discountedTotal * 100) / 100,
            amountPaid: Math.round(linePaid * 100) / 100,
          }),
        });
      }
      toast.success(t("purchases.create_success"));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("purchases.new_purchase")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("suppliers.title")}</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder={t("purchases.select_supplier")} /></SelectTrigger>
              <SelectContent>
                {suppliers?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("purchases.items")}</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lines.map(line => (
                <div key={line.key} className="flex gap-2 items-start">
                  <Select value={line.productId} onValueChange={v => onProductChange(line.key, v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t("purchases.select_product")} /></SelectTrigger>
                    <SelectContent>
                      {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min={1} step={1} placeholder={t("purchases.quantity")}
                    className="w-20" value={line.quantity}
                    onChange={e => updateLine(line.key, { quantity: e.target.value })}
                  />
                  <Input
                    type="number" min={0} step="0.01" placeholder={t("purchases.unit_cost")}
                    className="w-28" value={line.unitCost}
                    onChange={e => updateLine(line.key, { unitCost: e.target.value })}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="me-1.5 h-3.5 w-3.5" /> {t("purchases.add_line")}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("purchases.discount_percent")}</Label>
              <Input type="number" min={0} max={100} step="0.01" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("purchases.tax_percent")}</Label>
              <Input type="number" min={0} max={100} step="0.01" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("purchases.amount_paid")}</Label>
              <Input type="number" min={0} step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {attemptedLines.length > 0 && validLines.length < attemptedLines.length && (
            <p className="text-sm text-destructive">{t("purchases.incomplete_line_warning")}</p>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("purchases.subtotal")}</span><span>{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("purchases.discount_amount")}</span><span>-{discountAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("purchases.tax_amount")}</span><span>+{taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>{t("purchases.total")}</span><span>{grandTotal.toFixed(2)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!isValid || isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? t("common.saving") : t("purchases.create_purchase")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseReturnDialog({
  purchase, productLabel, onClose,
}: {
  purchase: Purchase;
  productLabel: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();
  const printType = settings?.invoiceType ?? "a4";
  const available = purchase.quantity - (purchase.returnedQuantity ?? 0);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "credit_note">("credit_note");

  const returnMutation = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/purchases/${purchase.id}/returns`, {
        method: "POST",
        body: JSON.stringify({ quantity: Number(quantity), reason: reason || undefined, refundMethod }),
      }),
    onSuccess: async (ret) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(t("purchases.return_success"));
      onClose();
      // Best-effort: issue and print the purchase-return debit note. Unlike
      // sales credit notes this never fails on "no prior document" (purchase
      // documents are plain records, not chained to a required original).
      try {
        const doc = await api<{ id: string }>(`/purchase-invoices/from-return/${ret.id}`, { method: "POST" });
        await openServerPrint(`/invoicing/print/purchases/${doc.id}?printType=${printType}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.error"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const qtyNum = Number(quantity);
  const isValid = qtyNum > 0 && qtyNum <= available;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("purchases.return_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="font-medium text-sm">{productLabel}</div>
            <div className="text-xs text-muted-foreground">
              {t("purchases.available_to_return", { count: available })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("purchases.return_quantity")}</Label>
            <Input
              type="number"
              min={1}
              max={available}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("purchases.refund_method")}</Label>
            <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as "cash" | "credit_note")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_note">{t("purchases.refund_credit_note")}</SelectItem>
                <SelectItem value="cash">{t("purchases.refund_cash")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("purchases.return_reason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={returnMutation.isPending || !isValid} onClick={() => returnMutation.mutate()}>
            {returnMutation.isPending ? t("common.saving") : t("purchases.return_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
