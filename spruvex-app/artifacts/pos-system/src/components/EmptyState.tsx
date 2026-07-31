import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-12 flex flex-col items-center text-center text-muted-foreground gap-2">
      <Icon className="h-8 w-8" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs max-w-sm">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
