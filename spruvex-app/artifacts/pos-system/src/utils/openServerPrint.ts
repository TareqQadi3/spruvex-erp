import { TOKEN_KEY } from "@/contexts/AuthContext";

/**
 * Opens a server-rendered print document (invoicing module's /api/invoicing/print/*
 * endpoints) in a new window and lets its embedded script trigger window.print().
 * Generic on purpose — any future SpruVex product that exposes the same kind of
 * "GET returns ready-to-print HTML, requires a bearer token" endpoint can reuse
 * this exact helper unchanged.
 */
export async function openServerPrint(path: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const win = window.open("", "_blank", "width=750,height=800,scrollbars=yes");
  if (!win) {
    alert("Please allow popups to print documents. Check your browser settings.");
    return;
  }
  try {
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Print failed" }));
      win.close();
      alert(body.error ?? "Print failed");
      return;
    }
    const html = await res.text();
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    win.close();
    alert("Print failed — check your connection and try again.");
  }
}
