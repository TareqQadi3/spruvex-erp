import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useTranslation } from "@/i18n";
import { QuickAddCustomerDialog } from "@/components/QuickAddCustomerDialog";
import type { PosCustomer } from "./types";

export function CustomerPanel({
  customers,
  selectedCustomerId,
  selectedCustomerName,
  onSelect,
  onCreated,
  fmt,
}: {
  customers: PosCustomer[] | undefined;
  selectedCustomerId: string | null;
  selectedCustomerName: string;
  onSelect: (id: string | null, name: string) => void;
  onCreated: (customer: { id: string; name: string }) => void;
  fmt: (n: number) => string;
}) {
  const { t } = useTranslation();
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const outstanding = selectedCustomer?.outstandingBalance ? Number(selectedCustomer.outstandingBalance) : 0;
  return (
    <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pos.customer")}</div>
      <div className="flex gap-2">
        <Select
          value={selectedCustomerId ? String(selectedCustomerId) : "__walk_in__"}
          onValueChange={val => {
            if (val === "__walk_in__") {
              onSelect(null, "");
            } else {
              const c = customers?.find(c => c.id === val);
              onSelect(val, c?.name ?? "");
            }
          }}
        >
          <SelectTrigger className="flex-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__walk_in__">{t("pos.walk_in")}</SelectItem>
            {customers?.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}{c.phone ? ` — ${c.phone}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <QuickAddCustomerDialog
          onCreated={onCreated}
          trigger={
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <UserPlus className="h-4 w-4" />
            </Button>
          }
        />
      </div>
      {selectedCustomerName && (
        <div className="text-xs text-primary font-medium">{selectedCustomerName}</div>
      )}
      {selectedCustomer && outstanding > 0.005 && (
        <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
          {t("pos.outstanding_balance")}: {fmt(outstanding)}
        </div>
      )}
    </div>
  );
}
