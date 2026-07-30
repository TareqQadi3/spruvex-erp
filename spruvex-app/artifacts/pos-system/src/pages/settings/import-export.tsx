import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

interface FieldConfig { key: string; label: string; required: boolean; type: string; aliases: string[]; }
interface EntityConfig { fields: FieldConfig[]; duplicateKeys: string[]; }
interface ValidatedRow { rowIndex: number; mapped: Record<string, string>; errors: string[]; duplicate?: { matchedBy: string; existingLabel: string }; }
interface MappingTemplate { id: string; entityType: string; name: string; mapping: Record<string, string>; }

const ENTITY_TYPES = ["products", "customers", "suppliers"] as const;
const EXPORT_TYPES = [
  { key: "products", label: "المنتجات" },
  { key: "customers", label: "العملاء" },
  { key: "suppliers", label: "الموردون" },
  { key: "sales", label: "المبيعات" },
  { key: "stock-movements", label: "حركات المخزون" },
];

type Step = "upload" | "mapping" | "preview" | "results";

export default function ImportExportPage() {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState<string>("products");
  const [configs, setConfigs] = useState<Record<string, EntityConfig>>({});
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<{ total: number; validCount: number; invalidCount: number; duplicateCount: number; rows: ValidatedRow[] } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "create_new">("skip");
  const [results, setResults] = useState<{ created: number; updated: number; skipped: number; failed: Array<{ row: number; error: string }> } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => { authFetch("/import/entity-configs").then(setConfigs); }, []);

  useEffect(() => {
    authFetch(`/import/mapping-templates?entityType=${entityType}`).then(setTemplates).catch(() => setTemplates([]));
  }, [entityType]);

  const config = configs[entityType];

  const applyTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) setMapping(tpl.mapping);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const created = await authFetch("/import/mapping-templates", {
        method: "POST",
        body: JSON.stringify({ entityType, name: templateName.trim(), mapping }),
      });
      setTemplates(prev => [...prev, created]);
      setTemplateName("");
      toast.success(t("importExport.template_saved"));
    } catch {
      toast.error(t("importExport.template_save_failed"));
    }
  };

  const resetFlow = () => {
    setStep("upload"); setFileName(""); setColumns([]); setRows([]); setMapping({}); setValidation(null); setResults(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (parsed.length === 0) {
      toast.error(t("importExport.empty_file"));
      return;
    }
    const cols = Object.keys(parsed[0]);
    setColumns(cols);
    setRows(parsed);
    const suggested = await authFetch("/import/suggest-mapping", { method: "POST", body: JSON.stringify({ entityType, columns: cols }) });
    setMapping(suggested);
    setStep("mapping");
  };

  const handleValidate = async () => {
    setIsBusy(true);
    try {
      const result = await authFetch("/import/validate", { method: "POST", body: JSON.stringify({ entityType, mapping, rows }) });
      setValidation(result);
      setStep("preview");
    } catch {
      toast.error(t("importExport.validate_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleExecute = async () => {
    setIsBusy(true);
    try {
      const result = await authFetch("/import/execute", {
        method: "POST",
        body: JSON.stringify({ entityType, mapping, rows, duplicateStrategy, fileName }),
      });
      setResults(result);
      setStep("results");
      toast.success(t("importExport.import_done"));
    } catch {
      toast.error(t("importExport.import_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const downloadTemplate = () => {
    if (!config) return;
    const headers = config.fields.map(f => f.label);
    const ws = XLSX.utils.aoa_to_sheet([headers, config.fields.map(f => f.required ? t("importExport.required") : "")]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, entityType);
    XLSX.writeFile(wb, `${entityType}-template.xlsx`);
  };

  const handleExport = async (key: string) => {
    try {
      const data = await authFetch(`/export/${key}`);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, key);
      XLSX.writeFile(wb, `${key}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error(t("importExport.export_failed"));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("importExport.title")}</h1>
      </div>

      {/* ─── Import ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("importExport.import_title")}</CardTitle>
          <CardDescription>{t("importExport.import_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>{t("importExport.entity_type")}</Label>
            <Select value={entityType} onValueChange={v => { setEntityType(v); resetFlow(); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(e => <SelectItem key={e} value={e}>{t(`importExport.entity_${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="me-1.5 h-4 w-4" /> {t("importExport.download_template")}
            </Button>
          </div>

          {step === "upload" && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="text-sm" />
              <p className="text-xs text-muted-foreground mt-2">{t("importExport.upload_hint")}</p>
            </div>
          )}

          {step === "mapping" && config && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("importExport.mapping_hint", { count: rows.length })}</p>

              {templates.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">{t("importExport.load_template")}</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="w-64"><SelectValue placeholder={t("importExport.select_template")} /></SelectTrigger>
                    <SelectContent>
                      {templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("importExport.target_field")}</TableHead>
                    <TableHead>{t("importExport.source_column")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.fields.map(f => (
                    <TableRow key={f.key}>
                      <TableCell>{f.label}{f.required && <span className="text-destructive"> *</span>}</TableCell>
                      <TableCell>
                        <Select value={mapping[f.key] ?? "__none__"} onValueChange={v => setMapping(prev => ({ ...prev, [f.key]: v === "__none__" ? "" : v }))}>
                          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t("importExport.not_mapped")}</SelectItem>
                            {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center gap-2">
                <Input
                  className="w-56"
                  placeholder={t("importExport.template_name_placeholder")}
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={saveTemplate} disabled={!templateName.trim()}>
                  {t("importExport.save_template")}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetFlow}>{t("common.cancel")}</Button>
                <Button onClick={handleValidate} disabled={isBusy}>{isBusy ? t("common.loading") : t("importExport.validate")}</Button>
              </div>
            </div>
          )}

          {step === "preview" && validation && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <Badge variant="secondary">{t("importExport.total")}: {validation.total}</Badge>
                <Badge className="bg-green-600">{t("importExport.valid")}: {validation.validCount}</Badge>
                {validation.invalidCount > 0 && <Badge variant="destructive">{t("importExport.invalid")}: {validation.invalidCount}</Badge>}
                {validation.duplicateCount > 0 && <Badge variant="outline">{t("importExport.duplicates")}: {validation.duplicateCount}</Badge>}
              </div>

              {validation.duplicateCount > 0 && (
                <div className="space-y-1.5">
                  <Label>{t("importExport.duplicate_strategy")}</Label>
                  <Select value={duplicateStrategy} onValueChange={v => setDuplicateStrategy(v as any)}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">{t("importExport.strategy_skip")}</SelectItem>
                      <SelectItem value="update">{t("importExport.strategy_update")}</SelectItem>
                      <SelectItem value="create_new">{t("importExport.strategy_create_new")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>#</TableHead><TableHead>{t("common.actions")}</TableHead><TableHead>{t("importExport.note")}</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {validation.rows.map(r => (
                      <TableRow key={r.rowIndex}>
                        <TableCell>{r.rowIndex + 1}</TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="destructive"><AlertCircle className="h-3 w-3 me-1" />{t("importExport.invalid")}</Badge>
                          ) : r.duplicate ? (
                            <Badge variant="outline">{t("importExport.duplicate")}</Badge>
                          ) : (
                            <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 me-1" />{t("importExport.valid")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.errors.join("، ") || (r.duplicate ? `${t("importExport.matched_by")}: ${r.duplicate.matchedBy}` : "")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>{t("common.edit")}</Button>
                <Button onClick={handleExecute} disabled={isBusy || validation.validCount === 0}>
                  {isBusy ? t("common.saving") : t("importExport.confirm_import")}
                </Button>
              </div>
            </div>
          )}

          {step === "results" && results && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm flex-wrap">
                <Badge className="bg-green-600">{t("importExport.created")}: {results.created}</Badge>
                <Badge className="bg-blue-600">{t("importExport.updated")}: {results.updated}</Badge>
                <Badge variant="secondary">{t("importExport.skipped")}: {results.skipped}</Badge>
                {results.failed.length > 0 && <Badge variant="destructive">{t("importExport.failed")}: {results.failed.length}</Badge>}
              </div>
              {results.failed.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-3 text-xs space-y-1">
                  {results.failed.map((f, i) => <div key={i}>{t("importExport.row")} {f.row}: {f.error}</div>)}
                </div>
              )}
              <Button onClick={resetFlow}>{t("importExport.new_import")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Export ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("importExport.export_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXPORT_TYPES.map(e => (
            <Button key={e.key} variant="outline" onClick={() => handleExport(e.key)}>
              <Download className="me-1.5 h-4 w-4" /> {e.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
