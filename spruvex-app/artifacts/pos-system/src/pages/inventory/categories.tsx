import { useMemo, useState } from "react";
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
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";
import { usePermissions } from "@/hooks/usePermissions";

import { TranslateButton } from "@/components/TranslateButton";

interface CategoryRow {
  id: string;
  name: string;
  nameEn?: string | null;
  parentId: string | null;
  imageUrl?: string | null;
}

export default function CategoriesPage() {
  const { data: categories, isLoading, isError, refetch } = useGetCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { has: hasPermission } = usePermissions();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [parentId, setParentId] = useState<string>("__none__");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Unlimited-depth tree (categories.parentId is a plain self-reference with
  // no depth limit in the schema) — any category can be a parent, not just
  // top-level ones.
  const rootCategories = (categories ?? []).filter((c: any) => !c.parentId);
  const childrenOf = (id: string) => (categories ?? []).filter((c: any) => c.parentId === id);

  const matchesSearch = (c: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name?.toLowerCase().includes(q) || c.nameEn?.toLowerCase().includes(q);
  };

  // A node stays visible if it matches, or any descendant (at any depth) matches.
  const subtreeMatches = (cat: any): boolean =>
    matchesSearch(cat) || childrenOf(cat.id).some(subtreeMatches);

  const visibleRootCategories = useMemo(
    () => rootCategories.filter(subtreeMatches),
    [categories, search],
  );
  const visibleChildrenOf = (id: string) => childrenOf(id).filter(subtreeMatches);

  // Every descendant id of `id` (used to keep the parent picker from letting
  // a category become its own descendant's child — backend rejects this too,
  // but excluding it from the list is a clearer UX than a save-time error).
  const descendantIds = (id: string): string[] =>
    childrenOf(id).flatMap((c: any) => [c.id, ...descendantIds(c.id)]);

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
        {hasPermission("products.create") && (
          <Button className="ms-auto" onClick={() => openCreate()}>
            <Plus className="me-2 h-4 w-4" /> {t("inventory.add_main_category")}
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t("inventory.categories_search_placeholder")}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <Loading />}
          {isError && <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />}
          {!isLoading && !isError && rootCategories.length === 0 && (
            <EmptyState icon={FolderTree} title={t("inventory.no_categories")} />
          )}
          {!isLoading && !isError && rootCategories.length > 0 && visibleRootCategories.length === 0 && (
            <EmptyState icon={FolderTree} title={t("inventory.no_categories_match")} />
          )}
          {visibleRootCategories.map((cat: any) => (
            <CategoryNode
              key={cat.id}
              category={cat}
              depth={0}
              childrenOf={visibleChildrenOf}
              hasPermission={hasPermission}
              onAddChild={openCreate}
              onEdit={openEdit}
              onDelete={handleDelete}
              t={t}
            />
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("common.edit") : parentId !== "__none__" ? t("inventory.add_sub_category") : t("inventory.add_main_category")}
            </DialogTitle>
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
                  {(categories ?? [])
                    .filter((c: any) => {
                      if (!editing) return true;
                      // Can't become its own parent, nor its own descendant's child (would create a cycle).
                      return c.id !== editing.id && !descendantIds(editing.id).includes(c.id);
                    })
                    .map((c: any) => (
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

function CategoryNode({ category, depth, childrenOf, hasPermission, onAddChild, onEdit, onDelete, t }: {
  category: any;
  depth: number;
  childrenOf: (id: string) => any[];
  hasPermission: (perm: string) => boolean;
  onAddChild: (parentId: string) => void;
  onEdit: (cat: CategoryRow) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const children = childrenOf(category.id);
  const isRoot = depth === 0;
  return (
    <div>
      <div
        className={depth === 0 ? "flex items-center gap-3 p-4" : "flex items-center gap-3 py-2.5 pe-4 bg-muted/20"}
        style={depth > 0 ? { paddingInlineStart: `${1.5 + depth * 1.5}rem` } : undefined}
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className={isRoot ? "h-8 w-8 rounded object-cover shrink-0" : "h-6 w-6 rounded object-cover shrink-0"} />
        ) : isRoot ? (
          <FolderTree className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className={isRoot ? "font-medium flex-1" : "text-sm flex-1"}>{category.name}</span>
        {hasPermission("products.create") && (
          <Button variant="ghost" size="sm" onClick={() => onAddChild(category.id)}>
            <Plus className="h-3.5 w-3.5 me-1" /> {t("inventory.add_sub_category")}
          </Button>
        )}
        {hasPermission("products.update") && (
          <Button variant="ghost" size="icon" className={isRoot ? "h-8 w-8" : "h-7 w-7"} onClick={() => onEdit(category)}>
            <Pencil className={isRoot ? "h-3.5 w-3.5" : "h-3 w-3"} />
          </Button>
        )}
        {hasPermission("products.delete") && (
          <Button variant="ghost" size="icon" className={isRoot ? "h-8 w-8 text-destructive" : "h-7 w-7 text-destructive"} onClick={() => onDelete(category.id)}>
            <Trash2 className={isRoot ? "h-3.5 w-3.5" : "h-3 w-3"} />
          </Button>
        )}
      </div>
      {children.map((child) => (
        <CategoryNode
          key={child.id}
          category={child}
          depth={depth + 1}
          childrenOf={childrenOf}
          hasPermission={hasPermission}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          t={t}
        />
      ))}
    </div>
  );
}
