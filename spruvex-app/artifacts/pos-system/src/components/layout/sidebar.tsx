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
  FolderTree,
  Tag,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.pos", href: "/pos", icon: ShoppingCart },
  { key: "nav.sales", href: "/sales", icon: Receipt },
  { key: "nav.repairs", href: "/repairs", icon: Wrench },
  { key: "nav.customers", href: "/customers", icon: Users },
  { key: "nav.suppliers", href: "/suppliers", icon: Truck },
  { key: "nav.purchases", href: "/purchases", icon: PackageSearch },
  { key: "nav.vouchers", href: "/vouchers", icon: ReceiptText },
  { key: "nav.accounting", href: "/accounting", icon: Calculator },
  { key: "nav.reports", href: "/reports", icon: BarChart3 },
  { key: "nav.settings", href: "/settings", icon: Settings },
];

// A grouped nav entry instead of a single flat "Inventory" link — products,
// categories, and brands each get their own real page now (brands didn't
// even have one before), so they need their own sidebar entries rather than
// being buried inside tabs on one page.
const PRODUCTS_GROUP = {
  key: "nav.products_group",
  basePath: "/inventory",
  icon: Package,
  items: [
    { key: "nav.products", href: "/inventory", icon: Package },
    { key: "nav.categories", href: "/inventory/categories", icon: FolderTree },
    { key: "nav.brands", href: "/inventory/brands", icon: Tag },
  ],
};

function NavLink({ href, icon: Icon, label, isRTL, isActive, sub }: {
  href: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string; isRTL: boolean; isActive: boolean; sub?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "group flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
          isRTL ? "flex-row-reverse" : "",
          sub && (isRTL ? "pe-3 me-3" : "ps-3 ms-3"),
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon
          className={cn(
            sub ? "h-4 w-4 flex-shrink-0" : "h-5 w-5 flex-shrink-0",
            isRTL ? "ms-3" : "me-3",
            isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
          )}
          aria-hidden={true}
        />
        {label}
      </div>
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const { t, isRTL } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useGetSettings();

  const productsGroupVisible = !user || canAccess(user.role, PRODUCTS_GROUP.basePath);

  const beforeGroup = NAV_ITEMS.slice(0, 3).filter(item => {
    if (user && !canAccess(user.role, item.href)) return false;
    if (item.href === "/repairs" && settings?.repairsModuleEnabled === false) return false;
    return true;
  });
  const afterGroup = NAV_ITEMS.slice(3).filter(item => {
    if (user && !canAccess(user.role, item.href)) return false;
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      <div className={cn("flex h-14 items-center px-4 border-b border-sidebar-border", isRTL && "justify-end")}>
        <BrandLogo variant="horizontal" theme="dark" className="h-7 w-auto" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {beforeGroup.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} />;
          })}

          {productsGroupVisible && (
            <div>
              <div className={cn("px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/40", isRTL && "text-right")}>
                {t(PRODUCTS_GROUP.key)}
              </div>
              {PRODUCTS_GROUP.items.map((item) => {
                const isActive = location === item.href;
                return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} sub />;
              })}
            </div>
          )}

          {afterGroup.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} />;
          })}
        </nav>
      </div>
    </div>
  );
}
