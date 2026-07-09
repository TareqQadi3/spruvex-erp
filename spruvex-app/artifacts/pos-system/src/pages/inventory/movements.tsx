import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProducts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface WarehouseItem {
  id: string;
  name: string;
  isRepairStock: boolean;
}

interface StockMovementRow {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  movementType: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
}

interface PaginatedMovements {
  data: StockMovementRow[];
  meta: { page: number; pageSize: number; total: number };
}

const MOVEMENT_BADGE: Record<string, string> = {
  adjustment_in: "bg-green-500/10 text-green-700 border-green-500/20",
  adjustment_out: "bg-red-500/10 text-red-700 border-red-500/20",
  transfer_in: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  transfer_out: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  sale: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  sale_return: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  reservation: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  reservation_release: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

function TransferStockDialog({ warehouses, onDone }: { warehouses: WarehouseItem[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const { data: products } = useGetProducts(productSearch ? { search: productSearch } : undefined);

  const transferMutation = useMutation({
    mutationFn: () =>
      api("/inventory/stock/transfer", {
        method: "POST",
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: Number(quantity),
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t("inventory_movements.transfer_success"));
      setOpen(false);
      setProductId("");
      setProductSearch("");
      setFromWarehouseId("");
      setToWarehouseId("");
      setQuantity("");
      setNotes("");
      onDone();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = productId && fromWarehouseId && toWarehouseId && fromWarehouseId !== toWarehouseId && Number(quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="me-2 h-4 w-4" />
          {t("inventory_movements.transfer_stock")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inventory_movements.transfer_stock")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("inventory_movements.product")}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder={t("inventory_movements.select_product")} />
              </SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={String(p.id)} value={String(p.id)}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-1.5"
              placeholder={t("inventory_movements.search_product_placeholder")}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("inventory_movements.from_warehouse")}</Label>
              <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("inventory_movements.select_warehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("inventory_movements.to_warehouse")}</Label>
              <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("inventory_movements.select_warehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("inventory_movements.quantity")}</Label>
            <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("inventory_movements.notes_optional")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("inventory_movements.notes_placeholder")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={!canSubmit || transferMutation.isPending} onClick={() => transferMutation.mutate()}>
            {transferMutation.isPending ? t("common.saving") : t("inventory_movements.transfer_stock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StockMovementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: warehouses } = useQuery<WarehouseItem[]>({
    queryKey: ["warehouses"],
    queryFn: () => api("/warehouses"),
  });

  const { data: products } = useGetProducts();

  const queryKey = ["stock-movements", { productFilter, warehouseFilter, dateFrom, dateTo, page }];
  const { data, isLoading } = useQuery<PaginatedMovements>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (productFilter) params.set("productId", productFilter);
      if (warehouseFilter) params.set("warehouseId", warehouseFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      return api(`/inventory/stock/movements?${params.toString()}`);
    },
  });

  const movements = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetToFirstPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("inventory_movements.title")}</h1>
        </div>
        <TransferStockDialog
          warehouses={warehouses ?? []}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["stock-movements"] })}
        />
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("inventory_movements.product")}</Label>
              <Select
                value={productFilter || "all"}
                onValueChange={(v) => { setProductFilter(v === "all" ? "" : v); resetToFirstPage(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("inventory_movements.all_products")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("inventory_movements.all_products")}</SelectItem>
                  {products?.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("inventory_movements.warehouse")}</Label>
              <Select
                value={warehouseFilter || "all"}
                onValueChange={(v) => { setWarehouseFilter(v === "all" ? "" : v); resetToFirstPage(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("inventory_movements.all_warehouses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("inventory_movements.all_warehouses")}</SelectItem>
                  {warehouses?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("inventory_movements.date_from")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetToFirstPage(); }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("inventory_movements.date_to")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetToFirstPage(); }} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("inventory_movements.product")}</TableHead>
                <TableHead>{t("inventory_movements.warehouse")}</TableHead>
                <TableHead>{t("inventory_movements.type")}</TableHead>
                <TableHead className="text-end">{t("inventory_movements.quantity")}</TableHead>
                <TableHead>{t("inventory_movements.performed_by")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map((j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("inventory_movements.no_movements")}</TableCell>
                </TableRow>
              ) : (
                movements.map((m) => {
                  const isPositive = ["adjustment_in", "transfer_in", "sale_return", "reservation_release"].includes(m.movementType);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(m.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{m.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.productSku}</div>
                      </TableCell>
                      <TableCell>{m.warehouseName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={MOVEMENT_BADGE[m.movementType] ?? ""}>
                          {t(`inventory_movements.type_${m.movementType}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-end font-medium ${isPositive ? "text-green-600" : "text-destructive"}`}>
                        {isPositive ? "+" : "-"}{m.quantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.createdByUsername ?? t("inventory_movements.system")}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("inventory_movements.page_of", { page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
