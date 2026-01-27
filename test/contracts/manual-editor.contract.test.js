const tsNodeService = require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
const assert = require('assert');
const { ManualEditorSchema } = require(
  '../../src/ui/contracts/ManualEditor.contract.ts'
);

describe('ManualEditor Zod schema', function () {
  it('accepts minimal props', function () {
    const valid = { documentId: null };
    const result = ManualEditorSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  it('accepts metadata and fields', function () {
    const valid = { documentId: 2, metadata: { title: 'Doc' }, fields: [{ name: 'invoice', value: '123' }] };
    const result = ManualEditorSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });
});