import { useState } from "react";
import {
  useGetCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  getGetCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, FolderTree, Folder } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { MediaUploadField } from "@/components/MediaUploadField";

import { TranslateButton } from "@/components/TranslateButton";

interface CategoryRow {
  id: string;
  name: string;
  nameEn?: string | null;
  parentId: string | null;
  imageUrl?: string | null;
}

export default function CategoriesPage() {
  const { data: categories } = useGetCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [parentId, setParentId] = useState<string>("__none__");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const mainCategories = (categories ?? []).filter((c: any) => !c.parentId);
  const subCategoriesOf = (id: string) => (categories ?? []).filter((c: any) => c.parentId === id);

  const openCreate = (forParentId?: string) => {
    setEditing(null);
    setName("");
    setNameEn("");
    setParentId(forParentId ? String(forParentId) : "__none__");
    setImageUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setEditing(cat);
    setName(cat.name);
    setNameEn(cat.nameEn ?? "");
    setParentId(cat.parentId ? String(cat.parentId) : "__none__");
    setImageUrl(cat.imageUrl ?? null);
    setDialogOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), nameEn: nameEn.trim() || null, parentId: parentId === "__none__" ? null : parentId, imageUrl };
    if (editing) {
      updateCategory.mutate({ id: editing.id as any, data: payload as any }, {
        onSuccess: () => { toast.success(t("inventory.category_updated")); invalidate(); setDialogOpen(false); },
        onError: () => toast.error(t("inventory.category_update_failed")),
      });
    } else {
      createCategory.mutate({ data: payload as any }, {
        onSuccess: () => { toast.success(t("inventory.category_created")); invalidate(); setDialogOpen(false); },
        onError: () => toast.error(t("inventory.category_create_failed")),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("inventory.category_delete_confirm"))) return;
    deleteCategory.mutate({ id } as any, {
      onSuccess: () => { toast.success(t("inventory.category_deleted")); invalidate(); },
      onError: () => toast.error(t("inventory.category_delete_failed")),
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("inventory.categories_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("inventory.categories_desc")}</p>
        </div>
        <Button className="ms-auto" onClick={() => openCreate()}>
          <Plus className="me-2 h-4 w-4" /> {t("inventory.add_main_category")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {mainCategories.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("inventory.no_categories")}</div>
          )}
          {mainCategories.map((main: any) => (
            <div key={main.id}>
              <div className="flex items-center gap-3 p-4">
                <FolderTree className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium flex-1">{main.name}</span>
                <Button variant="ghost" size="sm" onClick={() => openCreate(main.id)}>
                  <Plus className="h-3.5 w-3.5 me-1" /> {t("inventory.add_sub_category")}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(main)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(main.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {subCategoriesOf(main.id).map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-3 py-2.5 ps-10 pe-4 bg-muted/20">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{sub.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sub.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("common.edit") : t("inventory.add_main_category")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("inventory.category_name")}</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t("inventory.category_name_placeholder")}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>{t("inventory.category_name_en")}</Label>
                  <Input
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    placeholder={t("inventory.category_name_en_placeholder")}
                  />
                </div>
                <TranslateButton text={name} onTranslated={setNameEn} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("inventory.category_label")}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("inventory.no_parent")}</SelectItem>
                  {mainCategories.filter((c: any) => c.id !== editing?.id).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("inventory.image")}</Label>
              <MediaUploadField value={imageUrl} onChange={setImageUrl} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={createCategory.isPending || updateCategory.isPending || !name.trim()}>
              {(createCategory.isPending || updateCategory.isPending) ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
