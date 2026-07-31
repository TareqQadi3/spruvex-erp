import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface AddonGroup {
  id: string;
  name: string;
  nameEn?: string | null;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: AddonOption[];
}
interface AddonOption { id: string; name: string; nameEn?: string | null; priceDelta: string }

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Add-on group/option manager shown on the product edit page. A POS template
 * (Grid/Image/Mobile) opens the AddonPickerDialog at sale time for any product
 * flagged hasAddons — this card is the admin side that builds those groups.
 */
export function AddonManager({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupDialog, setGroupDialog] = useState<null | { id?: string; name: string; nameEn: string; required: boolean; minSelect: string; maxSelect: string }>(null);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; price: string }>>({});
  const [editingOption, setEditingOption] = useState<{ groupId: string; optionId: string; name: string; price: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    authFetch(`/products/${productId}/addon-groups`)
      .then(setGroups)
      .catch(() => toast.error(t("inventory.addons_load_failed")))
      .finally(() => setLoading(false));
  }, [productId, t]);

  useEffect(() => { reload(); }, [reload]);

  const saveGroup = async () => {
    if (!groupDialog || !groupDialog.name.trim()) return;
    const body = {
      name: groupDialog.name.trim(),
      ...(groupDialog.nameEn.trim() ? { nameEn: groupDialog.nameEn.trim() } : {}),
      required: groupDialog.required,
      minSelect: Number(groupDialog.minSelect) || 0,
      maxSelect: Number(groupDialog.maxSelect) || 1,
    };
    try {
      if (groupDialog.id) {
        await authFetch(`/products/${productId}/addon-groups/${groupDialog.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await authFetch(`/products/${productId}/addon-groups`, { method: "POST", body: JSON.stringify(body) });
      }
      toast.success(t("inventory.addons_saved"));
      setGroupDialog(null);
      reload();
    } catch (err: any) {
      toast.error(err.message ?? t("inventory.addons_save_failed"));
    }
  };

  const deleteGroup = async (group: AddonGroup) => {
    if (!window.confirm(t("inventory.addons_delete_confirm"))) return;
    try {
      await authFetch(`/products/${productId}/addon-groups/${group.id}`, { method: "DELETE" });
      toast.success(t("inventory.addons_deleted"));
      reload();
    } catch (err: any) {
      toast.error(err.message ?? t("inventory.addons_save_failed"));
    }
  };

  const addOption = async (groupId: string) => {
    const draft = optionDrafts[groupId];
    if (!draft || !draft.name.trim()) return;
    try {
      await authFetch(`/products/${productId}/addon-groups/${groupId}/options`, {
        method: "POST",
        body: JSON.stringify({ name: draft.name.trim(), priceDelta: Number(draft.price) || 0 }),
      });
      setOptionDrafts(prev => ({ ...prev, [groupId]: { name: "", price: "" } }));
      reload();
    } catch (err: any) {
      toast.error(err.message ?? t("inventory.addons_save_failed"));
    }
  };

  const saveOption = async () => {
    if (!editingOption || !editingOption.name.trim()) return;
    try {
      await authFetch(`/products/${productId}/addon-groups/${editingOption.groupId}/options/${editingOption.optionId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editingOption.name.trim(), priceDelta: Number(editingOption.price) || 0 }),
      });
      setEditingOption(null);
      reload();
    } catch (err: any) {
      toast.error(err.message ?? t("inventory.addons_save_failed"));
    }
  };

  const deleteOption = async (groupId: string, optionId: string) => {
    try {
      await authFetch(`/products/${productId}/addon-groups/${groupId}/options/${optionId}`, { method: "DELETE" });
      reload();
    } catch (err: any) {
      toast.error(err.message ?? t("inventory.addons_save_failed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("inventory.addons_title")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t("inventory.addons_desc")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setGroupDialog({ name: "", nameEn: "", required: false, minSelect: "0", maxSelect: "1" })}>
            <Plus className="me-1 h-4 w-4" />
            {t("inventory.addons_add_group")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("inventory.addons_no_groups")}</div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm">{group.name}</span>
                  {group.required && <Badge variant="secondary" className="text-[9px]">{t("inventory.addons_required")}</Badge>}
                  {group.maxSelect > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {t("inventory.addons_min_select")} {group.minSelect} · {t("inventory.addons_max_select")} {group.maxSelect}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGroupDialog({ id: group.id, name: group.name, nameEn: group.nameEn ?? "", required: group.required, minSelect: String(group.minSelect), maxSelect: String(group.maxSelect) })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteGroup(group)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                {group.options.map(option => (
                  <div key={option.id} className="flex items-center gap-2 bg-background rounded border px-2.5 py-1.5">
                    {editingOption?.optionId === option.id ? (
                      <>
                        <Input
                          className="h-7 text-xs px-2 flex-1"
                          value={editingOption.name}
                          onChange={e => setEditingOption(prev => prev && { ...prev, name: e.target.value })}
                          autoFocus
                          onKeyDown={e => { if (e.key === "Enter") saveOption(); if (e.key === "Escape") setEditingOption(null); }}
                        />
                        <Input
                          className="h-7 text-xs px-2 w-20"
                          type="number" step="0.01"
                          value={editingOption.price}
                          onChange={e => setEditingOption(prev => prev && { ...prev, price: e.target.value })}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveOption}><Check className="h-3 w-3 text-green-500" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingOption(null)}><X className="h-3 w-3 text-muted-foreground" /></Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1">{option.name}</span>
                        {Number(option.priceDelta) !== 0 && (
                          <span className="text-xs text-muted-foreground">+{Number(option.priceDelta).toFixed(2)}</span>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingOption({ groupId: group.id, optionId: option.id, name: option.name, price: option.priceDelta })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteOption(group.id, option.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  className="h-7 text-xs px-2 flex-1"
                  placeholder={t("inventory.addons_option_name")}
                  value={optionDrafts[group.id]?.name ?? ""}
                  onChange={e => setOptionDrafts(prev => ({ ...prev, [group.id]: { name: e.target.value, price: prev[group.id]?.price ?? "" } }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(group.id); } }}
                />
                <Input
                  className="h-7 text-xs px-2 w-20"
                  type="number" step="0.01"
                  placeholder="+0.00"
                  value={optionDrafts[group.id]?.price ?? ""}
                  onChange={e => setOptionDrafts(prev => ({ ...prev, [group.id]: { name: prev[group.id]?.name ?? "", price: e.target.value } }))}
                />
                <Button variant="outline" size="sm" className="h-7" onClick={() => addOption(group.id)}>
                  <Plus className="h-3.5 w-3.5 me-1" />
                  {t("inventory.addons_add_option")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!groupDialog} onOpenChange={v => !v && setGroupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupDialog?.id ? t("inventory.addons_edit_group") : t("inventory.addons_new_group")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("inventory.addons_group_name")}</Label>
              <Input
                value={groupDialog?.name ?? ""}
                onChange={e => setGroupDialog(prev => prev && { ...prev, name: e.target.value })}
                placeholder={t("inventory.addons_group_name_placeholder")}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveGroup(); } }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("inventory.addons_min_select")}</Label>
                <Input
                  type="number" min="0"
                  value={groupDialog?.minSelect ?? "0"}
                  onChange={e => setGroupDialog(prev => prev && { ...prev, minSelect: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventory.addons_max_select")}</Label>
                <Input
                  type="number" min="1"
                  value={groupDialog?.maxSelect ?? "1"}
                  onChange={e => setGroupDialog(prev => prev && { ...prev, maxSelect: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={groupDialog?.required ?? false}
                onCheckedChange={v => setGroupDialog(prev => prev && { ...prev, required: !!v })}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">{t("inventory.addons_required")}</span>
                <p className="text-xs text-muted-foreground">{t("inventory.addons_required_help")}</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupDialog(null)}>{t("common.cancel")}</Button>
            <Button type="button" onClick={saveGroup} disabled={!groupDialog?.name.trim()}>
              {groupDialog?.id ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
