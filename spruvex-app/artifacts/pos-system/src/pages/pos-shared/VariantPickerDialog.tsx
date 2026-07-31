import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { useTranslation } from "@/i18n";

interface Variant {
  id: number;
  name: string;
  nameEn?: string | null;
  sellingPrice: string;
  stock: number;
  imageUrl?: string | null;
  variantAttributes?: Record<string, string> | null;
  hasAddons?: boolean;
  includesTax?: boolean;
}

/**
 * Color/storage/model picker for the electronics POS template. Lists a master
 * product's concrete variant rows (fetched from /products/:id/variants) with
 * their attributes as chips, stock, and an optional serial/IMEI capture box so
 * phones and laptops can be sold with their unique numbers recorded.
 */
export function VariantPickerDialog({
  productName,
  productImage,
  variants,
  loading,
  open,
  onClose,
  onAdd,
}: {
  productName: string;
  productImage?: string | null;
  variants: Variant[];
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onAdd: (variant: Variant, serial: string) => void;
}) {
  const { t } = useTranslation();
  const [serials, setSerials] = useState<Record<number, string>>({});

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center gap-3">
          {productImage ? (
            <img src={productImage} alt={productName} className="h-12 w-12 rounded-lg object-cover border" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border">
              <span className="font-bold text-lg text-muted-foreground">{productName.charAt(0)}</span>
            </div>
          )}
          <DialogTitle className="line-clamp-2">{productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : variants.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("pos.mobile_no_variants")}</div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {variants.map(v => (
                <div key={v.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                      {v.variantAttributes && Object.entries(v.variantAttributes).length > 0
                        ? Object.entries(v.variantAttributes).map(([k, val]) => (
                            <Badge key={k} variant="secondary" className="text-[10px] px-2 py-0.5">
                              <span className="opacity-60">{k}:</span> {val}
                            </Badge>
                          ))
                        : <span className="text-sm font-medium">{v.name}</span>}
                    </div>
                    <div className="text-primary font-bold text-sm whitespace-nowrap">
                      {t("pos.mobile_price")}: {Number(v.sellingPrice).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {Number(v.stock) <= 0 ? (
                      <span className="text-xs font-semibold text-destructive">{t("pos.out_of_stock")}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("pos.stock", { count: v.stock })}</span>
                    )}
                    <div className="flex items-center gap-2 flex-1 max-w-[220px]">
                      <Input
                        type="text"
                        className="h-8 text-xs px-2"
                        placeholder={t("pos.serial_placeholder")}
                        value={serials[v.id] ?? ""}
                        onChange={e => setSerials(prev => ({ ...prev, [v.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={Number(v.stock) <= 0}
                        onClick={() => onAdd(v, (serials[v.id] ?? "").trim())}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
