// Zod schema tests for VisualAnnotation
const _tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
const assert = require('assert');
const { VisualAnnotationSchema } = require(
  '../../src/ui/contracts/VisualAnnotation.contract.ts'
);

describe('VisualAnnotation Zod schema (Prompt 003)', function () {
  it('accepts valid normalized annotations', function () {
    const valid = {
      documentId: 'doc-123',
      page: 0,
      annotations: [
        {
          label: 'signature',
          confidence: 0.92,
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.15,
        },
      ],
    };
    const result = VisualAnnotationSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  it('rejects annotations missing label', function () {
    const invalid = {
      documentId: 'doc-2',
      annotations: [
        { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      ],
    };
    const result = VisualAnnotationSchema.safeParse(invalid);
    assert.strictEqual(result.success, false);
  });

  it('rejects coords out of range', function () {
    const invalid = {
      documentId: 'doc-3',
      annotations: [
        { label: 'a', x: -0.1, y: 0, width: 1.2, height: 0.1 },
      ],
    };
    const result = VisualAnnotationSchema.safeParse(invalid);
    assert.strictEqual(result.success, false);
  });

  it('accepts annotations with payload mirroring context (correspondent/tagIds/bbox)', function () {
    const sample = {
      documentId: 'doc-42',
      annotations: [
        {
          label: 'handwritten_note',
          bbox: [100, 150, 200, 80],
          context: { correspondentId: 42, tagIds: [1,2,3], metadata: { source: 'ui' } }
        }
      ]
    };
    const result = VisualAnnotationSchema.safeParse(sample);
    assert.strictEqual(result.success, true);
  });

  it('rejects invalid tag ids (non-numeric values)', function () {
    const sample = {
      documentId: 'doc-43',
      annotations: [
        { label: 'seal', bbox: [1,2,3,4], context: { tagIds: ["a", 2] } }
      ]
    };
    const result = VisualAnnotationSchema.safeParse(sample);
    assert.strictEqual(result.success, false);
  });
});