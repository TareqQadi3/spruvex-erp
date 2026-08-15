import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Shield, ShieldCheck } from "lucide-react";

async function authFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Request failed");
  const body = await res.json();
  return body.data ?? body;
}

interface RoleSummary { id: string; companyId: string | null; name: string; displayName: string; isSystem: boolean; }
interface RoleDetail extends RoleSummary { permissions: Array<{ id: string; code: string }>; }

// Read-only overview: which default roles exist and what each grants —
// role assignment itself stays on the existing Users page (its flat-role
// dropdown is synced server-side onto these tables automatically, so this
// page doesn't need write actions to be useful). Custom-role creation is
// deliberately out of scope for now ("امكانية اضافة ادوار مخصصة لاحقاً").
export default function RolesPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [details, setDetails] = useState<Record<string, RoleDetail>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const load = () => {
    setIsLoading(true);
    setIsError(false);
    authFetch("/roles").then((list: RoleSummary[]) => {
      setRoles(list);
      list.forEach(r => {
        authFetch(`/roles/${r.id}`).then((detail: RoleDetail) => {
          setDetails(prev => ({ ...prev, [r.id]: detail }));
        }).catch(() => {});
      });
    }).catch(() => setIsError(true)).finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("roles.title")}</h1>
      </div>

      <p className="text-sm text-muted-foreground">{t("roles.desc")}</p>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-6 space-y-4"><div className="h-5 w-24 bg-muted animate-pulse rounded" /><div className="h-4 w-16 bg-muted animate-pulse rounded" /><div className="h-8 w-full bg-muted animate-pulse rounded" /></CardContent></Card>)}
        </div>
      ) : isError ? (
        <Card><CardContent><QueryErrorState message={t("common.error_load_data")} onRetry={load} /></CardContent></Card>
      ) : roles.length === 0 ? (
        <EmptyState icon={Shield} title={t("roles.no_permissions")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {roles.map(role => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  {role.displayName}
                  {role.isSystem && <Badge variant="outline">{t("roles.system")}</Badge>}
                </CardTitle>
                <CardDescription>{role.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {(details[role.id]?.permissions ?? []).map(p => (
                  <Badge key={p.id} variant="secondary" className="text-xs">{p.code}</Badge>
                ))}
                {details[role.id] && details[role.id].permissions.length === 0 && (
                  <span className="text-xs text-muted-foreground">{t("roles.no_permissions")}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
