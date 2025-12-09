-- CreateTable
CREATE TABLE "ProductAddon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "imageUrl" TEXT,
    "priceUAH" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAddonOnProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,

    CONSTRAINT "ProductAddonOnProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAddon_slug_key" ON "ProductAddon"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAddonOnProduct_productId_addonId_key" ON "ProductAddonOnProduct"("productId", "addonId");

-- AddForeignKey
ALTER TABLE "ProductAddonOnProduct" ADD CONSTRAINT "ProductAddonOnProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddonOnProduct" ADD CONSTRAINT "ProductAddonOnProduct_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ProductAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
