import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface LoadingProps {
  label?: string;
  className?: string;
}

export function Loading({ label, className }: LoadingProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-muted-foreground ${className ?? ""}`}>
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm font-medium">{label ?? t("common.loading")}</span>
    </div>
  );
}

export function TableLoadingSkeleton({ cols = 5, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-3">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
