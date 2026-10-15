import { Bell, Search, LogOut, ChevronDown, PackageX, LifeBuoy, ShieldCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetProducts } from "@workspace/api-client-react";
import { useTranslation } from "@/i18n";
import { useAuth, TOKEN_KEY } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

async function notificationsFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) throw new Error("Request failed");
  if (res.status === 204) return null;
  return res.json();
}

function notificationHref(n: AppNotification): string | null {
  if (n.relatedEntityType === "support_ticket" && n.relatedEntityId) return `/support/${n.relatedEntityId}`;
  return null;
}

export function Topbar() {
  const { data: products } = useGetProducts({ lowStock: true });
  const lowStockCount = products?.length || 0;
  const { t, lang, setLang } = useTranslation();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: notifBody } = useQuery({
    queryKey: ["topbar-notifications"],
    queryFn: () => notificationsFetch("/support/notifications?pageSize=10"),
    refetchInterval: 60_000,
  });
  const notifications: AppNotification[] = notifBody?.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const totalAlertCount = lowStockCount + unreadCount;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsFetch(`/support/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["topbar-notifications"] }),
  });

  const toggleLang = () => setLang(lang === "en" ? "ar" : "en");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-10 flex h-14 flex-shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">{t("common.search")}</label>
          <Search className="pointer-events-none absolute inset-y-0 start-0 h-full w-5 text-muted-foreground ms-0" aria-hidden="true" />
          <Input
            id="search-field"
            className="block h-full w-full border-0 py-0 ps-8 pe-0 text-foreground placeholder:text-muted-foreground focus:ring-0 sm:text-sm bg-transparent shadow-none"
            placeholder={t("topbar.search_placeholder")}
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-2 lg:gap-x-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[2.5rem] text-xs font-semibold tracking-wide"
            onClick={toggleLang}
            title={lang === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
          >
            {t("topbar.lang_switch")}
          </Button>
          <ThemeToggle />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <span className="sr-only">{t("topbar.notifications")}</span>
                <Bell className="h-5 w-5" aria-hidden="true" />
                {totalAlertCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -end-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                  >
                    {totalAlertCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b font-semibold text-sm">{t("topbar.notifications")}</div>
              <ScrollArea className="max-h-80">
                <div className="divide-y">
                  {lowStockCount > 0 && (
                    <Link href="/inventory">
                      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer">
                        <PackageX className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                        <div className="text-sm">
                          <div className="font-medium">{t("topbar.low_stock_alert", { count: lowStockCount })}</div>
                          <div className="text-xs text-muted-foreground">{t("topbar.low_stock_alert_desc")}</div>
                        </div>
                      </div>
                    </Link>
                  )}
                  {notifications.length === 0 && lowStockCount === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("topbar.no_notifications")}</div>
                  )}
                  {notifications.map(n => {
                    const href = notificationHref(n);
                    const content = (
                      <div
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer ${!n.isRead ? "bg-primary/5" : ""}`}
                        onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                      >
                        <LifeBuoy className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="text-sm flex-1 min-w-0">
                          <div className={`truncate ${!n.isRead ? "font-semibold" : "font-medium"}`}>{n.title}</div>
                          {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                          <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                        {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                      </div>
                    );
                    return href ? <Link key={n.id} href={href}>{content}</Link> : <div key={n.id}>{content}</div>;
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9 px-3 rounded-full">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase select-none">
                    {user.username.charAt(0)}
                  </div>
                  <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">{user.username}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="pb-1">
                  <div className="font-semibold truncate">{user.username}</div>
                  <div className="text-xs font-normal text-muted-foreground mt-0.5">
                    {t(`roles.${user.role}`)}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.isPlatformAdmin && (
                  <Link href="/platform">
                    <DropdownMenuItem className="cursor-pointer">
                      <ShieldCheck className="me-2 h-4 w-4" />
                      {t("topbar.platform_admin")}
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="me-2 h-4 w-4" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
