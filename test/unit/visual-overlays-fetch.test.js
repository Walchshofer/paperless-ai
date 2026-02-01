const assert = require('assert');
const { fetchOverlaysForImage } = require('../../src/islands/VisualOverlaysIsland.tsx');

describe('fetchOverlaysForImage', function() {
  it('uses provided fetch impl and returns overlays', async function() {
    const fakeImage = { id: 'img-1' };
    const fakeFetch = async (_url, _opts) => ({ ok: true, json: async () => ({ overlays: [{ id: 'ov-1', bbox: { x: 0, y: 0, width: 1, height: 1 } }] }) });
    const overlays = await fetchOverlaysForImage(fakeImage, fakeFetch);
    assert.ok(Array.isArray(overlays));
    assert.strictEqual(overlays[0].id, 'ov-1');
  });

  it('caches results and returns cached data next call', async function() {
    const fakeImage = { id: 'img-cache' };
    let calls = 0;
    const fakeFetch = async (_url, _opts) => { calls++; return { ok: true, json: async () => ({ overlays: [{ id: 'ov-cache' }] }) }; };
    const _first = await fetchOverlaysForImage(fakeImage, fakeFetch);
    const second = await fetchOverlaysForImage(fakeImage, fakeFetch);
    assert.strictEqual(calls, 1, 'fetch should be called only once due to cache');
    assert.strictEqual(second[0].id, 'ov-cache');
  });
});