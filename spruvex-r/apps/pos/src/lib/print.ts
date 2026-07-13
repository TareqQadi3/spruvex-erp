/**
 * Print foundation: opens a print window with 80mm-styled RTL content.
 * Real thermal printer integration (ESC/POS) arrives in a later phase —
 * this renders the same receipt/ticket data through the browser dialog.
 */
export function printHtml(title: string, bodyHtml: string, dir: "rtl" | "ltr" = "rtl"): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(`<!doctype html>
<html dir="${dir}" lang="${dir === "rtl" ? "ar" : "en"}">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic", system-ui, sans-serif; width: 80mm; padding: 4mm; font-size: 12px; color: #000; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 2mm; }
  .center { text-align: center; }
  .muted { color: #444; font-size: 10px; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  .line { border-top: 1px dashed #000; margin: 2mm 0; }
  .big { font-size: 14px; font-weight: 700; }
  .item { margin-bottom: 1.5mm; }
  .mods { padding-inline-start: 6mm; font-size: 10px; color: #333; }
  @media print { body { width: auto; } }
</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
