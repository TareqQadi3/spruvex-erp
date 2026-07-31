import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { translateText, isArabicText } from "@/utils/translate";

/**
 * Auto-translate button for the product form: detects the source language and
 * writes the translation into the opposite name field (name <-> nameEn).
 */
export function TranslateButton({
  text,
  onTranslated,
}: {
  text: string;
  onTranslated: (translated: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const target = isArabicText(text) ? "en" : "ar";
      const translated = await translateText(text.trim(), target);
      if (translated) onTranslated(translated);
    } catch {
      toast.error(t("inventory.translate_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="icon" onClick={handleClick} disabled={busy || !text.trim()} title={t("inventory.translate")}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
    </Button>
  );
}
