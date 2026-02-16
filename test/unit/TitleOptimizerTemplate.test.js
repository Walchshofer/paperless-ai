const assert = require('assert');
const { TitleOptimizer } = require('../../services/experts/normalization/TitleOptimizer');

describe('TitleOptimizer Template Logic', function() {
    let optimizer;

    beforeEach(function() {
        optimizer = new TitleOptimizer();
    });

    it('should format title with year, correspondent and subject', function() {
        const title = 'Invoice 123';
        const context = {
            created: '2025-12-20',
            correspondent: 'MyBank'
        };
        // Template: {{ created_year }} - {{ correspondent }} - {{ title }}
        const expected = '2025 - MyBank - Invoice 123';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });

    it('should handle missing correspondent', function() {
        const title = 'Invoice 123';
        const context = {
            created: '2025-12-20'
        };
        // "2025 -  - Invoice 123" -> cleaned to "2025 - Invoice 123"
        const expected = '2025 - Invoice 123';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });

    it('should handle missing date', function() {
        const title = 'Invoice 123';
        const context = {
            correspondent: 'MyBank'
        };
        // " - MyBank - Invoice 123" -> cleaned to "MyBank - Invoice 123"
        const expected = 'MyBank - Invoice 123';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });

    it('should suppress SCN_ title if other metadata exists', function() {
        const title = 'SCN_20251220_123335';
        const context = {
            created: '2025-12-20',
            correspondent: 'MyBank'
        };
        // "2025 - MyBank - " -> "2025 - MyBank"
        const expected = '2025 - MyBank';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });

    it('should keep SCN_ title if NO other metadata exists', function() {
        const title = 'SCN_20251220_123335';
        const context = {};
        const expected = 'SCN_20251220_123335';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });

    it('should handle full set with regex cleaning on subject', function() {
        // "Rechnung-Nr. 123" should be cleaned to "Rechnung 123" via default rules
        const title = 'Rechnung-Nr. 123';
        const context = {
            created: '2023-01-01',
            correspondent: 'Vendor'
        };
        const expected = '2023 - Vendor - Rechnung 123';
        assert.strictEqual(optimizer.optimize(title, context), expected);
    });
});
