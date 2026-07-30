import { useGetProducts, useDeleteProduct, useGetSettings, getGetProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Edit, History, FolderTree, Layers, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

interface InventoryAlerts {
  lowStock: Array<{ id: string; name: string; stock: number }>;
  expired: Array<{ id: string; productName: string; batchNumber: string }>;
  expiringSoon: Array<{ id: string; productName: string; batchNumber: string; expiryDate: string }>;
}

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useGetProducts(search ? { search } : undefined);
  const { data: settings } = useGetSettings();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();
  const { has: hasPermission } = usePermissions();

  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    fetch("/api/reports/inventory-alerts", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(setAlerts)
      .catch(() => {});
  }, []);
  const alertCount = alerts ? alerts.lowStock.length + alerts.expired.length + alerts.expiringSoon.length : 0;

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
          <div className="flex gap-2 relative max-w-sm">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("inventory.search_placeholder")}
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
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("inventory.no_products")}</TableCell>
                </TableRow>
              ) : (
                products?.map((product) => {
                  const isLowStock = product.stock <= (product.lowStockThreshold || 5);
                  return (
                    <TableRow key={product.id} className={isLowStock ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.categoryName || t("inventory.uncategorized")}</TableCell>
                      <TableCell className="text-end">{formatCurrency(product.sellingPrice, settings?.currency ?? "SAR", lang)}</TableCell>
                      <TableCell className="text-end">
                        <Badge variant={isLowStock ? "destructive" : "secondary"}>{product.stock}</Badge>
                      </TableCell>
                      <TableCell className="text-end space-x-2">
                        <Link href={`/inventory/${product.id}/manage`}>
                          <Button variant="ghost" size="icon" title={t("variants.manage_button")}>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => toast(t("inventory.edit_soon"))}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
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
    </div>
  );
}
