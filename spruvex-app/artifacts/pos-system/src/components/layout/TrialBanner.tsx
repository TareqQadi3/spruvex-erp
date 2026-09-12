import { useGetSubscriptionStatus } from "@workspace/api-client-react";
import { AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function TrialBanner() {
  const { data } = useGetSubscriptionStatus();
  const { t } = useTranslation();

  if (!data) return null;

  if (data.status === "expired") {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-destructive/10 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t("trialBanner.expired")}
      </div>
    );
  }

  if (data.status !== "trial" || !data.trialEndsAt) return null;

  const daysRemaining = Math.ceil((new Date(data.trialEndsAt).getTime() - Date.now()) / MS_PER_DAY);
  const isUrgent = daysRemaining <= 3;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
        isUrgent ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {isUrgent ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
      {daysRemaining <= 0
        ? t("trialBanner.last_day")
        : t("trialBanner.days_left", { count: daysRemaining })}
    </div>
  );
}
