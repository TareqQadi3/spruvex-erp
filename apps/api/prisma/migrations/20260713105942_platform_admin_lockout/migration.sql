-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recipe_items" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_levels" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_locations" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subscription_invoices" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "tenant_id" DROP DEFAULT;
