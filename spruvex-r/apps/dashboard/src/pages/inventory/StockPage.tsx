import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Badge, Button, Card, CardContent, Dialog, Input, Label, Select, Spinner } from "@spruvex-r/ui";

import { api, ApiError } from "../../lib/api";
import { localizedName } from "../../lib/catalog-api";
import { inventoryApi } from "../../lib/inventory-api";

interface BranchRow {
  id: string;
  name: string;
  nameEn: string | null;
}

type MovementKind = "purchase" | "waste" | "adjustment";

interface MovementForm {
  kind: MovementKind;
  ingredientId: string;
  locationId: string;
  quantity: string;
  unitCost: string;
  countedQuantity: string;
  reason: string;
}

const emptyMovementForm: MovementForm = {
  kind: "purchase",
  ingredientId: "",
  locationId: "",
  quantity: "",
  unitCost: "",
  countedQuantity: "",
  reason: "",
};

export function StockPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api<BranchRow[]>("/branches") });
  const [branchId, setBranchId] = useState("");
  const activeBranchId = branchId || branches.data?.[0]?.id || "";

  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients"],
    queryFn: inventoryApi.listIngredients,
  });
  const locations = useQuery({
    queryKey: ["inventory", "locations", activeBranchId],
    queryFn: () => inventoryApi.listLocations(activeBranchId),
    enabled: Boolean(activeBranchId),
  });
  const levels = useQuery({
    queryKey: ["inventory", "levels", activeBranchId],
    queryFn: () => inventoryApi.listLevels(activeBranchId),
    enabled: Boolean(activeBranchId),
  });
  const movements = useQuery({
    queryKey: ["inventory", "movements", activeBranchId],
    queryFn: () => inventoryApi.listMovements({ branchId: activeBranchId, limit: 30 }),
    enabled: Boolean(activeBranchId),
  });

  const invalidateStock = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  const [locationName, setLocationName] = useState("");
  const createLocation = useMutation({
    mutationFn: () => inventoryApi.createLocation({ branchId: activeBranchId, name: locationName }),
    onSuccess: async () => {
      setLocationName("");
      await invalidateStock();
    },
    onError: (e) => alert(e instanceof ApiError ? e.message : t("common.error")),
  });

  const [movementOpen, setMovementOpen] = useState(false);
  const [form, setForm] = useState<MovementForm>(emptyMovementForm);
  const [error, setError] = useState<string | null>(null);

  const recordMovement = useMutation({
    mutationFn: async () => {
      const base = {
        branchId: activeBranchId,
        ingredientId: form.ingredientId,
        ...(form.locationId ? { locationId: form.locationId } : {}),
        reason: form.reason || undefined,
      };
      if (form.kind === "purchase") {
        await inventoryApi.recordPurchase({ ...base, quantity: form.quantity, unitCost: form.unitCost });
      } else if (form.kind === "waste") {
        await inventoryApi.recordWaste({ ...base, quantity: form.quantity, reason: form.reason });
      } else {
        await inventoryApi.recordAdjustment({ ...base, countedQuantity: form.countedQuantity, reason: form.reason });
      }
    },
    onSuccess: async () => {
      await invalidateStock();
      setMovementOpen(false);
      setForm(emptyMovementForm);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("common.error")),
  });

  function openMovementDialog() {
    setError(null);
    setForm({ ...emptyMovementForm, ingredientId: ingredients.data?.[0]?.id ?? "" });
    setMovementOpen(true);
  }

  function submitMovement(event: FormEvent) {
    event.preventDefault();
    recordMovement.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("inventory.stock.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-48" value={activeBranchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {localizedName({ name: branch.name, nameEn: branch.nameEn }, i18n.language)}
              </option>
            ))}
          </Select>
          <Button onClick={openMovementDialog} disabled={!ingredients.data?.length}>
            <Plus className="h-4 w-4" /> {t("inventory.stock.recordMovement")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">{t("inventory.stock.locations")}</h3>
          <div className="flex flex-wrap gap-2">
            {locations.data?.map((location) => (
              <Badge key={location.id} variant={location.isDefault ? "default" : "muted"}>
                {localizedName(location, i18n.language)}
                {location.isDefault ? ` · ${t("inventory.stock.default")}` : ""}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              className="w-64"
              placeholder={t("inventory.stock.newLocationName")}
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!locationName || createLocation.isPending}
              onClick={() => createLocation.mutate()}
            >
              {t("inventory.stock.addLocation")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-start text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{t("inventory.stock.ingredient")}</th>
                <th className="p-3 text-start">{t("inventory.stock.location")}</th>
                <th className="p-3 text-start">{t("inventory.stock.quantity")}</th>
              </tr>
            </thead>
            <tbody>
              {levels.data?.map((level) => {
                const isLow =
                  level.ingredient.reorderLevel !== null &&
                  Number(level.quantity) <= Number(level.ingredient.reorderLevel);
                return (
                  <tr key={level.id} className="border-b last:border-0">
                    <td className="p-3">
                      {localizedName(level.ingredient, i18n.language)}
                      {isLow && (
                        <Badge variant="destructive" className="ms-2">
                          {t("inventory.stock.lowStock")}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{localizedName(level.location, i18n.language)}</td>
                    <td className="p-3" dir="ltr">
                      {level.quantity}
                    </td>
                  </tr>
                );
              })}
              {levels.data?.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    {t("inventory.stock.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">{t("inventory.stock.recentMovements")}</h3>
          <div className="space-y-1">
            {movements.data?.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <div>
                  <span className="font-medium">{localizedName(movement.ingredient, i18n.language)}</span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {t(`inventory.movementTypes.${movement.type}`)}
                    {movement.reason ? ` · ${movement.reason}` : ""}
                  </span>
                </div>
                <span dir="ltr" className={Number(movement.quantity) < 0 ? "text-destructive" : "text-primary"}>
                  {movement.quantity}
                </span>
              </div>
            ))}
            {movements.data?.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">{t("inventory.stock.empty")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={movementOpen} onClose={() => setMovementOpen(false)} title={t("inventory.stock.recordMovement")}>
        <form onSubmit={submitMovement} className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="mkind">{t("inventory.stock.movementType")}</Label>
            <Select
              id="mkind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as MovementKind })}
            >
              <option value="purchase">{t("inventory.movementTypes.purchase")}</option>
              <option value="waste">{t("inventory.movementTypes.waste")}</option>
              <option value="adjustment">{t("inventory.movementTypes.adjustment")}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mingredient">{t("inventory.stock.ingredient")}</Label>
            <Select
              id="mingredient"
              required
              value={form.ingredientId}
              onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}
            >
              {ingredients.data?.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {localizedName(ingredient, i18n.language)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mlocation">{t("inventory.stock.location")}</Label>
            <Select
              id="mlocation"
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">{t("inventory.stock.defaultLocation")}</option>
              {locations.data?.map((location) => (
                <option key={location.id} value={location.id}>
                  {localizedName(location, i18n.language)}
                </option>
              ))}
            </Select>
          </div>

          {form.kind === "adjustment" ? (
            <div className="space-y-2">
              <Label htmlFor="mcounted">{t("inventory.stock.countedQuantity")}</Label>
              <Input
                id="mcounted"
                dir="ltr"
                required
                inputMode="decimal"
                value={form.countedQuantity}
                onChange={(e) => setForm({ ...form, countedQuantity: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqty">{t("inventory.stock.quantity")}</Label>
                <Input
                  id="mqty"
                  dir="ltr"
                  required
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              {form.kind === "purchase" && (
                <div className="space-y-2">
                  <Label htmlFor="munitcost">{t("inventory.stock.unitCost")}</Label>
                  <Input
                    id="munitcost"
                    dir="ltr"
                    required
                    inputMode="decimal"
                    value={form.unitCost}
                    onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mreason">{t("inventory.stock.reason")}</Label>
            <Input
              id="mreason"
              required={form.kind !== "purchase"}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>
              {t("catalog.cancel")}
            </Button>
            <Button type="submit" disabled={recordMovement.isPending}>
              {recordMovement.isPending ? <Spinner className="border-primary-foreground" /> : t("common.save")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
