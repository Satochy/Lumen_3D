-- AlterEnum
ALTER TYPE "LogisticsStatus" ADD VALUE 'READY_FOR_SHIPPING';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "isMadeToOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionDays" INTEGER,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "isAssistedSale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isMadeToOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productionDays" INTEGER;
