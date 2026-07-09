import { Bell, Search, LogOut, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

export function Topbar() {
  const { data: products } = useGetProducts({ lowStock: true });
  const lowStockCount = products?.length || 0;
  const { t, lang, setLang } = useTranslation();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

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
          <Button variant="ghost" size="icon" className="relative">
            <span className="sr-only">{t("topbar.notifications")}</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {lowStockCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -end-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
              >
                {lowStockCount}
              </Badge>
            )}
          </Button>
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
