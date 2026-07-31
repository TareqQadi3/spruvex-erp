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
  PlusCircle,
  Undo2,
  HandCoins,
  Settings2,
  Timer,
} from "lucide-react";

type NavIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface NavItem {
  key: string;
  href: string;
  icon: NavIcon;
}

interface NavGroup {
  key: string;
  basePath: string;
  icon: NavIcon;
  items: NavItem[];
}

// Sales and POS get their own grouped sections per the navigation restructure:
// every entry points at a real page — /pos creates invoices, /vouchers records
// customer payments (receipt vouchers), /accounting hosts cash sessions, and
// /settings holds the invoice + POS screen configuration.
const SALES_GROUP: NavGroup = {
  key: "nav.sales_group",
  basePath: "/sales",
  icon: Receipt,
  items: [
    { key: "nav.sales", href: "/sales", icon: Receipt },
    { key: "nav.create_invoice", href: "/pos", icon: PlusCircle },
    { key: "nav.sales_returns", href: "/sales/returns", icon: Undo2 },
    { key: "nav.credit_notes", href: "/sales/credit-notes", icon: ReceiptText },
    { key: "nav.customer_payments", href: "/vouchers", icon: HandCoins },
    { key: "nav.sales_settings", href: "/settings", icon: Settings2 },
  ],
};

const POS_GROUP: NavGroup = {
  key: "nav.pos_group",
  basePath: "/pos",
  icon: ShoppingCart,
  items: [
    { key: "nav.start_sale", href: "/pos", icon: ShoppingCart },
    { key: "nav.pos_sessions", href: "/accounting", icon: Timer },
    { key: "nav.pos_reports", href: "/reports", icon: BarChart3 },
    { key: "nav.pos_settings", href: "/settings", icon: Settings2 },
  ],
};

// Products, categories, and brands each get their own real page now (brands
// didn't even have one before), so they need their own sidebar entries rather
// than being buried inside tabs on one page.
const PRODUCTS_GROUP: NavGroup = {
  key: "nav.products_group",
  basePath: "/inventory",
  icon: Package,
  items: [
    { key: "nav.products", href: "/inventory", icon: Package },
    { key: "nav.categories", href: "/inventory/categories", icon: FolderTree },
    { key: "nav.brands", href: "/inventory/brands", icon: Tag },
  ],
};

const FINANCE_GROUP: NavGroup = {
  key: "nav.finance_group",
  basePath: "/accounting",
  icon: Calculator,
  items: [
    { key: "nav.accounting", href: "/accounting", icon: Calculator },
    { key: "nav.vouchers", href: "/vouchers", icon: ReceiptText },
  ],
};

const NAV_GROUPS: NavGroup[] = [SALES_GROUP, POS_GROUP, PRODUCTS_GROUP, FINANCE_GROUP];

const TOP_ITEMS: NavItem[] = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
];

const BOTTOM_ITEMS: NavItem[] = [
  { key: "nav.repairs", href: "/repairs", icon: Wrench },
  { key: "nav.customers", href: "/customers", icon: Users },
  { key: "nav.suppliers", href: "/suppliers", icon: Truck },
  { key: "nav.purchases", href: "/purchases", icon: PackageSearch },
  { key: "nav.reports", href: "/reports", icon: BarChart3 },
  { key: "nav.settings", href: "/settings", icon: Settings },
];

function NavLink({ href, icon: Icon, label, isRTL, isActive, sub }: {
  href: string; icon: NavIcon;
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

  const topItems = TOP_ITEMS.filter(item => !user || canAccess(user.role, item.href));
  const bottomItems = BOTTOM_ITEMS.filter(item => {
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
          {topItems.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} />;
          })}

          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(item => !user || canAccess(user.role, item.href));
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className={cn("px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/40", isRTL && "text-right")}>
                  {t(group.key)}
                </div>
                {items.map((item) => {
                  const isActive = location === item.href;
                  return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} sub />;
                })}
              </div>
            );
          })}

          {bottomItems.map((item) => {
            const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return <NavLink key={item.key} href={item.href} icon={item.icon} label={t(item.key)} isRTL={isRTL} isActive={isActive} />;
          })}
        </nav>
      </div>
    </div>
  );
}
