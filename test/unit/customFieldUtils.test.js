const assert = require('assert');
const { normalizeCustomFieldValue, MAX_LENGTH } = require('../../services/customFieldUtils');

describe('customFieldUtils.normalizeCustomFieldValue', function () {
  it('handles null/undefined', function () {
    assert.strictEqual(normalizeCustomFieldValue(null), '');
    assert.strictEqual(normalizeCustomFieldValue(undefined), '');
  });

  it('stringifies objects and truncates', function () {
    const obj = { a: 'x'.repeat(MAX_LENGTH + 10) };
    const s = normalizeCustomFieldValue(obj);
    assert.strictEqual(typeof s, 'string');
    assert.ok(s.length <= MAX_LENGTH);
  });

  it('coerces numbers to strings', function () {
    assert.strictEqual(normalizeCustomFieldValue(123), '123');
    assert.strictEqual(normalizeCustomFieldValue(0), '0');
  });
});