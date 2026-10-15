import { Link, useLocation } from "wouter";
import { Building2, LifeBuoy, Handshake, ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n";

// Deliberately its own layout, not the tenant Sidebar/Topbar — platform
// admin is cross-tenant and conceptually a different app sharing the same
// bundle, not another page inside a tenant's workspace. A visibly distinct
// look (dark header bar, "PLATFORM ADMIN" label) also guards against a
// platform admin mistaking cross-tenant actions here for tenant-scoped ones.
export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t, isRTL } = useTranslation();

  const NAV = [
    { href: "/platform/companies", label: t("platform.nav_companies"), icon: Building2 },
    { href: "/platform/support", label: t("platform.nav_support"), icon: LifeBuoy },
    { href: "/platform/affiliates", label: t("platform.nav_affiliates"), icon: Handshake },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between border-b bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-bold tracking-wide">{t("platform.badge")}</span>
          <span className="text-xs text-slate-400">{user?.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <button type="button" className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("platform.back_to_app")}
            </button>
          </Link>
          <button type="button" onClick={logout} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800">
            <LogOut className="h-3.5 w-3.5" />
            {t("auth.logout")}
          </button>
        </div>
      </div>
      <div className="flex">
        <nav className="w-56 shrink-0 border-e bg-muted/20 p-3 space-y-1 min-h-[calc(100vh-45px)]">
          {NAV.map(item => {
            const active = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80",
                )}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-6 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
