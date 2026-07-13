import Image from "next/image";

/**
 * There is no restaurant directory in the MVP — visitors always arrive via
 * a table QR code (/menu/{slug}/table/{token}) or a shared pickup link
 * (/restaurant/{slug}). This root page just confirms the app is alive.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/logo-horizontal.png" alt="SpruVex R" width={220} height={64} priority />
      <p className="text-muted-foreground">امسح رمز QR على طاولتك لبدء الطلب</p>
      <p className="text-sm text-muted-foreground">Scan the QR code on your table to order</p>
    </div>
  );
}
