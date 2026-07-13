"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { dictionaries, interpolate, type Locale } from "@/lib/dictionaries";

interface LocaleState {
  locale: Locale;
  dict: (typeof dictionaries)["ar"];
  t: (path: string, vars?: Record<string, string | number>) => string;
  toggle: () => void;
}

const LocaleContext = createContext<LocaleState | null>(null);

function resolve(dict: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

/** Wraps a page with the ar/en locale + RTL/LTR direction, defaulting to
 * the restaurant's configured language and persisting the visitor's choice. */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = localStorage.getItem("spruvex:ordering:locale") as Locale | null;
    if (stored === "ar" || stored === "en") {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("spruvex:ordering:locale", locale);
  }, [locale]);

  const toggle = useCallback(() => setLocale((current) => (current === "ar" ? "en" : "ar")), []);

  const dict = dictionaries[locale];
  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const template = resolve(dict, path);
      return vars ? interpolate(template, vars) : template;
    },
    [dict],
  );

  return (
    <LocaleContext.Provider value={{ locale, dict, t, toggle }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

/** Picks the localized name/description from a bilingual API record. */
export function useLocalizedField() {
  const { locale } = useLocale();
  return (item: { name?: string; nameEn?: string | null }) =>
    locale === "en" && item.nameEn ? item.nameEn : (item.name ?? "");
}
