import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

export type Lang = "en" | "ar";

const TRANSLATIONS: Record<Lang, Record<string, any>> = { en, ar };

interface I18nContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isRTL: boolean;
}

const ctx = createContext<I18nContext>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  isRTL: false,
});

function resolve(dict: Record<string, any>, key: string): string {
  const parts = key.split(".");
  let val: any = dict;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined) return key;
  }
  return typeof val === "string" ? val : key;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("pos_lang");
    return (saved === "ar" || saved === "en") ? saved : "en";
  });

  useEffect(() => {
    localStorage.setItem("pos_lang", lang);
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-dir", dir);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let str = resolve(TRANSLATIONS[lang], key);
    if (str === key) str = resolve(TRANSLATIONS["en"], key);
    if (vars) {
      str = Object.entries(vars).reduce(
        (s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)),
        str
      );
    }
    return str;
  }, [lang]);

  const isRTL = lang === "ar";

  const value = useMemo(() => ({ lang, setLang, t, isRTL }), [lang, setLang, t, isRTL]);

  return <ctx.Provider value={value}>{children}</ctx.Provider>;
}

export function useTranslation() {
  return useContext(ctx);
}
