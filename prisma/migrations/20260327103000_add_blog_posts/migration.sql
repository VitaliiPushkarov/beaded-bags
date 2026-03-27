CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "coverImage" TEXT NOT NULL,
  "coverImageAlt" TEXT NOT NULL,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "publishedAt" TIMESTAMP(3),
  "readingMinutes" INTEGER NOT NULL DEFAULT 4,
  "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
  "sections" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
