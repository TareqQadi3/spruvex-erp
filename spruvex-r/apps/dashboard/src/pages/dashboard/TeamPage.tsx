import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, Spinner } from "@spruvex-r/ui";

import { api } from "../../lib/api";

interface Member {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { key: string; nameAr: string; nameEn: string };
  branch: { id: string; name: string } | null;
}

export function TeamPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Member[]>("/users"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("team.title")}</h1>
      {isLoading && <Spinner />}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-start">
                  <th className="p-3 text-start font-medium">{t("auth.name")}</th>
                  <th className="p-3 text-start font-medium">{t("auth.email")}</th>
                  <th className="p-3 text-start font-medium">{t("team.role")}</th>
                  <th className="p-3 text-start font-medium">{t("team.branch")}</th>
                  <th className="p-3 text-start font-medium">{t("team.lastLogin")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((member) => (
                  <tr key={`${member.userId}-${member.role.key}`} className="border-b last:border-0">
                    <td className="p-3 font-medium">{member.name}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">
                      {member.email}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {i18n.language === "ar" ? member.role.nameAr : member.role.nameEn}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {member.branch?.name ?? t("team.allBranches")}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString(
                            i18n.language === "ar" ? "ar-SA" : "en-US",
                          )
                        : t("team.never")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
