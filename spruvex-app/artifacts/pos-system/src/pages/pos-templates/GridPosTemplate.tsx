import { UtensilsCrossed } from "lucide-react";
import { ComingSoonPosTemplate } from "./ComingSoonPosTemplate";

// Sectioned grid of product buttons with images and add-ons — for
// restaurants, cafes, dessert shops (businessTypeDefaults.ts: "restaurant").
export function GridPosTemplate({ onUseListTemplate }: { onUseListTemplate: () => void }) {
  return (
    <ComingSoonPosTemplate
      icon={UtensilsCrossed}
      titleKey="pos.templates.grid_title"
      descKey="pos.templates.grid_desc"
      onUseListTemplate={onUseListTemplate}
    />
  );
}
