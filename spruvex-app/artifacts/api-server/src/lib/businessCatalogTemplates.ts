// Starter catalog suggested for each business type during the first-setup
// wizard (Setup Wizard step "create my first section/product") and the later
// opt-in "add ready-made products for this business" prompt. Deliberately
// small (one main category, one sub-category, 1-2 products) — the point is
// to hand the merchant a non-empty, working store to start from, not to be a
// full product database. The merchant can edit or delete every seeded row.
import type { BusinessType } from "../modules/auth/types/auth.types";

export interface CatalogTemplateProduct {
  name: string;
  nameEn: string;
  sellingPrice: number;
  skuSuffix: string; // appended to a per-seed prefix to keep SKUs unique
}

export interface CatalogTemplateCategory {
  name: string;
  nameEn: string;
  subcategory: { name: string; nameEn: string };
  products: CatalogTemplateProduct[];
}

const TEMPLATES: Record<BusinessType, CatalogTemplateCategory> = {
  electronics: {
    name: "جوالات",
    nameEn: "Phones",
    subcategory: { name: "آيفون", nameEn: "iPhone" },
    products: [
      { name: "جراب حماية", nameEn: "Phone Case", sellingPrice: 25, skuSuffix: "CASE" },
      { name: "شاحن سريع", nameEn: "Fast Charger", sellingPrice: 45, skuSuffix: "CHRG" },
    ],
  },
  grocery: {
    name: "مشروبات",
    nameEn: "Beverages",
    subcategory: { name: "مياه", nameEn: "Water" },
    products: [
      { name: "مياه 330 مل", nameEn: "Water 330ml", sellingPrice: 1, skuSuffix: "WTR330" },
    ],
  },
  repair: {
    name: "قطع غيار",
    nameEn: "Spare Parts",
    subcategory: { name: "شاشات", nameEn: "Screens" },
    products: [
      { name: "شاشة عامة", nameEn: "Generic Screen", sellingPrice: 150, skuSuffix: "SCRN" },
    ],
  },
  restaurant: {
    name: "المشروبات",
    nameEn: "Drinks",
    subcategory: { name: "مشروبات ساخنة", nameEn: "Hot Drinks" },
    products: [
      { name: "قهوة", nameEn: "Coffee", sellingPrice: 12, skuSuffix: "COFFEE" },
    ],
  },
  cafe: {
    name: "القهوة",
    nameEn: "Coffee",
    subcategory: { name: "مشروبات ساخنة", nameEn: "Hot Drinks" },
    products: [
      { name: "لاتيه", nameEn: "Latte", sellingPrice: 16, skuSuffix: "LATTE" },
      { name: "كابتشينو", nameEn: "Cappuccino", sellingPrice: 16, skuSuffix: "CAPP" },
    ],
  },
  clothing: {
    name: "ملابس رجالية",
    nameEn: "Men's Wear",
    subcategory: { name: "قمصان", nameEn: "Shirts" },
    products: [
      { name: "قميص قطن", nameEn: "Cotton Shirt", sellingPrice: 99, skuSuffix: "SHIRT" },
    ],
  },
  ecommerce: {
    name: "منتجات عامة",
    nameEn: "General Products",
    subcategory: { name: "الأكثر مبيعاً", nameEn: "Best Sellers" },
    products: [
      { name: "منتج تجريبي", nameEn: "Sample Product", sellingPrice: 50, skuSuffix: "SAMPLE" },
    ],
  },
  retail: {
    name: "منتجات عامة",
    nameEn: "General Products",
    subcategory: { name: "متنوعة", nameEn: "Misc" },
    products: [
      { name: "منتج تجريبي", nameEn: "Sample Product", sellingPrice: 50, skuSuffix: "SAMPLE" },
    ],
  },
  other: {
    name: "منتجات عامة",
    nameEn: "General Products",
    subcategory: { name: "متنوعة", nameEn: "Misc" },
    products: [
      { name: "منتج تجريبي", nameEn: "Sample Product", sellingPrice: 50, skuSuffix: "SAMPLE" },
    ],
  },
};

export function getCatalogTemplate(businessType: BusinessType): CatalogTemplateCategory {
  return TEMPLATES[businessType];
}
