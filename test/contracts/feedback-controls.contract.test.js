require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });
const assert = require('assert');
const { FeedbackControlsSchema } = require('../../src/ui/contracts/FeedbackControls.contract.ts');

describe('FeedbackControls Zod schema', function () {
  it('accepts valid props', function () {
    const valid = {
      documentId: 1,
      components: [ { component: 'tags', feedback_type: 'thumbs_up' } ]
    };
    const result = FeedbackControlsSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  it('accepts availableComponents array and documentId', function () {
    const valid = { availableComponents: ['tags','correspondent'], documentId: 2 };
    const result = FeedbackControlsSchema.safeParse(valid);
    assert.strictEqual(result.success, true);
  });

  it('rejects non-array availableComponents', function () {
    const invalid = { availableComponents: 'tags' };
    const result = FeedbackControlsSchema.safeParse(invalid);
    assert.strictEqual(result.success, false);
  });

  it('rejects invalid feedback_type', function () {
    const invalid = {
      documentId: 1,
      components: [ { component: 'tags', feedback_type: 'meh' } ]
    };
    const result = FeedbackControlsSchema.safeParse(invalid);
    assert.strictEqual(result.success, false);
  });
});