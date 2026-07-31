import { useMemo, useState } from "react";
import {
  useGetBrands, useCreateBrand, useUpdateBrand, useDeleteBrand, getGetBrandsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { MediaUploadField } from "@/components/MediaUploadField";

interface Brand { id: number; name: string; imageUrl: string | null; }

export default function BrandsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: brands, isLoading } = useGetBrands();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!brands) return [];
    const q = search.trim().toLowerCase();
    if (!q) return brands as Brand[];
    return (brands as Brand[]).filter(b => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetBrandsQueryKey() });

  const openCreate = () => {
    setEditingBrand(null);
    setName("");
    setImageUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setImageUrl(brand.imageUrl ?? null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingBrand) {
      updateBrand.mutate({ id: editingBrand.id as any, data: { name: name.trim(), imageUrl } as any }, {
        onSuccess: () => { invalidate(); setDialogOpen(false); toast.success(t("brands.save_success")); },
        onError: () => toast.error(t("brands.save_failed")),
      });
    } else {
      createBrand.mutate({ data: { name: name.trim(), imageUrl } as any }, {
        onSuccess: () => { invalidate(); setDialogOpen(false); toast.success(t("brands.save_success")); },
        onError: () => toast.error(t("brands.save_failed")),
      });
    }
  };

  const handleDelete = (brand: Brand) => {
    if (!window.confirm(t("brands.delete_confirm"))) return;
    deleteBrand.mutate({ id: brand.id as any }, {
      onSuccess: () => { invalidate(); toast.success(t("brands.delete_success")); },
      onError: (err: any) => toast.error(err?.message ?? t("brands.delete_failed")),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("brands.title")}</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> {t("brands.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("brands.list_title")}</CardTitle>
          <CardDescription>{t("brands.list_desc")}</CardDescription>
          <Input
            className="max-w-sm mt-2"
            placeholder={t("brands.search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {isLoading && [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          {!isLoading && filtered.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-8">{t("brands.empty")}</p>
          )}
          {filtered.map(b => (
            <div key={b.id} className="flex flex-col items-center gap-2 rounded-lg border p-3">
              <div className="h-14 w-14 rounded-md border overflow-hidden flex items-center justify-center bg-muted/30">
                {b.imageUrl ? <img src={b.imageUrl} alt="" className="h-full w-full object-contain" /> : <Tag className="h-5 w-5 text-muted-foreground/50" />}
              </div>
              <div className="text-sm font-medium text-center truncate w-full">{b.name}</div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? t("brands.edit_title") : t("brands.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("brands.name")}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("brands.name_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("brands.image")}</Label>
              <MediaUploadField value={imageUrl} onChange={setImageUrl} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || createBrand.isPending || updateBrand.isPending}
            >
              {(createBrand.isPending || updateBrand.isPending) ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
