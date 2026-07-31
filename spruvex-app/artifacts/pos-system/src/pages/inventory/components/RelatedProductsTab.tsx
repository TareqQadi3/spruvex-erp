import { useEffect, useState } from "react";
import { useGetProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface RelatedProduct { id: number; name: string; sku: string; sellingPrice: string; }

export function RelatedProductsTab({ productId, authFetch }: {
  productId: string;
  authFetch: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const { t } = useTranslation();
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [search, setSearch] = useState("");
  const { data: searchResults } = useGetProducts(search ? { search } : undefined);

  const loadRelated = () => authFetch(`/products/${productId}/related`).then(setRelated);
  useEffect(() => { loadRelated(); }, [productId]);

  const addRelated = (relatedProductId: number) => {
    authFetch(`/products/${productId}/related`, { method: "POST", body: JSON.stringify({ relatedProductId }) })
      .then(() => { toast.success(t("variants.related_added")); setSearch(""); loadRelated(); })
      .catch(() => toast.error(t("variants.related_add_failed")));
  };

  const removeRelated = (relatedProductId: number) => {
    authFetch(`/products/${productId}/related/${relatedProductId}`, { method: "DELETE" })
      .then(() => loadRelated())
      .catch(() => toast.error(t("variants.related_remove_failed")));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("variants.tab_related")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("variants.search_products")}</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("inventory.search_placeholder")} />
            {search && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searchResults?.filter(p => String(p.id) !== productId).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full flex justify-between px-3 py-2 text-sm hover:bg-muted/50 text-start"
                    onClick={() => addRelated(p.id)}
                  >
                    <span>{p.name}</span>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {related.length === 0 && <p className="text-sm text-muted-foreground">{t("variants.no_related")}</p>}
            {related.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.sku} — {r.sellingPrice}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeRelated(r.id)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
