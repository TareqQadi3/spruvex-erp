// Registry of importable entity types. Adding a new one (e.g. "categories"
// as its own standalone import instead of implicit-via-products) is: add a
// config object here, nothing else in the pipeline (routes/import.ts) needs
// to change — it reads this registry generically.
export interface ImportFieldConfig {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "number";
  aliases: string[]; // case-insensitive source-column names this field auto-maps from
}

export interface EntityImportConfig {
  fields: ImportFieldConfig[];
  duplicateKeys: string[]; // checked in this priority order
}

export const IMPORT_ENTITY_CONFIGS: Record<string, EntityImportConfig> = {
  products: {
    duplicateKeys: ["barcode", "sku", "name"],
    fields: [
      { key: "name", label: "اسم المنتج", required: true, type: "string", aliases: ["name", "product name", "اسم المنتج", "اسم الصنف", "الاسم"] },
      { key: "nameEn", label: "الاسم بالإنجليزي", required: false, type: "string", aliases: ["name en", "english name"] },
      { key: "sku", label: "SKU", required: true, type: "string", aliases: ["sku", "code", "رمز المنتج", "الكود"] },
      { key: "barcode", label: "الباركود", required: false, type: "string", aliases: ["barcode", "الباركود"] },
      { key: "description", label: "الوصف", required: false, type: "string", aliases: ["description", "الوصف"] },
      { key: "costPrice", label: "سعر التكلفة", required: false, type: "number", aliases: ["cost price", "cost", "سعر التكلفة", "التكلفة"] },
      { key: "sellingPrice", label: "سعر البيع", required: true, type: "number", aliases: ["selling price", "price", "سعر البيع", "السعر"] },
      { key: "stock", label: "الكمية (المخزون الافتتاحي)", required: false, type: "number", aliases: ["stock", "quantity", "opening stock", "الكمية", "المخزون"] },
      { key: "lowStockThreshold", label: "حد التنبيه", required: false, type: "number", aliases: ["low stock threshold", "reorder level"] },
      { key: "category", label: "القسم", required: false, type: "string", aliases: ["category", "القسم", "التصنيف"] },
      { key: "brand", label: "الماركة", required: false, type: "string", aliases: ["brand", "الماركة"] },
      { key: "unit", label: "الوحدة", required: false, type: "string", aliases: ["unit", "الوحدة"] },
      { key: "conversionFactor", label: "معامل التحويل للوحدة", required: false, type: "number", aliases: ["conversion factor", "معامل التحويل"] },
      { key: "variantOfSku", label: "SKU المنتج الأساسي (Variant من)", required: false, type: "string", aliases: ["parent sku", "variant of", "المنتج الأساسي"] },
      { key: "variantAttributes", label: "خصائص المتغير (مثال Color:Black;Storage:256GB)", required: false, type: "string", aliases: ["variant attributes", "خصائص المتغير"] },
    ],
  },
  customers: {
    duplicateKeys: ["phone", "email", "name"],
    fields: [
      { key: "name", label: "الاسم", required: true, type: "string", aliases: ["name", "الاسم", "اسم العميل"] },
      { key: "phone", label: "الجوال", required: false, type: "string", aliases: ["phone", "mobile", "الجوال", "رقم الجوال"] },
      { key: "email", label: "البريد الإلكتروني", required: false, type: "string", aliases: ["email", "البريد الإلكتروني"] },
      { key: "address", label: "العنوان", required: false, type: "string", aliases: ["address", "العنوان"] },
    ],
  },
  suppliers: {
    duplicateKeys: ["name", "phone"],
    fields: [
      { key: "name", label: "اسم المورد", required: true, type: "string", aliases: ["name", "supplier name", "اسم المورد", "الاسم"] },
      { key: "phone", label: "الجوال", required: false, type: "string", aliases: ["phone", "mobile", "الجوال"] },
      { key: "email", label: "البريد الإلكتروني", required: false, type: "string", aliases: ["email", "البريد الإلكتروني"] },
      { key: "address", label: "العنوان", required: false, type: "string", aliases: ["address", "العنوان"] },
      { key: "notes", label: "ملاحظات", required: false, type: "string", aliases: ["notes", "ملاحظات"] },
    ],
  },
};

export function suggestMapping(entityType: string, columns: string[]): Record<string, string> {
  const config = IMPORT_ENTITY_CONFIGS[entityType];
  if (!config) return {};
  const mapping: Record<string, string> = {};
  for (const field of config.fields) {
    const match = columns.find(col => field.aliases.includes(col.trim().toLowerCase()));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}
