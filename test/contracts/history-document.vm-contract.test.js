const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  HistoryDocumentVmSchema,
} = require('../../src/ui/contracts/HistoryDocument.contract.js');

describe('history-document view model contract + test IDs', function () {
  it('uses vm.* fields only for template data and has stable test IDs',
    function () {
      const filePath = path.join(
        __dirname,
        '..',
        '..',
        'views',
        'history-document.ejs'
      );
      const source = fs.readFileSync(filePath, 'utf8');

      // Guardrail: forbid known ad-hoc locals in EJS interpolation.
      const forbiddenInterpolations = [
        '<%= title %>',
        '<%= documentId %>',
        '<%= paperlessUrl %>',
        '<%= correspondent %>',
        '<%= createdAt %>',
        '<%= tags %>',
        '<%= content %>',
        '<%= metadata %>',
      ];

      forbiddenInterpolations.forEach((token) => {
        assert.ok(
          !source.includes(token),
          `forbidden interpolation still present: ${token}`
        );
      });

      // Interactive controls must be addressable.
      const requiredTestIds = [
        'data-testid="history-feedback-button"',
        'data-testid="history-back-link"',
        'data-testid="history-open-paperless-link"',
        'data-testid="history-open-paperless-disabled"',
      ];

      requiredTestIds.forEach((token) => {
        assert.ok(source.includes(token), `missing required test id: ${token}`);
      });
    });

  it('parses a representative history-document vm via Zod', function () {
    const parsed = HistoryDocumentVmSchema.parse({
      documentId: '42',
      title: 'Sample Document',
      content: 'Sample content',
      tags: ['alpha', 'beta'],
      tagObjects: [
        { id: '1', name: 'alpha' },
        { id: 2, name: 'beta' },
      ],
      metadata: {
        correspondent: 'ACME Corp',
        correspondentId: '7',
        tags: [{ id: 1, name: 'alpha' }],
        documentType: 'invoice',
        created: '2026-01-01',
        modified: null,
      },
      correspondent: 'ACME Corp',
      correspondentId: '7',
      documentType: 'invoice',
      createdAt: '',
      modifiedAt: null,
      paperlessUrl: null,
      original_url: null,
      page_count: '1',
      images: [],
      overlaysByImage: {},
    });

    assert.strictEqual(parsed.documentId, 42);
    assert.strictEqual(parsed.page_count, 1);
    assert.strictEqual(parsed.correspondentId, 7);
  });
});
