import { useParams, Link } from "wouter";
import { useGetProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { VariantsTab } from "./components/VariantsTab";
import { RelatedProductsTab } from "./components/RelatedProductsTab";
import { UnitsTab } from "./components/UnitsTab";
import { BatchesTab } from "./components/BatchesTab";

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

export default function ManageProductPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const { data: product } = useGetProduct(productId as any);
  const { t } = useTranslation();

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
          <TabsTrigger value="units">{t("units.tab_units")}</TabsTrigger>
          <TabsTrigger value="batches">{t("units.tab_batches")}</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          <VariantsTab productId={productId} product={product} authFetch={authFetch} />
        </TabsContent>

        <TabsContent value="related" className="space-y-4">
          <RelatedProductsTab productId={productId} authFetch={authFetch} />
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <UnitsTab productId={productId} authFetch={authFetch} />
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <BatchesTab productId={productId} authFetch={authFetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
