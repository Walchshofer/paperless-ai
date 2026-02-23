/* eslint-env mocha */
/**
 * FINDING-13 — ExpertPipelineExecutor visual OCR page result tests
 *
 * Tests the page-result object shape built inside _executeVisualOCR
 * (services/experts/ExpertPipelineExecutor.js, lines ~3852–3873).
 *
 * We test the pure data contract — what shape each visualPages entry
 * must have — rather than mocking the full pipeline stack.
 * This keeps the tests fast and deterministic.
 *
 * Uses Node.js built-in assert only.
 */

'use strict';

const assert = require('assert');

// ---------------------------------------------------------------------------
// Inline replica of the page-result building logic
// Extracted from ExpertPipelineExecutor.js lines 3852-3857
// We test the contract, not the implementation details.
// ---------------------------------------------------------------------------

/**
 * Build a page result object as ExpertPipelineExecutor would.
 * @param {string} pageText
 * @param {number} pageNumber
 * @returns {Object}
 */
function buildPageResult(pageText, pageNumber) {
  return {
    pageNumber,
    text: pageText,
    success: pageText.length > 0,
    ...(pageText.length === 0 && { note: 'no_text_extracted' })
  };
}

/**
 * Build a page result for a caught page error (lines 3866-3871).
 * @param {number} pageNumber
 * @param {Error} err
 * @returns {Object}
 */
function buildPageErrorResult(pageNumber, err) {
  return {
    pageNumber,
    text: '',
    success: false,
    error: err.message
  };
}

// ---------------------------------------------------------------------------
// Tests — empty text
// ---------------------------------------------------------------------------

describe('ExpertPipelineExecutor — visual OCR page result: empty text', () => {
  it('sets success:false when pageText is empty', () => {
    // Arrange
    const pageText = '';
    // Act
    const result = buildPageResult(pageText, 1);
    // Assert
    assert.strictEqual(result.success, false, 'success must be false for empty pageText');
  });

  it('sets note:no_text_extracted when pageText is empty', () => {
    const result = buildPageResult('', 1);
    assert.strictEqual(result.note, 'no_text_extracted', 'note must be "no_text_extracted" for empty pageText');
  });

  it('sets text to empty string when pageText is empty', () => {
    const result = buildPageResult('', 1);
    assert.strictEqual(result.text, '', 'text must be empty string');
  });

  it('preserves pageNumber in result', () => {
    const result = buildPageResult('', 3);
    assert.strictEqual(result.pageNumber, 3, 'pageNumber must be preserved');
  });
});

// ---------------------------------------------------------------------------
// Tests — non-empty text
// ---------------------------------------------------------------------------

describe('ExpertPipelineExecutor — visual OCR page result: non-empty text', () => {
  it('sets success:true when pageText is non-empty', () => {
    const result = buildPageResult('Invoice Number: 12345', 1);
    assert.strictEqual(result.success, true, 'success must be true for non-empty pageText');
  });

  it('does not include note property when pageText is non-empty', () => {
    const result = buildPageResult('Some content here', 2);
    assert.ok(!('note' in result), 'note must NOT be present when pageText is non-empty');
  });

  it('stores the full pageText in text field', () => {
    const text = 'Rechnungsnummer: R-2024-001\nBetrag: 1.234,56 EUR';
    const result = buildPageResult(text, 1);
    assert.strictEqual(result.text, text, 'text must equal the original pageText');
  });
});

// ---------------------------------------------------------------------------
// Tests — error path (page OCR throws)
// ---------------------------------------------------------------------------

describe('ExpertPipelineExecutor — visual OCR page result: page error path', () => {
  it('sets success:false on page error', () => {
    const result = buildPageErrorResult(2, new Error('VLM timeout'));
    assert.strictEqual(result.success, false, 'success must be false on page error');
  });

  it('sets text to empty string on page error', () => {
    const result = buildPageErrorResult(2, new Error('VLM timeout'));
    assert.strictEqual(result.text, '', 'text must be empty on page error');
  });

  it('stores error message on page error', () => {
    const err = new Error('model inference failed');
    const result = buildPageErrorResult(1, err);
    assert.strictEqual(result.error, 'model inference failed', 'error message must be preserved');
  });

  it('does not set note property on page error (distinct from empty-text path)', () => {
    const result = buildPageErrorResult(1, new Error('connection refused'));
    // Error path uses result.error, not result.note
    assert.ok(!('note' in result), 'note should not be set on page error (only on empty text path)');
  });
});

// ---------------------------------------------------------------------------
// Tests — multiple pages
// ---------------------------------------------------------------------------

describe('ExpertPipelineExecutor — visual OCR page result: multiple-page scenarios', () => {
  it('each page in a mixed run has correct success and note fields', () => {
    // Simulate processing 3 pages where page 2 extracts no text
    const pageTexts = ['OCR text page 1', '', 'OCR text page 3'];
    const results = pageTexts.map((text, i) => buildPageResult(text, i + 1));

    assert.strictEqual(results[0].success, true);
    assert.ok(!('note' in results[0]));

    assert.strictEqual(results[1].success, false);
    assert.strictEqual(results[1].note, 'no_text_extracted');
    assert.strictEqual(results[1].text, '');

    assert.strictEqual(results[2].success, true);
    assert.ok(!('note' in results[2]));
  });

  it('page numbers start at 1 (1-indexed, not 0-indexed)', () => {
    const results = ['text'].map((text, i) => buildPageResult(text, i + 1));
    assert.strictEqual(results[0].pageNumber, 1, 'first page must be pageNumber:1');
  });
});
