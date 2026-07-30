import { useGetSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import ListPosTemplate from "./pos-templates/ListPosTemplate";
import { GridPosTemplate } from "./pos-templates/GridPosTemplate";
import { ImagePosTemplate } from "./pos-templates/ImagePosTemplate";
import { MobilePosTemplate } from "./pos-templates/MobilePosTemplate";

/**
 * Dynamic POS engine: renders the screen layout that matches the tenant's
 * business type instead of one generic screen for everyone (settings.posTemplate,
 * defaulted per business type at signup — see businessTypeDefaults.ts).
 * Adding a future template is: add the value there, add a component here,
 * nothing else in the app needs to change.
 */
export default function PosPage() {
  const { data: settings } = useGetSettings();
  const queryClient = useQueryClient();

  const switchToListTemplate = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ posTemplate: "list" }),
    });
    queryClient.invalidateQueries();
  };

  switch (settings?.posTemplate) {
    case "grid":
      return <GridPosTemplate onUseListTemplate={switchToListTemplate} />;
    case "image":
      return <ImagePosTemplate onUseListTemplate={switchToListTemplate} />;
    case "mobile":
      return <MobilePosTemplate onUseListTemplate={switchToListTemplate} />;
    case "list":
    default:
      return <ListPosTemplate />;
  }
}
