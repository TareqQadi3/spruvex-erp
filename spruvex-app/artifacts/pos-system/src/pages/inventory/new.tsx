import { useCreateProduct, useCreateCategory, useGetCategories, getGetProductsQueryKey, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Info, Plus, Image as ImageIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";

export default function NewProductPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const createCategory = useCreateCategory();
  const { data: categories } = useGetCategories();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error(t("inventory.image_too_large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<any>({
    defaultValues: { stock: 0, lowStockThreshold: 5, includesTax: false }
  });
  const { t } = useTranslation();

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategory.mutate({ data: { name: newCategoryName.trim() } }, {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
        setValue("categoryId", String(created.id));
        setNewCategoryName("");
        setIsCategoryDialogOpen(false);
        toast.success(t("inventory.category_created"));
      },
      onError: () => toast.error(t("inventory.category_create_failed")),
    });
  };

  const includesTax = watch("includesTax");
  const sellingPrice = watch("sellingPrice");

  const onSubmit = (data: any) => {
    const payload: any = {
      name: data.name,
      sku: data.sku,
      costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      stock: Number(data.stock) || 0,
      lowStockThreshold: Number(data.lowStockThreshold) || 5,
      includesTax: data.includesTax ?? false,
    };
    if (data.barcode) payload.barcode = data.barcode;
    if (data.description) payload.description = data.description;
    if (data.categoryId) payload.categoryId = Number(data.categoryId);
    if (data.brand) payload.brand = data.brand;
    if (imagePreview) payload.imageUrl = imagePreview;

    createProduct.mutate({ data: payload }, {
      onSuccess: () => {
        toast.success(t("inventory.save_success"));
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        navigate("/inventory");
      },
      onError: () => toast.error(t("inventory.save_failed")),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("inventory.new_title")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("inventory.product_details")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("inventory.product_name_required")}</Label>
                <Input
                  {...register("name", { required: true })}
                  placeholder={t("inventory.product_name_placeholder")}
                  className={errors.name ? "border-destructive" : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.sku_required")}</Label>
                <Input
                  {...register("sku", { required: true })}
                  placeholder={t("inventory.sku_placeholder")}
                  className={errors.sku ? "border-destructive" : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.barcode")}</Label>
                <Input {...register("barcode")} placeholder={t("inventory.barcode_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.brand")}</Label>
                <Input {...register("brand")} placeholder={t("inventory.brand_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.image")}</Label>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
                    {imagePreview
                      ? <img src={imagePreview} alt="" className="h-full w-full object-contain" />
                      : <ImageIcon className="h-5 w-5 text-muted-foreground/50" />}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs" />
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("inventory.category_label")}</Label>
                <div className="flex gap-2">
                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => {
                      const selected = categories?.find(c => String(c.id) === field.value);
                      return (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={t("inventory.select_category")}>
                              {selected?.name}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {categories?.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("inventory.no_categories_hint")}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{t("inventory.description")}</Label>
                <Textarea {...register("description")} placeholder={t("inventory.description_placeholder")} rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("inventory.pricing_stock")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("inventory.cost_price_required")}</Label>
                  <Input type="number" step="0.01" {...register("costPrice", { required: true })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("inventory.selling_price_required")}</Label>
                  <Input type="number" step="0.01" {...register("sellingPrice", { required: true })} placeholder="0.00" />
                </div>
              </div>

              {/* Tax inclusion option */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <Controller
                  name="includesTax"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="includesTax"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <label htmlFor="includesTax" className="text-sm font-medium cursor-pointer">
                          {t("inventory.price_includes_tax")}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {t("inventory.price_includes_tax_desc")}
                        </p>
                      </div>
                    </div>
                  )}
                />
                {sellingPrice && (
                  <div className="bg-background rounded border px-3 py-2 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Info className="h-3 w-3" />
                      {t("inventory.tax_preview")}
                    </div>
                    {includesTax ? (
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {t("inventory.final_price_is", { price: Number(sellingPrice).toFixed(2) })}
                      </div>
                    ) : (
                      <div className="font-medium">
                        {t("inventory.price_plus_vat", { price: Number(sellingPrice).toFixed(2) })}
                        <span className="text-primary ms-1">
                          → {(Number(sellingPrice) * 1.15).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("inventory.stock_qty")}</Label>
                  <Input type="number" {...register("stock")} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("inventory.low_stock_threshold")}</Label>
                  <Input type="number" {...register("lowStockThreshold")} placeholder="5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href="/inventory">
              <Button type="button" variant="outline">{t("common.cancel")}</Button>
            </Link>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending ? t("common.saving") : t("inventory.save_product")}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.new_category_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("inventory.category_name")}</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("inventory.category_name_placeholder")}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleCreateCategory} disabled={createCategory.isPending || !newCategoryName.trim()}>
              {createCategory.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
