import { z } from 'zod'

// Field schemas shared by the two admin product endpoints (POST /api/admin/products
// and PATCH /api/admin/products/[id]). Both receive the same form payload, so the
// pair has to agree on what an empty input means.
//
// The admin form keeps every text input as a string and submits '' for "not
// filled in". Left alone that empty string reaches the database as a value:
// harmless for a note, fatal for `sku`, which is unique — the second variant
// saved without a SKU collides with the first and Prisma answers P2002. Blank
// therefore has to become NULL before it ever reaches Prisma.

const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

// Accepts absolute URLs and local paths like "/img/foo.jpg".
export const ImagePath = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) =>
      s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://'),
    'Invalid image path',
  )

// An image field the admin may leave empty — a variant added without a photo,
// a pouch with no swatch yet. Missing and blank both mean NULL; anything else
// still has to look like a path.
export const OptionalImagePath = z.preprocess(
  blankToNull,
  ImagePath.nullable().default(null),
)

// Free text that is stored as NULL when blank. Used for `sku`, where '' would
// break the unique index, and safe for any other optional single-line field.
export const OptionalText = z.preprocess(
  blankToNull,
  z.string().trim().min(1).nullable().default(null),
)
