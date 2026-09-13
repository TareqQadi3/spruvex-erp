import { useGetProducts, useDeleteProduct, useUpdateProduct, useGetSettings, useGetCategories, getGetProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Edit, History, FolderTree, Layers, AlertTriangle, Scale, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";

interface InventoryAlerts {
  lowStock: Array<{ id: string; name: string; stock: number }>;
  expired: Array<{ id: string; productName: string; batchNumber: string }>;
  expiringSoon: Array<{ id: string; productName: string; batchNumber: string; expiryDate: string }>;
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__all__");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const { data: products, isLoading, isError, refetch } = useGetProducts({
    ...(search ? { search } : {}),
    ...(categoryId !== "__all__" ? { categoryId: categoryId as any } : {}),
    ...(lowStockOnly ? { lowStock: true } : {}),
  });
  const { data: categories } = useGetCategories();
  const { data: settings } = useGetSettings();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();
  const { has: hasPermission } = usePermissions();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("__none__");
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const toggleSelectAll = () => {
    if (!products || products.length === 0) return;
    const allSelected = products.every(p => selectedIds.has(String(p.id)));
    setSelectedIds(allSelected ? new Set() : new Set(products.map(p => String(p.id))));
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (!window.confirm(t("inventory.bulk_delete_confirm", { count: selectedIds.size }))) return;
    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => deleteProduct.mutateAsync({ id } as any)));
    const failed = results.filter(r => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    setIsBulkWorking(false);
    clearSelection();
    if (failed > 0) {
      toast.error(t("inventory.bulk_delete_partial", { success: ids.length - failed, failed }));
    } else {
      toast.success(t("inventory.bulk_delete_success", { count: ids.length }));
    }
  };

  const handleBulkCategoryChange = async () => {
    setIsBulkWorking(true);
    const ids = Array.from(selectedIds);
    const categoryId = bulkCategoryId === "__none__" ? null : bulkCategoryId;
    const results = await Promise.allSettled(
      ids.map(id => updateProduct.mutateAsync({ id, data: { categoryId } } as any)),
    );
    const failed = results.filter(r => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    setIsBulkWorking(false);
    setBulkCategoryDialogOpen(false);
    clearSelection();
    if (failed > 0) {
      toast.error(t("inventory.bulk_category_partial", { success: ids.length - failed, failed }));
    } else {
      toast.success(t("inventory.bulk_category_success", { count: ids.length }));
    }
  };

  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch("/api/reports/inventory-alerts", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(setAlerts)
      .catch(() => {});
  }, []);
  const alertCount = alerts ? alerts.lowStock.length + alerts.expired.length + alerts.expiringSoon.length : 0;

  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const adjustMutation = useMutation({
    mutationFn: () => {
      const token = localStorage.getItem(TOKEN_KEY);
      return fetch("/api/inventory/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          productId: adjustProduct.id,
          quantity: Number(adjustQty),
          reason: adjustReason.trim() || undefined,
        }),
      }).then(r => r.ok ? r.json() : r.json().then(err => { throw new Error(err.error ?? "Adjustment failed"); }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustReason("");
      toast.success(t("inventory.stock_adjusted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = (id: number) => {
    if (window.confirm(t("inventory.delete_confirm"))) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast.success(t("inventory.delete_success"));
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        },
        onError: () => toast.error(t("inventory.delete_failed")),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("inventory.title")}</h1>
        <div className="flex gap-2">
          <Link href="/inventory/categories">
            <Button variant="outline"><FolderTree className="me-2 h-4 w-4" /> {t("inventory.categories")}</Button>
          </Link>
          <Link href="/inventory/movements">
            <Button variant="outline"><History className="me-2 h-4 w-4" /> {t("inventory.view_movements")}</Button>
          </Link>
          <Link href="/inventory/import">
            <Button variant="outline"><Upload className="me-2 h-4 w-4" /> {t("inventory.import_products")}</Button>
          </Link>
          {hasPermission("products.create") && (
            <Link href="/inventory/new">
              <Button><Plus className="me-2 h-4 w-4" /> {t("inventory.add_product")}</Button>
            </Link>
          )}
        </div>
      </div>

      {alertCount > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              {alerts!.lowStock.length > 0 && (
                <div><strong>{alerts!.lowStock.length}</strong> {t("inventory.alerts_low_stock")}</div>
              )}
              {alerts!.expired.length > 0 && (
                <div><strong>{alerts!.expired.length}</strong> {t("inventory.alerts_expired")}</div>
              )}
              {alerts!.expiringSoon.length > 0 && (
                <div><strong>{alerts!.expiringSoon.length}</strong> {t("inventory.alerts_expiring_soon")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("inventory.search_placeholder")}
                className="ps-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("inventory.filter_all_categories")}</SelectItem>
                {categories?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
              {t("inventory.filter_low_stock_only")}
            </label>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 mt-3">
              <span className="text-sm font-medium">{t("inventory.bulk_selected_count", { count: selectedIds.size })}</span>
              {hasPermission("products.update") && (
                <Button variant="outline" size="sm" onClick={() => { setBulkCategoryId("__none__"); setBulkCategoryDialogOpen(true); }} disabled={isBulkWorking}>
                  {t("inventory.bulk_change_category")}
                </Button>
              )}
              {hasPermission("products.delete") && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={handleBulkDelete} disabled={isBulkWorking}>
                  <Trash2 className="h-3.5 w-3.5 me-1.5" /> {t("inventory.bulk_delete")}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="ms-auto" onClick={clearSelection} disabled={isBulkWorking}>
                {t("inventory.bulk_clear_selection")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={!!products && products.length > 0 && products.every(p => selectedIds.has(String(p.id)))}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t("inventory.bulk_select_all")}
                  />
                </TableHead>
                <TableHead>{t("inventory.sku")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.category")}</TableHead>
                <TableHead className="text-end">{t("inventory.selling_price_required").replace(" *", "")}</TableHead>
                <TableHead className="text-end">{t("inventory.stock_qty")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={7}><QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : products?.length === 0 ? (
                <TableRow><TableCell colSpan={7}><EmptyState icon={Plus} title={t("inventory.no_products")} description={t("inventory.no_products_desc")} /></TableCell></TableRow>
              ) : (
                products?.map((product) => {
                  const isService = (product as any).isService;
                  const isLowStock = !isService && product.stock <= (product.lowStockThreshold || 5);
                  return (
                    <TableRow key={product.id} className={isLowStock ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(String(product.id))}
                          onCheckedChange={() => toggleSelectOne(String(product.id))}
                          aria-label={t("inventory.bulk_select_row")}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.categoryName || t("inventory.uncategorized")}</TableCell>
                      <TableCell className="text-end">{formatCurrency(product.sellingPrice, settings?.currency ?? "SAR", lang)}</TableCell>
                      <TableCell className="text-end">
                        {isService ? (
                          <Badge variant="outline">{t("inventory.service_badge")}</Badge>
                        ) : (
                          <Badge variant={isLowStock ? "destructive" : "secondary"}>{product.stock}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end space-x-2">
                        {!isService && (
                          <Button variant="ghost" size="icon" onClick={() => { setAdjustProduct(product); setAdjustQty(""); setAdjustReason(""); }}>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Link href={`/inventory/${product.id}/manage`}>
                          <Button variant="ghost" size="icon" title={t("variants.manage_button")}>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </Link>
                        {hasPermission("products.update") && (
                          <Link href={`/inventory/${product.id}/edit`}>
                            <Button variant="ghost" size="icon" title={t("common.edit")}>
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </Link>
                        )}
                        {hasPermission("products.delete") && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {adjustProduct && (
        <Dialog open onOpenChange={() => setAdjustProduct(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("inventory.adjust_stock")} — {adjustProduct.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("inventory.current_stock")}</span>
                <span className="font-bold">{adjustProduct.stock}</span>
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.adjust_quantity")}</Label>
                <Input type="number" step="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  placeholder={`${t("inventory.adjust_increase")} / ${t("inventory.adjust_decrease")}`} />
                <p className="text-xs text-muted-foreground">
                  {t("inventory.adjust_hint", { current: adjustProduct.stock, new: Number(adjustQty) + adjustProduct.stock })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.adjust_reason")}</Label>
                <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder={t("inventory.adjust_reason_placeholder")} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustProduct(null)}>{t("common.cancel")}</Button>
              <Button onClick={() => adjustMutation.mutate()} disabled={!adjustQty || Number(adjustQty) === 0 || adjustMutation.isPending}>
                {adjustMutation.isPending ? t("common.saving") : t("inventory.adjust_stock")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={bulkCategoryDialogOpen} onOpenChange={setBulkCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("inventory.bulk_change_category")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("common.category")}</Label>
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("inventory.uncategorized")}</SelectItem>
                {categories?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCategoryDialogOpen(false)} disabled={isBulkWorking}>{t("common.cancel")}</Button>
            <Button onClick={handleBulkCategoryChange} disabled={isBulkWorking}>
              {isBulkWorking ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
