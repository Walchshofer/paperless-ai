const assert = require('assert');
const {
  isProtectedRuntimeKey,
  findProtectedRuntimeKeys
} = require('../../config/envPolicy');

describe('envPolicy', function() {
  it('flags protected infrastructure keys', function() {
    assert.strictEqual(isProtectedRuntimeKey('PAPERLESS_API_URL'), true);
    assert.strictEqual(isProtectedRuntimeKey('POSTGRES_HOST'), true);
    assert.strictEqual(isProtectedRuntimeKey('QDRANT_PORT'), true);
  });

  it('does not flag runtime-safe keys', function() {
    assert.strictEqual(isProtectedRuntimeKey('TOKEN_LIMIT'), false);
    assert.strictEqual(isProtectedRuntimeKey('ENABLE_VISUAL_RAG'), false);
    assert.strictEqual(isProtectedRuntimeKey('AI_PROVIDER'), false);
  });

  it('filters protected keys from an input list', function() {
    const keys = [
      'TOKEN_LIMIT',
      'PAPERLESS_API_TOKEN',
      'QDRANT_HOST',
      'ENABLE_VISUAL_RAG'
    ];
    const protectedKeys = findProtectedRuntimeKeys(keys);
    assert.deepStrictEqual(protectedKeys, [
      'PAPERLESS_API_TOKEN',
      'QDRANT_HOST'
    ]);
  });
});
