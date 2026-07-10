import QRCode from "qrcode";

// The ZATCA QR content (qr_codes.qrContent) is already a base64-encoded TLV
// payload — that exact base64 string IS the scannable content per ZATCA's
// spec. Do not decode/re-encode it; just feed it straight into the QR-image
// generator.
export async function qrContentToDataUrl(qrContent: string, sizePx: number): Promise<string> {
  return QRCode.toDataURL(qrContent, { width: sizePx, margin: 1 });
}
