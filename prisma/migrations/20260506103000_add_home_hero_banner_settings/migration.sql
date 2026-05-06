CREATE TABLE "HomeHeroBannerSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "desktopImage" TEXT NOT NULL,
  "mobileImage" TEXT NOT NULL,
  "linkHref" TEXT NOT NULL DEFAULT '/shop',
  "desktopAlt" TEXT NOT NULL DEFAULT 'Gerdan Hero',
  "mobileAlt" TEXT NOT NULL DEFAULT 'Gerdan Hero Mobile',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HomeHeroBannerSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "HomeHeroBannerSettings" (
  "id",
  "desktopImage",
  "mobileImage",
  "linkHref",
  "desktopAlt",
  "mobileAlt",
  "updatedAt"
)
VALUES (
  1,
  '/img/hero-block-01.jpg',
  '/img/hero-block-m.jpg',
  '/shop',
  'Gerdan Hero',
  'Gerdan Hero Mobile',
  CURRENT_TIMESTAMP
);
