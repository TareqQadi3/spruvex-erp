import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@spruvex-r/ui";

const TABS = [
  { key: "tables", path: "/tables" },
  { key: "floors", path: "/tables/floors" },
];

export function TablesLayout() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.tables")}</h1>
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.path}
            end={tab.path === "/tables"}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {t(`tables.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
