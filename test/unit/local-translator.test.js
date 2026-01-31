
const assert = require('assert');
const LocalTranslator = require('../../services/experts/translation/LocalTranslator');

class ShouldNotBeCalledOllama {
  async chat() {
    throw new Error('Ollama should not be called');
  }
}

describe('LocalTranslator - skip behavior', function() {
  it('skips translation when text is shorter than minChars and logs debug', async function() {
    process.env.LOG_LEVEL = 'debug';
    const debugCalls = [];
    const origDebug = console.debug;
    console.debug = (...args) => { debugCalls.push(args); };

    const translator = new LocalTranslator({ ollamaService: new ShouldNotBeCalledOllama(), config: { minChars: 5 } });
    const input = 'abc'; // length 3 < minChars

    const out = await translator.translate(input, 'en', 'de');
    assert.strictEqual(out, input);

    console.debug = origDebug;

    const found = debugCalls.some(call => JSON.stringify(call).includes('Skipping translation due to minChars'));
    assert.ok(found, 'Expected debug log about skipping due to minChars');
  });
});
