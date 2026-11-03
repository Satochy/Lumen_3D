-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('QUEUED', 'PRINTING', 'POST_PROCESSING', 'COMPLETED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "productionStage" "ProductionStage" NOT NULL DEFAULT 'QUEUED';

-- Sincronizar itens já marcados como prontos anteriormente
UPDATE "order_items" SET "productionStage" = 'COMPLETED' WHERE "isReady" = true;
