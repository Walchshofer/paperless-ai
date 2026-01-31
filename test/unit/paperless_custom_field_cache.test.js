const assert = require('assert');
const paperlessService = require('../../services/paperlessService');

describe('PaperlessService.customFieldCache', function () {
  it('refreshCustomFieldCache maps names to field objects', async function () {
    const origClient = paperlessService.client;
    paperlessService.client = {
      get: async (_url) => ({ data: { results: [ { id: 1, name: 'invoice_number' }, { id: 2, name: 'invoice_amount' } ], next: null } })
    };

    await paperlessService.refreshCustomFieldCache();
    assert.strictEqual(paperlessService.customFieldCache.get('invoice_number').id, 1);
    assert.strictEqual(paperlessService.customFieldCache.get('invoice_amount').id, 2);

    paperlessService.client = origClient;
  });
});