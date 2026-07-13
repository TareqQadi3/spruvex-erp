-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "invoice_hash" TEXT,
ADD COLUMN     "previous_invoice_hash" TEXT,
ADD COLUMN     "qr_payload" TEXT,
ADD COLUMN     "zatca_response" JSONB,
ADD COLUMN     "zatca_status" TEXT NOT NULL DEFAULT 'not_submitted',
ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shifts" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "legal_name" TEXT;
