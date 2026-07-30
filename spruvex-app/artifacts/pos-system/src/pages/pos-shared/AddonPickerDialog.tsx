import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface AddonOption {
  id: string;
  name: string;
  nameEn?: string | null;
  priceDelta: string;
}
interface AddonGroup {
  id: string;
  name: string;
  nameEn?: string | null;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: AddonOption[];
}

export interface SelectedAddon { groupName: string; optionName: string; priceDelta: number }

async function authFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function AddonPickerDialog({
  productId,
  productName,
  open,
  onClose,
  onConfirm,
}: {
  productId: number;
  productName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (addons: SelectedAddon[], notes: string) => void;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setSelections({});
    setNotes("");
    authFetch(`/products/${productId}/addon-groups`)
      .then(setGroups)
      .finally(() => setIsLoading(false));
  }, [open, productId]);

  const toggleOption = (group: AddonGroup, optionId: string) => {
    setSelections(prev => {
      const current = new Set(prev[group.id] ?? []);
      if (group.maxSelect === 1) {
        current.clear();
        current.add(optionId);
      } else if (current.has(optionId)) {
        current.delete(optionId);
      } else if (current.size < group.maxSelect) {
        current.add(optionId);
      }
      return { ...prev, [group.id]: current };
    });
  };

  const canConfirm = groups.every(g => {
    const count = selections[g.id]?.size ?? 0;
    return !g.required || count >= Math.max(g.minSelect, 1);
  });

  const handleConfirm = () => {
    const addons: SelectedAddon[] = [];
    for (const g of groups) {
      const chosen = selections[g.id];
      if (!chosen) continue;
      for (const optId of chosen) {
        const opt = g.options.find(o => o.id === optId);
        if (opt) addons.push({ groupName: g.name, optionName: opt.name, priceDelta: Number(opt.priceDelta) });
      }
    }
    onConfirm(addons, notes.trim());
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="space-y-5 max-h-[50vh] overflow-y-auto">
            {groups.map(g => (
              <div key={g.id} className="space-y-2">
                <div className="text-sm font-medium">
                  {g.name} {g.required && <span className="text-destructive">*</span>}
                </div>
                {g.maxSelect === 1 ? (
                  <RadioGroup
                    value={[...(selections[g.id] ?? [])][0] ?? ""}
                    onValueChange={val => toggleOption(g, val)}
                  >
                    {g.options.map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-2 py-1">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={o.id} id={o.id} />
                          <Label htmlFor={o.id} className="font-normal">{o.name}</Label>
                        </div>
                        {Number(o.priceDelta) !== 0 && (
                          <span className="text-xs text-muted-foreground">+{o.priceDelta}</span>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  g.options.map(o => (
                    <div key={o.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={o.id}
                          checked={selections[g.id]?.has(o.id) ?? false}
                          onCheckedChange={() => toggleOption(g, o.id)}
                        />
                        <Label htmlFor={o.id} className="font-normal">{o.name}</Label>
                      </div>
                      {Number(o.priceDelta) !== 0 && (
                        <span className="text-xs text-muted-foreground">+{o.priceDelta}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("pos.item_notes")}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t("pos.item_notes_placeholder")} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleConfirm} disabled={isLoading || !canConfirm}>{t("pos.add_to_cart")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
