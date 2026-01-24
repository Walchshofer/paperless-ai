import assert from 'assert';
import cfg from '../../config/config.mjs';

// Sanity check that ESM import of config works and provides expected fields
assert.ok(cfg.PAPERLESS_AI_VERSION, 'config should expose PAPERLESS_AI_VERSION');
assert.strictEqual(typeof cfg.PAPERLESS_AI_VERSION, 'string');
console.log('[test] config ESM import successful:', cfg.PAPERLESS_AI_VERSION);
