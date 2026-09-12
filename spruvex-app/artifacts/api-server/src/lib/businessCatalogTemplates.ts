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
  // Non-stock line item (a service, not a physical good) — see
  // products.isService. Omitted/false for every pre-existing template;
  // service-heavy business types (contracting, salons...) set it true.
  isService?: boolean;
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
  mobile_repair: {
    name: "جوالات وصيانة",
    nameEn: "Mobile Phones & Repair",
    subcategory: { name: "اكسسوارات", nameEn: "Accessories" },
    products: [
      { name: "جراب حماية", nameEn: "Phone Case", sellingPrice: 25, skuSuffix: "CASE" },
      // Demonstrates the isService capability from day one — a repair shop's
      // most common line item is a service, not a stocked accessory.
      { name: "خدمة تركيب شاشة", nameEn: "Screen Replacement Service", sellingPrice: 100, skuSuffix: "SCRNSVC", isService: true },
    ],
  },
  contracting: {
    name: "أعمال المقاولات",
    nameEn: "Contracting Works",
    subcategory: { name: "خدمات عامة", nameEn: "General Services" },
    products: [
      { name: "معاينة وتقييم الموقع", nameEn: "Site Survey & Assessment", sellingPrice: 200, skuSuffix: "SURVEY", isService: true },
      { name: "أعمال توريد وتركيب", nameEn: "Supply & Installation Works", sellingPrice: 500, skuSuffix: "INSTALL", isService: true },
    ],
  },
  pharmacy: {
    name: "أدوية بدون وصفة",
    nameEn: "Over-the-Counter Medicine",
    subcategory: { name: "مسكنات", nameEn: "Pain Relief" },
    products: [
      { name: "باراسيتامول 500مج", nameEn: "Paracetamol 500mg", sellingPrice: 8, skuSuffix: "PARA500" },
    ],
  },
  salon_beauty: {
    name: "خدمات الشعر",
    nameEn: "Hair Services",
    subcategory: { name: "قص وتصفيف", nameEn: "Cut & Style" },
    products: [
      { name: "قص شعر", nameEn: "Haircut", sellingPrice: 40, skuSuffix: "HAIRCUT", isService: true },
      { name: "صبغة شعر", nameEn: "Hair Coloring", sellingPrice: 120, skuSuffix: "COLOR", isService: true },
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
