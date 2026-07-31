import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface CompanyUnit { id: string; nameAr: string; symbol: string | null; }
interface ProductUnit { id: string; unitId: string; unitName: string; conversionFactor: string; isBaseUnit: boolean; }

export function UnitsTab({ productId, authFetch }: {
  productId: string;
  authFetch: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const { t } = useTranslation();
  const [companyUnits, setCompanyUnits] = useState<CompanyUnit[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [newUnitName, setNewUnitName] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [conversionFactor, setConversionFactor] = useState("1");

  const loadCompanyUnits = () => authFetch("/units").then(setCompanyUnits);
  const loadProductUnits = () => authFetch(`/products/${productId}/units`).then(setProductUnits);
  useEffect(() => { loadCompanyUnits(); loadProductUnits(); }, [productId]);

  const handleAddCompanyUnit = () => {
    if (!newUnitName.trim()) return;
    authFetch("/units", { method: "POST", body: JSON.stringify({ nameAr: newUnitName.trim() }) })
      .then(() => { setNewUnitName(""); loadCompanyUnits(); })
      .catch(() => toast.error(t("units.unit_create_failed")));
  };

  const handleAssignUnit = () => {
    if (!selectedUnitId || !conversionFactor) return;
    authFetch(`/products/${productId}/units`, {
      method: "POST",
      body: JSON.stringify({ unitId: selectedUnitId, conversionFactor: Number(conversionFactor) }),
    })
      .then(() => { toast.success(t("units.assigned_success")); setSelectedUnitId(""); setConversionFactor("1"); loadProductUnits(); })
      .catch(() => toast.error(t("units.assign_failed")));
  };

  const removeProductUnit = (id: string) => {
    authFetch(`/products/${productId}/units/${id}`, { method: "DELETE" })
      .then(() => loadProductUnits())
      .catch(() => toast.error(t("units.remove_failed")));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("units.tab_units")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {productUnits.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.unit")}</TableHead>
                  <TableHead>{t("units.conversion_factor")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productUnits.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.unitName}</TableCell>
                    <TableCell>1 {u.unitName} = {u.conversionFactor} {t("units.base_unit")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeProductUnit(u.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="space-y-1.5">
              <Label>{t("units.unit")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedUnitId}
                onChange={e => setSelectedUnitId(e.target.value)}
              >
                <option value="">{t("units.select_unit")}</option>
                {companyUnits.map(u => <option key={u.id} value={u.id}>{u.nameAr}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("units.conversion_factor")}</Label>
              <Input type="number" value={conversionFactor} onChange={e => setConversionFactor(e.target.value)} placeholder="24" />
            </div>
            <Button onClick={handleAssignUnit} disabled={!selectedUnitId}>{t("units.assign")}</Button>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder={t("units.new_unit_placeholder")}
              value={newUnitName}
              onChange={e => setNewUnitName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAddCompanyUnit(); }}
            />
            <Button variant="outline" onClick={handleAddCompanyUnit}>
              <Plus className="me-1.5 h-4 w-4" /> {t("units.add_unit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
