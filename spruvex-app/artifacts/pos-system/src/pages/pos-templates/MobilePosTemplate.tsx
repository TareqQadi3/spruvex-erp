import { Smartphone } from "lucide-react";
import { ComingSoonPosTemplate } from "./ComingSoonPosTemplate";

// Variant picker (color/storage/model/warranty) + linked accessories — for
// phone and electronics shops (businessTypeDefaults.ts: "electronics").
export function MobilePosTemplate({ onUseListTemplate }: { onUseListTemplate: () => void }) {
  return (
    <ComingSoonPosTemplate
      icon={Smartphone}
      titleKey="pos.templates.mobile_title"
      descKey="pos.templates.mobile_desc"
      onUseListTemplate={onUseListTemplate}
    />
  );
}
