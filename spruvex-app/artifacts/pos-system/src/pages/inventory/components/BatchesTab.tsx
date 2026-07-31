import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface Batch { id: string; batchNumber: string; quantity: number; expiryDate: string | null; }

export function BatchesTab({ productId, authFetch }: {
  productId: string;
  authFetch: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const { t } = useTranslation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchNumber, setBatchNumber] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");

  const loadBatches = () => authFetch(`/products/${productId}/batches`).then(setBatches);
  useEffect(() => { loadBatches(); }, [productId]);

  const handleAddBatch = () => {
    if (!batchNumber.trim() || !batchQuantity) return;
    authFetch(`/products/${productId}/batches`, {
      method: "POST",
      body: JSON.stringify({ batchNumber: batchNumber.trim(), quantity: Number(batchQuantity), expiryDate: batchExpiry || undefined }),
    })
      .then(() => { toast.success(t("units.batch_created")); setBatchNumber(""); setBatchQuantity(""); setBatchExpiry(""); loadBatches(); })
      .catch(() => toast.error(t("units.batch_create_failed")));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("units.tab_batches")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {batches.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.batch_number")}</TableHead>
                  <TableHead>{t("inventory.stock_qty")}</TableHead>
                  <TableHead>{t("units.expiry_date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>
                    <TableCell>{b.quantity}</TableCell>
                    <TableCell>{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="grid grid-cols-4 gap-2 items-end">
            <div className="space-y-1.5">
              <Label>{t("units.batch_number")}</Label>
              <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="B-001" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("inventory.stock_qty")}</Label>
              <Input type="number" value={batchQuantity} onChange={e => setBatchQuantity(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("units.expiry_date")}</Label>
              <Input type="date" value={batchExpiry} onChange={e => setBatchExpiry(e.target.value)} />
            </div>
            <Button onClick={handleAddBatch}>{t("units.add_batch")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
