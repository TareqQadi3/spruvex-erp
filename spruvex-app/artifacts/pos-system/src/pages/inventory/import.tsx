import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetProductsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

const IMPORT_FIELDS = [
  "name",
  "sku",
  "barcode",
  "sellingPrice",
  "costPrice",
  "stock",
  "lowStockThreshold",
  "category",
  "brand",
] as const;

type ImportField = (typeof IMPORT_FIELDS)[number];

// English and Arabic column headers are both accepted. Keys are normalized
// (lowercase, no spaces/underscores/dashes) before comparison.
const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "productname", "product", "item", "itemname", "الاسم", "اسم", "اسمالمنتج", "اسمالمادة", "الصنف"],
  sku: ["sku", "skucode", "code", "الرمز", "كود", "رمز", "رمزالمنتج", "رقمالمنتج"],
  barcode: ["barcode", "barcodenumber", "upc", "الباركود", "باركود"],
  sellingPrice: ["sellingprice", "saleprice", "price", "unitprice", "سعرالبيع", "السعر", "سعر", "سعرالبيع"],
  costPrice: ["costprice", "cost", "costprice", "سعرالتكلفة", "التكلفة", "سعرالشراء", "تكلفة"],
  stock: ["stock", "quantity", "qty", "onhand", "inventory", "الكمية", "كمية", "المخزون", "الرصيد", "رصيد"],
  lowStockThreshold: ["lowstockthreshold", "lowstock", "reorderlevel", "alertthreshold", "حدالتنبيه", "الحدالادنى", "حدالامان"],
  category: ["category", "categories", "group", "الفئة", "التصنيف", "فئة", "القسم", "قسم", "تصنيف"],
  brand: ["brand", "maker", "العلامةالتجارية", "العلامة", "الماركة", "ماركة", "براند"],
};

const FIELD_LABEL_KEYS: Record<ImportField, string> = {
  name: "productImport.name",
  sku: "productImport.sku",
  barcode: "productImport.barcode",
  sellingPrice: "productImport.selling_price",
  costPrice: "productImport.cost_price",
  stock: "productImport.stock",
  lowStockThreshold: "productImport.low_stock_threshold",
  category: "productImport.category",
  brand: "productImport.brand",
};

interface ParsedRow {
  rowNumber: number;
  values: Record<ImportField, string>;
  errors: string[];
}

interface BulkResult {
  created: number;
  skipped: Array<{ row: number; error: string }>;
}

type Step = "upload" | "preview" | "results";

const NUMERIC_FIELDS: ImportField[] = ["sellingPrice", "costPrice", "stock", "lowStockThreshold"];

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
}

function buildColumnMap(columns: string[]): Partial<Record<ImportField, string>> {
  const map: Partial<Record<ImportField, string>> = {};
  const normalized = new Map(columns.map((c) => [normalizeHeader(c), c]));
  for (const field of IMPORT_FIELDS) {
    for (const alias of FIELD_ALIASES[field]) {
      const hit = normalized.get(alias);
      if (hit) {
        map[field] = hit;
        break;
      }
    }
  }
  return map;
}

function extractValues(row: Record<string, unknown>, columnMap: Partial<Record<ImportField, string>>): Record<ImportField, string> {
  const values = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    const col = columnMap[field];
    const v = col ? row[col] : undefined;
    values[field] = v == null ? "" : String(v).trim();
  }
  return values;
}

// Accepts Western, Arabic-Indic (٠-٩) and Eastern Arabic / Persian (۰-۹)
// digits, plus comma decimal separators, so Arabic-locale files parse cleanly.
function toNumber(s: string): number {
  const eastern = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  let v = s.trim();
  v = v.replace(/[٠-٩]/g, (d) => String(eastern.indexOf(d)));
  v = v.replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
  return Number(v.replace(",", "."));
}

function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    });
  });
}

