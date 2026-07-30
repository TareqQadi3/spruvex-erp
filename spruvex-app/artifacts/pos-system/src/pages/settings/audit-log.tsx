import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

async function authFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface AuditLogRow {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  createdAt: string;
}

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    authFetch(`/audit-log?${params}`)
      .then(data => { setRows(data.rows); setTotal(data.total); })
      .catch(() => toast.error(t("auditLog.load_failed")))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [page]);

  const applyFilters = () => { setPage(1); load(); };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("auditLog.title")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("auditLog.filters")}</CardTitle>
          <CardDescription>{t("auditLog.filters_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{t("auditLog.action")}</Label>
            <Input className="w-44" placeholder="create_product" value={action} onChange={e => setAction(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auditLog.entity_type")}</Label>
            <Input className="w-40" placeholder="product" value={entityType} onChange={e => setEntityType(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auditLog.user_id")}</Label>
            <Input className="w-56" placeholder="UUID" value={userId} onChange={e => setUserId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auditLog.from")}</Label>
            <Input className="w-44" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auditLog.to")}</Label>
            <Input className="w-44" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button onClick={applyFilters} disabled={isLoading}>{t("auditLog.apply")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("auditLog.time")}</TableHead>
                  <TableHead>{t("auditLog.user")}</TableHead>
                  <TableHead>{t("auditLog.action")}</TableHead>
                  <TableHead>{t("auditLog.entity")}</TableHead>
                  <TableHead>{t("auditLog.details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{r.username ?? t("auditLog.system")}</TableCell>
                    <TableCell><Badge variant="secondary">{r.action}</Badge></TableCell>
                    <TableCell className="text-xs">{r.entityType}{r.entityId ? ` #${String(r.entityId).slice(0, 8)}` : ""}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {JSON.stringify(r.newValue ?? r.metadata ?? r.oldValue ?? {})}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("auditLog.no_results")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("auditLog.total")}: {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2">{page}</span>
              <Button variant="outline" size="icon" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
