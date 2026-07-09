import { useGetProducts, useDeleteProduct, useGetSettings, getGetProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Edit, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/format";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useGetProducts(search ? { search } : undefined);
  const { data: settings } = useGetSettings();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();

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
          <Link href="/inventory/movements">
            <Button variant="outline"><History className="me-2 h-4 w-4" /> {t("inventory.view_movements")}</Button>
          </Link>
          <Link href="/inventory/new">
            <Button><Plus className="me-2 h-4 w-4" /> {t("inventory.add_product")}</Button>
          </Link>
        </div>
      </div>

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
                        <Button variant="ghost" size="icon" onClick={() => toast(t("inventory.edit_soon"))}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  );
}
