const assert = require('assert');
const { TitleOptimizer } = require('../../services/experts/normalization/TitleOptimizer');

describe('TitleOptimizer', function() {
    let optimizer;

    beforeEach(function() {
        optimizer = new TitleOptimizer();
    });

    it('should remove redundant name prefixes', function() {
        const input = 'Patrick Walchshofer Invoice 123';
        const expected = 'Invoice 123';
        assert.strictEqual(optimizer.optimize(input), expected);
    });

    it('should remove formal name prefixes', function() {
        const input = 'Herr Walchshofer Patrick Medical Report';
        const expected = 'Medical Report';
        assert.strictEqual(optimizer.optimize(input), expected);
    });

    it('should apply replacements', function() {
        const input = 'Rechnung-Nr. 2023-001';
        const expected = 'Rechnung 2023-001';
        assert.strictEqual(optimizer.optimize(input), expected);
    });

    it('should shorten long phrases', function() {
        const input = 'Bestätigung über die Kostenerstattung für Q3';
        const expected = 'Kostenerstattung für Q3';
        assert.strictEqual(optimizer.optimize(input), expected);
    });

    it('should truncate excessively long titles', function() {
        const input = 'A very long title that definitely exceeds the eighty character limit and should be truncated properly by the optimizer';
        const result = optimizer.optimize(input);
        assert.ok(result.length <= 80);
        assert.ok(result.endsWith('...'));
    });

    it('should handle "vom DD.MM.YYYY" suffix', function() {
        const input = 'Contract vom 12.12.2025';
        const expected = 'Contract';
        assert.strictEqual(optimizer.optimize(input), expected);
    });

    it('should handle "- Kopie" suffix', function() {
        const input = 'Document - Kopie';
        const expected = 'Document';
        assert.strictEqual(optimizer.optimize(input), expected);
    });
    
    it('should return non-string inputs as is', function() {
        assert.strictEqual(optimizer.optimize(null), null);
        assert.strictEqual(optimizer.optimize(123), 123);
    });
});
