const assert = require('assert');
const {
    _denormalizeCoordinates,
    _parseGeometryAnalysis,
    _buildNormalizationActions,
    _fallbackVisionAnalysis
} = require('../../services/experts/normalization/tools');

describe('Normalization helpers', function() {
    describe('_denormalizeCoordinates', function() {
        it('converts normalized box to pixels correctly', function() {
            const box = [0, 0, 1000, 1000];
            const res = _denormalizeCoordinates(box, 2400, 3000);
            assert.strictEqual(res.x, 0);
            assert.strictEqual(res.y, 0);
            assert.strictEqual(res.width, 2400);
            assert.strictEqual(res.height, 3000);
            assert.strictEqual(res.unit, 'pixel');
        });

        it('clamps values outside 0-1000', function() {
            const box = [-100, -50, 1500, 2000];
            const res = _denormalizeCoordinates(box, 1000, 2000);
            assert.strictEqual(res.x, 0);
            assert.strictEqual(res.y, 0);
            assert.strictEqual(res.width, 1000);
            assert.strictEqual(res.height, 2000);
        });

        it('returns null for invalid input', function() {
            assert.strictEqual(_denormalizeCoordinates(null, 100, 100), null);
            assert.strictEqual(_denormalizeCoordinates([1,2,3], 100, 100), null);
        });
    });

    describe('_parseGeometryAnalysis', function() {
        it('parses a JSON string wrapped in code fences', function() {
            const input = "```json\n{\"rotate\":90,\"needs_crop\":false,\"confidence\":0.9}\n```";
            const parsed = _parseGeometryAnalysis(input);
            assert.strictEqual(parsed.rotate, 90);
            assert.strictEqual(parsed.needs_crop, false);
            assert.strictEqual(parsed.confidence, 0.9);
        });

        it('returns default values for missing fields', function() {
            const input = '{"rotate":0}';
            const parsed = _parseGeometryAnalysis(input);
            assert.strictEqual(parsed.rotate, 0);
            assert.strictEqual(parsed.needs_crop, false);
            assert.strictEqual(typeof parsed.confidence, 'number');
        });

        it('returns null for invalid JSON', function() {
            const parsed = _parseGeometryAnalysis('not a json');
            assert.strictEqual(parsed, null);
        });
    });

    describe('_buildNormalizationActions', function() {
        it('builds rotate/crop/dpi actions appropriately', function() {
            const analysis = {
                rotate: 90,
                needs_crop: true,
                crop_box: [100, 100, 900, 900],
                target_dpi: 300
            };
            const pageInfo = { width: 1000, height: 2000 };
            const actions = _buildNormalizationActions(analysis, pageInfo);
            const types = actions.map(a => a.type).sort();
            assert.deepStrictEqual(types, ['crop', 'dpi', 'rotate']);

            const crop = actions.find(a => a.type === 'crop');
            assert(crop.box.width > 0);
            const rotate = actions.find(a => a.type === 'rotate');
            assert.strictEqual(rotate.degrees, 90);
            const dpi = actions.find(a => a.type === 'dpi');
            assert.strictEqual(dpi.target, 300);
        });
    });

    describe('_fallbackVisionAnalysis', function() {
        it('returns null when ollama is unavailable or fails', async function() {
            // Intentionally call with empty image and prompt; environment in CI may not have ollama
            const res = await _fallbackVisionAnalysis(null, '{}');
            assert.strictEqual(res, null);
        }).timeout(5000);
    });
});
