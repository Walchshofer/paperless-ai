/**
 * Aspect ratio validation contract for ColQwen3 visual models
 * Exports constants and a Zod schema that enforces the model's patch
 * size and total patch limit (used by visual search and UI validations).
 */
import { z } from 'zod';

/** Patch size (pixels) used when computing patches for ColQwen3 */
export const COLQWEN3_PATCH_SIZE = 32;

/** Maximum allowed patches for ColQwen3 */
export const COLQWEN3_MAX_PATCHES = 1280;

export const AspectRatioSchema = z
  .object({
    width: z.number().positive(),
    height: z.number().positive()
  })
  .refine(
    (val) => {
      const totalPatches =
        Math.ceil(val.width / COLQWEN3_PATCH_SIZE) * Math.ceil(val.height / COLQWEN3_PATCH_SIZE);
      return totalPatches <= COLQWEN3_MAX_PATCHES;
    },
    { message: `Image exceeds ${COLQWEN3_MAX_PATCHES} patch limit for ColQwen3` }
  );
