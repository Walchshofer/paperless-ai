// Zod schema tests for VisualAnnotation
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });
const assert = require('assert');
const { VisualAnnotationSchema } = require('../../src/ui/contracts/VisualAnnotation.contract.ts');

describe('VisualAnnotation Zod schema', function () {
  it('accepts valid props', function () {
    const valid = {
      documentId: 123,
      page: 1,
      initialAnnotations: [
        { bbox: [10, 10, 100, 50], comment: 'Note', page: 1 },
      ],
    };
    const result = VisualAnnotationSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  it('rejects invalid bbox shapes', function () {
    const invalid = {
      documentId: 123,
      initialAnnotations: [
        { bbox: [10, 20], comment: 'Bad' },
      ],
    };
    const result = VisualAnnotationSchema.safeParse(invalid);
    assert.strictEqual(result.success, false);
  });

  it('allows nullable documentId', function () {
    const sample = { documentId: null };
    const result = VisualAnnotationSchema.safeParse(sample);
    assert.strictEqual(result.success, true);
  });
});