async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export default function ProductImportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<ImportField, string>>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const parsedRows = useMemo<ParsedRow[]>(() => {
    return rawRows.map((row, i) => {
      const values = extractValues(row, columnMap);
      const errors: string[] = [];
      if (!values.name) errors.push(t("productImport.errors_required", { field: t("productImport.name") }));
      if (!values.sku) errors.push(t("productImport.errors_required", { field: t("productImport.sku") }));
      for (const field of NUMERIC_FIELDS) {
        const v = values[field];
        if (v && Number.isNaN(toNumber(v))) {
          errors.push(t("productImport.errors_invalid_number", { field: t(FIELD_LABEL_KEYS[field]) }));
        }
      }
      return { rowNumber: i + 2, values, errors };
    });
  }, [rawRows, columnMap, t]);

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const invalidCount = parsedRows.length - validCount;

  const importMutation = useMutation({
    mutationFn: async () => {
      const products = parsedRows.map((r) => {
        const v = r.values;
        return {
          name: v.name,
          sku: v.sku,
          barcode: v.barcode || undefined,
          sellingPrice: toNumber(v.sellingPrice) || 0,
          costPrice: toNumber(v.costPrice) || 0,
          stock: toNumber(v.stock) || 0,
          lowStockThreshold: v.lowStockThreshold ? toNumber(v.lowStockThreshold) || 5 : 5,
          category: v.category || undefined,
          brand: v.brand || undefined,
        };
      });
      return api<BulkResult>("/products/bulk", {
        method: "POST",
        body: JSON.stringify({ products }),
      });
    },
    onSuccess: (res) => {
      setResult(res);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      toast.success(t("productImport.import_success"));
    },
    onError: () => toast.error(t("productImport.import_failed")),
  });

  const resetFlow = () => {
    setStep("upload");
    setFileName("");
    setRawRows([]);
    setColumnMap({});
    setIsValidated(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setResult(null);
    setStep("preview");
    try {
      let rows: Record<string, unknown>[];
      if (/\.csv$/i.test(file.name)) {
        rows = await parseCsvFile(file);
      } else if (/\.xlsx$|\.xls$/i.test(file.name)) {
        rows = await parseExcelFile(file);
      } else {
        toast.error(t("productImport.unsupported_format"));
        setStep("upload");
        return;
      }
      rows = rows.filter((r) => Object.values(r).some((v) => v != null && String(v).trim() !== ""));
      if (rows.length === 0) {
        toast.error(t("productImport.empty_file"));
        setStep("upload");
        return;
      }
      setFileName(file.name);
      setColumnMap(buildColumnMap(Object.keys(rows[0])));
      setRawRows(rows);
      setIsValidated(false);
    } catch {
      toast.error(t("productImport.parse_error"));
      setStep("upload");
    } finally {
      setIsParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const headers = ["Name", "SKU", "Selling Price", "Cost Price", "Stock", "Category", "Brand", "Barcode", "Low Stock Threshold"];
    const example = ["iPhone 15 Case", "ACC-IPH15-CASE", "150", "120", "50", "Accessories", "Apple", "6291041500213", "5"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "products");
    XLSX.writeFile(wb, "products-import-template.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("productImport.title")}</h1>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("productImport.upload_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("productImport.upload_desc")}</p>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFile}
                  className="text-sm"
                  disabled={isParsing}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("productImport.accepted_formats")}</p>
            </div>
            <div className="text-sm space-y-1">
              <p className="font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> {t("productImport.template_title")}
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="me-1.5 h-4 w-4" /> {t("productImport.download_template")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("productImport.preview_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isParsing ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {t("productImport.preview_desc", { file: fileName })}
                  </div>
                  {!isValidated ? (
                    <Button onClick={() => setIsValidated(true)}>
                      <CheckCircle2 className="me-2 h-4 w-4" /> {t("productImport.validate")}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">{t("productImport.valid")}: {validCount}</Badge>
                      {invalidCount > 0 && <Badge variant="destructive">{t("productImport.invalid")}: {invalidCount}</Badge>}
                      <span className="text-xs text-muted-foreground">{t("productImport.errors_will_be_skipped")}</span>
                    </div>
                  )}
                </div>

                <div className="max-h-96 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("productImport.row_number")}</TableHead>
                        <TableHead>{t("productImport.name")}</TableHead>
                        <TableHead>{t("productImport.sku")}</TableHead>
                        <TableHead className="text-end">{t("productImport.selling_price")}</TableHead>
                        <TableHead className="text-end">{t("productImport.cost_price")}</TableHead>
                        <TableHead className="text-end">{t("productImport.stock")}</TableHead>
                        <TableHead>{t("productImport.category")}</TableHead>
                        {isValidated && <TableHead>{t("productImport.errors")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((r) => (
                        <TableRow key={r.rowNumber} className={isValidated && r.errors.length > 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                          <TableCell className="font-medium">{r.values.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.values.sku || "—"}</TableCell>
                          <TableCell className="text-end">{r.values.sellingPrice || "—"}</TableCell>
                          <TableCell className="text-end">{r.values.costPrice || "—"}</TableCell>
                          <TableCell className="text-end">{r.values.stock || "—"}</TableCell>
                          <TableCell>{r.values.category || "—"}</TableCell>
                          {isValidated && (
                            <TableCell>
                              {r.errors.length > 0 ? (
                                <span className="flex items-center gap-1 text-xs text-destructive">
                                  <AlertCircle className="h-3 w-3 shrink-0" /> {r.errors.join(", ")}
                                </span>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {isValidated && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={() => setIsValidated(false)}>{t("common.edit")}</Button>
                    <Button
                      onClick={() => importMutation.mutate()}
                      disabled={importMutation.isPending || validCount === 0}
                    >
                      <Upload className="me-2 h-4 w-4" />
                      {importMutation.isPending ? t("common.saving") : t("productImport.import_products", { count: parsedRows.length })}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "results" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("productImport.results_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <Badge className="bg-green-600">{t("productImport.created")}: {result.created}</Badge>
              {result.skipped.length > 0 && (
                <Badge variant="destructive">{t("productImport.skipped")}: {result.skipped.length}</Badge>
              )}
            </div>

            {result.skipped.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("productImport.skipped_rows")}</p>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-3 text-xs space-y-1">
                  {result.skipped.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                      <span>
                        {t("productImport.file_row", { row: s.row + 1 })}: {s.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("productImport.no_skipped")}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={resetFlow}>
                <Upload className="me-2 h-4 w-4" /> {t("productImport.new_import")}
              </Button>
              <Link href="/inventory">
                <Button variant="outline">{t("productImport.back")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
