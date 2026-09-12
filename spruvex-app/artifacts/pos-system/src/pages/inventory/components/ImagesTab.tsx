import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { MediaUploadField } from "@/components/MediaUploadField";

interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export function ImagesTab({ productId, authFetch }: {
  productId: string;
  authFetch: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const { t, isRTL } = useTranslation();
  const [images, setImages] = useState<ProductImage[]>([]);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const loadImages = () => authFetch(`/products/${productId}/images`).then(setImages);
  useEffect(() => { loadImages(); }, [productId]);

  const handleAdd = () => {
    if (!pendingUrl) return;
    authFetch(`/products/${productId}/images`, {
      method: "POST",
      body: JSON.stringify({ url: pendingUrl, isPrimary: images.length === 0 }),
    })
      .then(() => { toast.success(t("images.added")); setPendingUrl(null); loadImages(); })
      .catch(() => toast.error(t("images.add_failed")));
  };

  const handleDelete = (id: string) => {
    authFetch(`/products/${productId}/images/${id}`, { method: "DELETE" })
      .then(() => { toast.success(t("images.deleted")); loadImages(); })
      .catch(() => toast.error(t("images.delete_failed")));
  };

  const handleSetPrimary = (id: string) => {
    authFetch(`/products/${productId}/images/${id}`, { method: "PUT", body: JSON.stringify({ isPrimary: true }) })
      .then(() => { loadImages(); })
      .catch(() => toast.error(t("images.update_failed")));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const other = images[index + direction];
    const current = images[index];
    if (!other || !current) return;
    Promise.all([
      authFetch(`/products/${productId}/images/${current.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: other.sortOrder }) }),
      authFetch(`/products/${productId}/images/${other.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: current.sortOrder }) }),
    ])
      .then(() => loadImages())
      .catch(() => toast.error(t("images.update_failed")));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("images.gallery_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={img.id} className="relative rounded-lg border overflow-hidden group">
                  <img src={img.url} alt="" className="h-32 w-full object-cover" />
                  {img.isPrimary && (
                    <Badge className="absolute top-2 start-2" variant="default">{t("images.primary_badge")}</Badge>
                  )}
                  <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-1 p-1.5 bg-background/90">
                    <div className="flex gap-1">
                      <Button
                        type="button" variant="ghost" size="icon" className="h-7 w-7"
                        disabled={i === 0}
                        onClick={() => handleMove(i, -1)}
                        title={t("common.back")}
                      >
                        {isRTL ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-7 w-7"
                        disabled={i === images.length - 1}
                        onClick={() => handleMove(i, 1)}
                        title={t("common.next")}
                      >
                        {isRTL ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      {!img.isPrimary && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSetPrimary(img.id)} title={t("images.set_primary")}>
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(img.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3 pt-2 border-t">
            <div className="flex-1 max-w-xs">
              <MediaUploadField value={pendingUrl} onChange={setPendingUrl} />
            </div>
            <Button onClick={handleAdd} disabled={!pendingUrl}>{t("images.add_to_gallery")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
