import { useGetRepairs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-500 text-white",
  under_inspection: "bg-yellow-500 text-black",
  waiting_parts: "bg-orange-500 text-white",
  in_repair: "bg-blue-500 text-white",
  completed: "bg-green-500 text-white",
  delivered: "bg-teal-500 text-white",
};

export default function RepairsPage() {
  const [search, setSearch] = useState("");
  const { data: repairs, isLoading } = useGetRepairs(search ? { search } : undefined);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("repairs.title")}</h1>
        <Link href="/repairs/new">
          <Button><Plus className="me-2 h-4 w-4" /> {t("repairs.new_repair")}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("repairs.search_placeholder")}
              className="ps-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("repairs.ticket")}</TableHead>
                <TableHead>{t("repairs.customer")}</TableHead>
                <TableHead>{t("repairs.device")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : repairs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("repairs.no_repairs")}</TableCell>
                </TableRow>
              ) : (
                repairs?.map((repair) => (
                  <TableRow key={repair.id}>
                    <TableCell className="font-medium">{repair.ticketNumber}</TableCell>
                    <TableCell>
                      <div>{repair.customerName || t("repairs.walk_in")}</div>
                      <div className="text-xs text-muted-foreground">{repair.customerPhone}</div>
                    </TableCell>
                    <TableCell>
                      <div>{repair.deviceModel || repair.deviceType}</div>
                      {repair.problemDescription && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{repair.problemDescription}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-transparent ${STATUS_COLORS[repair.status] || "bg-gray-500 text-white"}`}>
                        {t(`repairs.status_${repair.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(repair.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-end">
                      <Link href={`/repairs/${repair.id}`}>
                        <Button variant="ghost" size="sm">{t("common.view")}</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
