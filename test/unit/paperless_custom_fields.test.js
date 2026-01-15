const assert = require('assert');
const paperlessService = require('../../services/paperlessService');

describe('PaperlessService.custom_fields normalization', function () {
  it('should normalize custom_fields to {field: id, value}', async function () {
    const docId = 7777;

    // Stub client.patch to capture payload
    const origClient = paperlessService.client;
    paperlessService.client = {
      patch: async (path, payload, opts) => {
        // return the payload in response shape similar to Paperless
        capturedPayload = payload;
        return { data: { id: docId } };
      },
      get: async () => ({ data: { id: docId, tags: [], correspondent: null } })
    };

    // Stub findExistingCustomField to return an object with id
    const origFind = paperlessService.findExistingCustomField;
    paperlessService.findExistingCustomField = async (name) => ({ id: 42, name });

    let capturedPayload = null;
    await paperlessService.updateDocument(docId, { custom_fields: [{ name: 'myField', value: 'X' }] }, { requestId: 't1' });

    assert.ok(capturedPayload, 'Expected payload to be sent to Paperless API');
    assert.ok(Array.isArray(capturedPayload.custom_fields), 'custom_fields must be an array');
    assert.strictEqual(capturedPayload.custom_fields.length, 1);
    assert.strictEqual(capturedPayload.custom_fields[0].field, 42);
    assert.strictEqual(capturedPayload.custom_fields[0].value, 'X');

    // cleanup
    paperlessService.client = origClient;
    paperlessService.findExistingCustomField = origFind;
  });
});
