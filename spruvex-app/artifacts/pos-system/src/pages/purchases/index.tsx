import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProducts } from "@workspace/api-client-react";
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
import { Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

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

  const { data: purchases, isLoading } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: () => api("/purchases"),
  });
  const { data: products } = useGetProducts();

  const productName = (productId: string) =>
    products?.find(p => String(p.id) === String(productId))?.name ?? productId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("purchases.title")}</h1>
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
    </div>
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
  const available = purchase.quantity - (purchase.returnedQuantity ?? 0);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "credit_note">("credit_note");

  const returnMutation = useMutation({
    mutationFn: () =>
      api(`/purchases/${purchase.id}/returns`, {
        method: "POST",
        body: JSON.stringify({ quantity: Number(quantity), reason: reason || undefined, refundMethod }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(t("purchases.return_success"));
      onClose();
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
