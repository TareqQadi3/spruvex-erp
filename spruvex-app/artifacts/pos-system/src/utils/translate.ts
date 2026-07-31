// Free Google Translate web endpoint (no API key needed, fine for short
// product names/descriptions). Fails safe: callers catch and show a toast,
// the field simply stays as the merchant typed it.
export async function translateText(text: string, targetLang: "ar" | "en"): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate_failed");
  const data = await res.json();
  const out = (Array.isArray(data?.[0]) ? data[0] : [])
    .map((seg: unknown) => (Array.isArray(seg) ? seg[0] ?? "" : ""))
    .join("");
  return out.trim();
}

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
