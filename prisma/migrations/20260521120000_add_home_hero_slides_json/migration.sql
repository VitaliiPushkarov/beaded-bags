ALTER TABLE "HomeHeroBannerSettings"
ADD COLUMN "slides" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "HomeHeroBannerSettings"
SET "slides" = jsonb_build_array(
  jsonb_build_object(
    'id', 'home-hero-slide-1',
    'desktopImage', "desktopImage",
    'mobileImage', "mobileImage",
    'linkHref', "linkHref",
    'desktopAlt', "desktopAlt",
    'mobileAlt', "mobileAlt",
    'sort', 1,
    'isActive', true
  )
)
WHERE jsonb_typeof("slides") <> 'array'
   OR jsonb_array_length("slides") = 0;
