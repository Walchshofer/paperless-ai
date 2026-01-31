/* eslint-env mocha */
const assert = require('assert');

const JsonRepairService = require('../../services/rag/JsonRepairService');

describe('JsonRepairService integration', function () {
  it('extractWithRepair should parse a direct JSON string', async () => {
    const svc = new JsonRepairService(null);
    const res = await svc.extractWithRepair('Here is the payload: {"valid":"json"}');
    assert.deepStrictEqual(res, { valid: 'json' });
  });

  it('extractWithRepair should extract JSON from contaminated strings with <think> tags', async () => {
    const svc = new JsonRepairService(null);
    const contaminated = '<think>some thought</think> { "valid": "json" }';
    const res = await svc.extractWithRepair(contaminated);
    assert.deepStrictEqual(res, { valid: 'json' });
  });

  it('sanitizeForRepair should remove <reasoning> and <thinking> tags and their contents', () => {
    const svc = new JsonRepairService(null);
    const input = 'prefix <reasoning>internal debug</reasoning> middle <thinking>more</thinking> {"a":1} suffix';
    const cleaned = svc.sanitizeForRepair(input);
    assert.ok(!/<(reasoning|thinking|think)/i.test(cleaned));
    assert.ok(cleaned.includes('{"a":1}'));
  });

  it('extractWithRepair should fall back to repair() when parsing fails and use the ollama chat output (mocked)', async () => {
    // Mock ollamaService.chat to return a JSON string (possibly wrapped in fences)
    const mockOllama = {
      chat: async () => '```json\n{ "repaired": true }\n```'
    };
    const svc = new JsonRepairService(mockOllama);

    const broken = 'This is malformed JSON: { not: valid, }';
    const res = await svc.extractWithRepair(broken);
    assert.deepStrictEqual(res, { repaired: true });
  });

  it('sanitizeForRepair should replace very large numeric arrays with a placeholder', () => {
    const svc = new JsonRepairService(null);
    const largeArray = `[${Array.from({ length: 60 }).map((_, i) => i).join(',')}]`;
    const cleaned = svc.sanitizeForRepair(`prefix ${largeArray} suffix`);
    assert.ok(cleaned.includes('[OMITTED_NUMERIC_ARRAY]') || cleaned.includes('[OMITTED_ARRAY]'));
  });
});
