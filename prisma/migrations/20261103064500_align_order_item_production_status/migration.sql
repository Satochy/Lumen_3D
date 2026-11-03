-- CreateEnum
CREATE TYPE "OrderItemProductionStatus" AS ENUM ('QUEUED', 'PRINTING', 'POST_PROCESSING', 'READY');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "productionStatus" "OrderItemProductionStatus" NOT NULL DEFAULT 'QUEUED';

-- Sincronizar dados existentes de productionStage e isReady para productionStatus antes de dropar
UPDATE "order_items"
SET "productionStatus" = CASE
  WHEN "productionStage"::text = 'COMPLETED' OR "isReady" = true THEN 'READY'::"OrderItemProductionStatus"
  WHEN "productionStage"::text = 'POST_PROCESSING' THEN 'POST_PROCESSING'::"OrderItemProductionStatus"
  WHEN "productionStage"::text = 'PRINTING' THEN 'PRINTING'::"OrderItemProductionStatus"
  ELSE 'QUEUED'::"OrderItemProductionStatus"
END;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "isReady",
DROP COLUMN "productionStage";

-- DropEnum
DROP TYPE "ProductionStage";
