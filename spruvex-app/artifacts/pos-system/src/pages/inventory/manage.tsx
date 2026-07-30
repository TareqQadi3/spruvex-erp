import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetProduct, useGetProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

interface AttributeValue { id: string; value: string; }
interface AttributeDefinition { id: string; name: string; values: AttributeValue[]; }
interface DraftVariant { key: string; attrs: Record<string, string>; sku: string; barcode: string; sellingPrice: string; stock: string; }
interface Variant { id: number; name: string; sku: string; sellingPrice: string; stock: number; variantAttributes: Record<string, string> | null; }
interface RelatedProduct { id: number; name: string; sku: string; sellingPrice: string; }

export default function ManageProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const { data: product } = useGetProduct(Number(productId));
  const { t } = useTranslation();

  // ─── Variants state ────────────────────────────────────────────
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, Set<string>>>({});
  const [drafts, setDrafts] = useState<DraftVariant[]>([]);
  const [newAttrName, setNewAttrName] = useState("");
  const [newValueByAttr, setNewValueByAttr] = useState<Record<string, string>>({});
  const [isSavingVariants, setIsSavingVariants] = useState(false);

  const loadAttributes = () => authFetch("/product-attributes").then(setAttributes);
  const loadVariants = () => authFetch(`/products/${productId}/variants`).then(setVariants);

  useEffect(() => { loadAttributes(); loadVariants(); }, [productId]);

  const toggleValue = (attrId: string, valueId: string) => {
    setSelectedValues(prev => {
      const current = new Set(prev[attrId] ?? []);
      current.has(valueId) ? current.delete(valueId) : current.add(valueId);
      return { ...prev, [attrId]: current };
    });
  };

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    authFetch("/product-attributes", { method: "POST", body: JSON.stringify({ name: newAttrName.trim() }) })
      .then(() => { setNewAttrName(""); loadAttributes(); })
      .catch(() => toast.error(t("variants.attribute_create_failed")));
  };

  const handleAddValue = (attrId: string) => {
    const value = newValueByAttr[attrId]?.trim();
    if (!value) return;
    authFetch(`/product-attributes/${attrId}/values`, { method: "POST", body: JSON.stringify({ value }) })
      .then(() => { setNewValueByAttr(prev => ({ ...prev, [attrId]: "" })); loadAttributes(); })
      .catch(() => toast.error(t("variants.value_create_failed")));
  };

  const generateDrafts = () => {
    const chosenAttrs = attributes
      .map(a => ({ attr: a, values: a.values.filter(v => selectedValues[a.id]?.has(v.id)) }))
      .filter(a => a.values.length > 0);
    if (chosenAttrs.length === 0) return;

    let combos: Array<Record<string, string>> = [{}];
    for (const { attr, values } of chosenAttrs) {
      const next: Array<Record<string, string>> = [];
      for (const combo of combos) {
        for (const v of values) next.push({ ...combo, [attr.name]: v.value });
      }
      combos = next;
    }

    const baseSku = product?.sku ?? "VAR";
    setDrafts(combos.map(attrs => {
      const suffix = Object.values(attrs).join("-").toUpperCase().replace(/\s+/g, "");
      return {
        key: suffix,
        attrs,
        sku: `${baseSku}-${suffix}`,
        barcode: "",
        sellingPrice: String(product?.sellingPrice ?? "0"),
        stock: "0",
      };
    }));
  };

  const updateDraft = (key: string, field: keyof DraftVariant, value: string) => {
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, [field]: value } : d));
  };

  const saveVariants = async () => {
    if (drafts.length === 0) return;
    setIsSavingVariants(true);
    try {
      for (const d of drafts) {
        await authFetch("/products", {
          method: "POST",
          body: JSON.stringify({
            name: `${product?.name ?? ""} — ${Object.values(d.attrs).join(" / ")}`,
            sku: d.sku,
            barcode: d.barcode || undefined,
            sellingPrice: Number(d.sellingPrice) || 0,
            costPrice: product?.costPrice ?? 0,
            stock: Number(d.stock) || 0,
            categoryId: product?.categoryId ?? undefined,
            parentProductId: Number(productId),
            variantAttributes: d.attrs,
          }),
        });
      }
      toast.success(t("variants.created_success"));
      setDrafts([]);
      setSelectedValues({});
      loadVariants();
    } catch {
      toast.error(t("variants.created_failed"));
    } finally {
      setIsSavingVariants(false);
    }
  };

  // ─── Related products state ────────────────────────────────────
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product?.name}</h1>
          <p className="text-sm text-muted-foreground">{t("variants.page_desc")}</p>
        </div>
      </div>

      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">{t("variants.tab_variants")}</TabsTrigger>
          <TabsTrigger value="related">{t("variants.tab_related")}</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          {variants.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("variants.existing_variants")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.sku_required")}</TableHead>
                      <TableHead>{t("variants.attributes")}</TableHead>
                      <TableHead>{t("inventory.selling_price_required")}</TableHead>
                      <TableHead>{t("inventory.stock_qty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                        <TableCell className="text-xs">
                          {v.variantAttributes ? Object.entries(v.variantAttributes).map(([k, val]) => `${k}: ${val}`).join(", ") : "—"}
                        </TableCell>
                        <TableCell>{v.sellingPrice}</TableCell>
                        <TableCell>{v.stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">{t("variants.attributes")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {attributes.map(attr => (
                <div key={attr.id} className="space-y-2 rounded-lg border p-3">
                  <div className="font-medium text-sm">{attr.name}</div>
                  <div className="flex flex-wrap gap-3">
                    {attr.values.map(v => (
                      <label key={v.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedValues[attr.id]?.has(v.id) ?? false}
                          onCheckedChange={() => toggleValue(attr.id, v.id)}
                        />
                        {v.value}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder={t("variants.new_value_placeholder")}
                      value={newValueByAttr[attr.id] ?? ""}
                      onChange={e => setNewValueByAttr(prev => ({ ...prev, [attr.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") handleAddValue(attr.id); }}
                    />
                    <Button size="sm" variant="outline" onClick={() => handleAddValue(attr.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder={t("variants.new_attribute_placeholder")}
                  value={newAttrName}
                  onChange={e => setNewAttrName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddAttribute(); }}
                />
                <Button variant="outline" onClick={handleAddAttribute}>
                  <Plus className="me-1.5 h-4 w-4" /> {t("variants.add_attribute")}
                </Button>
              </div>
              <Button onClick={generateDrafts} disabled={Object.values(selectedValues).every(s => !s || s.size === 0)}>
                <Sparkles className="me-1.5 h-4 w-4" /> {t("variants.generate")}
              </Button>
            </CardContent>
          </Card>

          {drafts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("variants.review_before_save")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {drafts.map(d => (
                  <div key={d.key} className="grid grid-cols-4 gap-2 items-center border-b pb-2 last:border-0">
                    <div className="text-xs font-medium">{Object.values(d.attrs).join(" / ")}</div>
                    <Input className="h-8 text-xs" value={d.sku} onChange={e => updateDraft(d.key, "sku", e.target.value)} placeholder={t("inventory.sku_required")} />
                    <Input className="h-8 text-xs" type="number" value={d.sellingPrice} onChange={e => updateDraft(d.key, "sellingPrice", e.target.value)} placeholder={t("inventory.selling_price_required")} />
                    <Input className="h-8 text-xs" type="number" value={d.stock} onChange={e => updateDraft(d.key, "stock", e.target.value)} placeholder={t("inventory.stock_qty")} />
                  </div>
                ))}
                <Button onClick={saveVariants} disabled={isSavingVariants}>
                  {isSavingVariants ? t("common.saving") : t("variants.save_all")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="related" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("variants.tab_related")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("variants.search_products")}</Label>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("inventory.search_placeholder")} />
                {search && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResults?.filter(p => p.id !== Number(productId)).map(p => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
