import { useState } from "react";
import { useGetTrialBalance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function TrialBalance() {
  const { t } = useTranslation();
  const [asOf, setAsOf] = useState("");
  const { data: trialBalance, isLoading } = useGetTrialBalance(asOf ? { asOf } : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-xs">
          <Label>{t("accounting.as_of_date")}</Label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        {trialBalance && (
          <Badge
            variant="outline"
            className={trialBalance.isBalanced
              ? "bg-green-500/10 text-green-700 border-green-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"}
          >
            {trialBalance.isBalanced ? (
              <><CheckCircle2 className="h-3.5 w-3.5 me-1" /> {t("accounting.balanced")}</>
            ) : (
              <><AlertTriangle className="h-3.5 w-3.5 me-1" /> {t("accounting.unbalanced")}</>
            )}
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.code")}</TableHead>
                <TableHead>{t("accounting.account")}</TableHead>
                <TableHead>{t("accounting.account_type")}</TableHead>
                <TableHead className="text-end">{t("accounting.debit")}</TableHead>
                <TableHead className="text-end">{t("accounting.credit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : trialBalance?.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("accounting.no_trial_balance_data")}</TableCell>
                </TableRow>
              ) : (
                trialBalance?.lines.map((line) => (
                  <TableRow key={line.accountId}>
                    <TableCell className="font-mono text-sm">{line.accountCode}</TableCell>
                    <TableCell className="font-medium">{line.accountName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t(`accounting.type_${line.accountType}`)}</TableCell>
                    <TableCell className="text-end">{line.debit > 0 ? line.debit.toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-end">{line.credit > 0 ? line.credit.toFixed(2) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {trialBalance && trialBalance.lines.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">{t("accounting.totals")}</TableCell>
                  <TableCell className="text-end font-semibold">{trialBalance.totalDebit.toFixed(2)}</TableCell>
                  <TableCell className="text-end font-semibold">{trialBalance.totalCredit.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
