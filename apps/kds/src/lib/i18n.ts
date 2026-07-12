import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "../locales/ar.json";
import en from "../locales/en.json";

const stored = localStorage.getItem("spruvex:kds:locale");
const initial = stored === "en" ? "en" : "ar";

export function applyDocumentDirection(locale: string) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: initial,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

applyDocumentDirection(initial);
i18n.on("languageChanged", (lng) => {
  const locale = lng === "en" ? "en" : "ar";
  localStorage.setItem("spruvex:kds:locale", locale);
  applyDocumentDirection(locale);
});

export default i18n;
