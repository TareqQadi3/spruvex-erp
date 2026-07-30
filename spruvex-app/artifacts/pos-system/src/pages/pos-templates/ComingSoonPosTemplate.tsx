import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { LucideIcon } from "lucide-react";

/**
 * Shared shell for POS templates whose screen hasn't been built yet (grid,
 * image, mobile — see businessTypeDefaults.ts for which business types
 * default to each). A tenant assigned one of these still gets a working POS:
 * the fallback button switches them to the list template via
 * PUT /api/settings without leaving the page.
 */
export function ComingSoonPosTemplate({
  icon: Icon,
  titleKey,
  descKey,
  onUseListTemplate,
}: {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  onUseListTemplate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-[calc(100vh-6rem)] flex items-center justify-center">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">{t(titleKey)}</h2>
            <p className="text-sm text-muted-foreground">{t(descKey)}</p>
          </div>
          <Button variant="outline" onClick={onUseListTemplate}>
            {t("pos.templates.use_list_for_now")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
