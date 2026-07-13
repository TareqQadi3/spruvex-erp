"use client";

import Link from "next/link";

import { Card, CardContent } from "@spruvex-r/ui";

import { useLocale, useLocalizedField } from "@/components/LocaleProvider";

interface Branch {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  address: string | null;
  phone: string | null;
}

export function RestaurantBranchList({ slug, branches }: { slug: string; branches: Branch[] }) {
  const { t } = useLocale();
  const name = useLocalizedField();

  if (branches.length === 0) return null;

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <h2 className="text-lg font-bold">{t("restaurant.chooseBranch")}</h2>
      {branches.map((branch) => (
        <Link key={branch.id} href={`/restaurant/${slug}/${branch.slug}`}>
          <Card className="transition-colors active:bg-muted">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{name(branch)}</p>
                {branch.address && (
                  <p className="text-xs text-muted-foreground">{branch.address}</p>
                )}
              </div>
              <span className="text-sm font-medium text-primary">{t("restaurant.viewMenu")}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
