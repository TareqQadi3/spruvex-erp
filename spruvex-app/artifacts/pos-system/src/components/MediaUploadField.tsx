import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Link2, Cloud, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface MediaUploadFieldProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  maxSizeKb?: number;
  aspect?: "square" | "wide";
}

// One reusable upload control for every image field in the app (shop logo,
// product/brand/category/customer images) — device upload is the primary
// path (FileReader -> base64 data URL; there's no object-storage backend in
// this system, so a data URL stored directly on the row is the real
// mechanism, not a placeholder), a direct link is offered as a secondary
// option, and cloud-drive pickers are visibly present but disabled — Google
// Drive/OneDrive need a real OAuth app registration this environment has no
// credentials for, so showing a working-looking button that silently fails
// would be worse than an honest "coming soon".
export function MediaUploadField({ value, onChange, maxSizeKb = 500, aspect = "square" }: MediaUploadFieldProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeKb * 1024) {
      toast.error(t("media.too_large", { size: maxSizeKb }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(t("media.invalid_type"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUrlApply = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput("");
  };

  const previewClass = aspect === "wide"
    ? "h-24 w-full max-w-xs object-cover"
    : "h-24 w-24 object-cover";

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className={`${previewClass} rounded-md border`} />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            <X className="me-1.5 h-3.5 w-3.5" /> {t("media.remove")}
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList>
            <TabsTrigger value="upload"><Upload className="me-1.5 h-3.5 w-3.5" />{t("media.tab_upload")}</TabsTrigger>
            <TabsTrigger value="link"><Link2 className="me-1.5 h-3.5 w-3.5" />{t("media.tab_link")}</TabsTrigger>
            <TabsTrigger value="cloud"><Cloud className="me-1.5 h-3.5 w-3.5" />{t("media.tab_cloud")}</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed p-6 text-center hover:bg-muted/50"
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t("media.upload_hint")}</span>
              <span className="text-xs text-muted-foreground">{t("media.size_hint", { size: maxSizeKb })}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </TabsContent>
          <TabsContent value="link" className="pt-2 flex gap-2">
            <Input placeholder={t("media.link_placeholder")} value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            <Button type="button" variant="outline" onClick={handleUrlApply} disabled={!urlInput.trim()}>{t("media.apply")}</Button>
          </TabsContent>
          <TabsContent value="cloud" className="pt-2 space-y-2">
            <Button type="button" variant="outline" className="w-full justify-start" disabled>
              <Cloud className="me-2 h-4 w-4" /> {t("media.google_drive")} — {t("media.coming_soon")}
            </Button>
            <Button type="button" variant="outline" className="w-full justify-start" disabled>
              <Cloud className="me-2 h-4 w-4" /> {t("media.onedrive")} — {t("media.coming_soon")}
            </Button>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
