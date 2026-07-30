import type { ReactNode } from "react";

/**
 * The one page frame every POS template renders into: a product area on the
 * start side and the (shared) CartPanel on the end side. Every template
 * (List/Grid/Image/Mobile) supplies its own productArea; nothing else about
 * the frame changes.
 */
export function PosLayoutShell({ productArea, cartPanel }: { productArea: ReactNode; cartPanel: ReactNode }) {
  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      <div className="flex-1 flex flex-col gap-4 min-w-0">{productArea}</div>
      {cartPanel}
    </div>
  );
}
