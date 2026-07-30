import { Shirt } from "lucide-react";
import { ComingSoonPosTemplate } from "./ComingSoonPosTemplate";

// Large product-photo tiles — for clothing, shoes, perfume and other
// image-driven retail (businessTypeDefaults.ts: switch to "image" in Settings).
export function ImagePosTemplate({ onUseListTemplate }: { onUseListTemplate: () => void }) {
  return (
    <ComingSoonPosTemplate
      icon={Shirt}
      titleKey="pos.templates.image_title"
      descKey="pos.templates.image_desc"
      onUseListTemplate={onUseListTemplate}
    />
  );
}
