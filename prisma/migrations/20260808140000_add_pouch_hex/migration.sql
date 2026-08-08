-- Swatch colour for a pouch, matching the one ProductVariantPouchStrap already
-- has. Nullable with no default: existing pouches keep rendering the colour
-- guessed from their name until someone picks one in admin.
ALTER TABLE "ProductVariantPouch" ADD COLUMN "hex" TEXT;
