import { common } from './common';
import { home } from './home';
import { features } from './features';
import { faq } from './faq';
import { contact } from './contact';
import { pricing } from './pricing';
import { pagesCopy } from './pagesCopy';

export type Lang = 'ar' | 'en';

const sections = [common, home, features, faq, contact, pricing, pagesCopy];

export const I18N: Record<Lang, Record<string, string>> = {
  ar: Object.assign({}, ...sections.map((s) => s.ar)),
  en: Object.assign({}, ...sections.map((s) => s.en)),
};

export function createT(lang: Lang) {
  return (key: string) => I18N[lang][key] || key;
}
