CREATE TYPE "ShippingMethod" AS ENUM ('NOVA_POSHTA', 'INTERNATIONAL_ADDRESS');

ALTER TABLE "Order"
ADD COLUMN     "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'NOVA_POSHTA',
ADD COLUMN     "shippingCountryCode" TEXT,
ADD COLUMN     "shippingCountryName" TEXT,
ADD COLUMN     "shippingRegion" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingPostalCode" TEXT,
ADD COLUMN     "shippingAddressLine1" TEXT,
ADD COLUMN     "shippingAddressLine2" TEXT;

ALTER TABLE "Order"
ALTER COLUMN "npCityRef" DROP NOT NULL,
ALTER COLUMN "npCityName" DROP NOT NULL,
ALTER COLUMN "npWarehouseRef" DROP NOT NULL,
ALTER COLUMN "npWarehouseName" DROP NOT NULL;
