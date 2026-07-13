export default function OrderNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-5xl">🧾</p>
      <h1 className="text-lg font-bold">الطلب غير موجود</h1>
      <p className="text-sm text-muted-foreground">Order not found.</p>
    </div>
  );
}
