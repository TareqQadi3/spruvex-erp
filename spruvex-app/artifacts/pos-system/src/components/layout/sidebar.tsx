import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useAuth, canAccess } from "@/contexts/AuthContext";
import { useGetSettings } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Package,
  Users,
  Truck,
  ReceiptText,
  Calculator,
  BarChart3,
  Settings,
  Receipt,
  PackageSearch,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.pos", href: "/pos", icon: ShoppingCart },
  { key: "nav.sales", href: "/sales", icon: Receipt },
  { key: "nav.repairs", href: "/repairs", icon: Wrench },
  { key: "nav.inventory", href: "/inventory", icon: Package },
  { key: "nav.customers", href: "/customers", icon: Users },
  { key: "nav.suppliers", href: "/suppliers", icon: Truck },
  { key: "nav.purchases", href: "/purchases", icon: PackageSearch },
  { key: "nav.vouchers", href: "/vouchers", icon: ReceiptText },
  { key: "nav.accounting", href: "/accounting", icon: Calculator },
  { key: "nav.reports", href: "/reports", icon: BarChart3 },
  { key: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { t, isRTL } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useGetSettings();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (user && !canAccess(user.role, item.href)) return false;
    if (item.href === "/repairs" && settings?.repairsModuleEnabled === false) return false;
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      <div className={cn("flex h-14 items-center px-4 border-b border-sidebar-border", isRTL && "justify-end")}>
        <BrandLogo variant="horizontal" theme="dark" className="h-7 w-auto" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return (
              <Link key={item.key} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                    isRTL ? "flex-row-reverse" : "",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isRTL ? "ms-3" : "me-3",
                      isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {t(item.key)}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
