const assert = require('assert');
const { getVisibleImageIds } = require('../../src/islands/VisualOverlaysIsland.tsx');

describe('getVisibleImageIds', function() {
  it('returns ids for intersecting entries', function() {
    const fakeEl1 = { dataset: { imageId: 'img-1' } };
    const fakeEl2 = { dataset: { imageId: 'img-2' } };
    const entries = [ { target: fakeEl1, isIntersecting: true, intersectionRatio: 0.2 }, { target: fakeEl2, isIntersecting: false, intersectionRatio: 0 } ];
    const ids = getVisibleImageIds(entries);
    assert.deepStrictEqual(ids, ['img-1']);
  });
});