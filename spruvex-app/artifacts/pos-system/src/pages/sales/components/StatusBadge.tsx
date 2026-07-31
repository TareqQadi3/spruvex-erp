import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

export function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    completed: "default",
    draft: "outline",
    partially_paid: "secondary",
    returned: "destructive",
  };
  const labels: Record<string, string> = {
    completed: t("sales.status_completed"),
    draft: t("sales.status_draft"),
    partially_paid: t("sales.status_partially_paid"),
    returned: t("sales.status_returned"),
  };
  const variant = variants[status] ?? "outline";
  const label = labels[status] ?? status;
  return (
    <Badge variant={variant} className={status === "draft" ? "text-muted-foreground" : "capitalize"}>
      {status === "draft" && <Pencil className="me-1 h-3 w-3" />}
      {label}
    </Badge>
  );
}
