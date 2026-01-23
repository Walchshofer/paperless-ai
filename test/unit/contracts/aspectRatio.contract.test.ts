import { describe, it, expect } from 'vitest';
import { AspectRatioSchema } from '../../../src/ui/contracts/AspectRatio.contract';

describe('AspectRatio contract (ColQwen3)', () => {
  it('accepts standard document size (595x842)', () => {
    const valid = { width: 595, height: 842 };
    const result = AspectRatioSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts small image (224x224)', () => {
    const valid = { width: 224, height: 224 };
    const result = AspectRatioSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts 1280x720 image', () => {
    const valid = { width: 1280, height: 720 };
    const result = AspectRatioSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects extremely large image exceeding patch limit', () => {
    const invalid = { width: 3840, height: 2160 };
    const result = AspectRatioSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects zero dimensions', () => {
    const invalid = { width: 0, height: 100 };
    const result = AspectRatioSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative dimensions', () => {
    const invalid = { width: -100, height: 100 };
    const result = AspectRatioSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
