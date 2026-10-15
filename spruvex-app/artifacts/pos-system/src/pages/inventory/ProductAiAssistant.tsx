import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

type Action = "describe" | "improve_name" | "suggest_category" | "suggest_keywords" | "ecommerce_description";

const ACTIONS: Action[] = ["describe", "improve_name", "suggest_category", "suggest_keywords", "ecommerce_description"];

interface Props {
  name: string;
  category?: string;
  brand?: string;
  description?: string;
  onApplyName?: (name: string) => void;
  onApplyDescription?: (description: string) => void;
}

// Self-contained AI assistant for a single product — used from both the new
// and edit product forms. Deliberately offers a direct "use this" action
// only for fields that live on THIS form (name, description); category/
// keywords/e-commerce description suggestions are copy-only since category
// needs a real FK pick and keywords/SEO description live on a different
// tab/table (product_ecommerce) this dialog has no reach into.
export function ProductAiAssistant({ name, category, brand, description, onApplyName, onApplyDescription }: Props) {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (act: Action) => {
    setAction(act);
    setResult(null);
    setError(null);
    setCopied(false);
    setIsLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch("/api/ai/product-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: act, name, category, brand, description, language: lang }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? t("aiAssistant.generate_failed"));
      setResult(body.data.text);
    } catch (err: any) {
      setError(err.message ?? t("aiAssistant.generate_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const canApplyDirectly = action === "describe" || action === "improve_name";

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(true); setResult(null); setError(null); setAction(null); }}>
        <Sparkles className="me-1.5 h-3.5 w-3.5" />
        {t("aiAssistant.button")}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("aiAssistant.dialog_title")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => (
                  <Button key={a} type="button" size="sm" variant={action === a ? "default" : "outline"} disabled={isLoading} onClick={() => run(a)}>
                    {t(`aiAssistant.action_${a}`)}
                  </Button>
                ))}
              </div>

              {isLoading && <Skeleton className="h-28 w-full" />}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{result}</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={copy}>
                      {copied ? <Check className="me-1.5 h-3.5 w-3.5" /> : <Copy className="me-1.5 h-3.5 w-3.5" />}
                      {copied ? t("aiAssistant.copied") : t("aiAssistant.copy")}
                    </Button>
                    {canApplyDirectly && action === "describe" && onApplyDescription && (
                      <Button type="button" size="sm" onClick={() => { onApplyDescription(result); toast.success(t("aiAssistant.applied")); setOpen(false); }}>
                        {t("aiAssistant.use_this")}
                      </Button>
                    )}
                    {canApplyDirectly && action === "improve_name" && onApplyName && (
                      <Button
                        type="button" size="sm"
                        onClick={() => { onApplyName(result.split("\n")[0].trim()); toast.success(t("aiAssistant.applied")); setOpen(false); }}
                      >
                        {t("aiAssistant.use_first_option")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {!result && !isLoading && !error && (
                <p className="text-sm text-muted-foreground">{t("aiAssistant.pick_action")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
