const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');

const VAT_KEYWORDS = [
  'ustg', // UStG
  'reverse charge',
  'igl',
  'steuerschuld'
];

function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s) {
  return normalizeText(s).split(' ').filter(Boolean);
}

class InternalVatRag {
  constructor() {
    if (InternalVatRag._instance) return InternalVatRag._instance;
    this.corpusPath = (config.vatRag && config.vatRag.corpusPath) || path.join(process.cwd(), 'data', 'austrian_vat');
    this.cache = []; // [{ filename, text, tokens, freqMap }]
    this._loaded = false;
    InternalVatRag._instance = this;
  }

  async _loadCorpus() {
    if (this._loaded) return;

    const triedPaths = [];

    const tryLoad = async (p) => {
      triedPaths.push(p);
      const files = await fs.readdir(p);
      const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
      const reads = mdFiles.map(async (fname) => {
        const fp = path.join(p, fname);
        const text = await fs.readFile(fp, 'utf8');
        const tokens = tokenize(text);
        const freqMap = tokens.reduce((m, t) => {
          m[t] = (m[t] || 0) + 1; return m;
        }, {});
        return { filename: fname, path: fp, text, tokens, freqMap };
      });
      this.cache = await Promise.all(reads);
      this._loaded = true;
      return true;
    };

    try {
      // Primary path (may be overridden in tests or config)
      await tryLoad(this.corpusPath);
      return;
    } catch (err) {
      // Attempt a couple of reasonable fallbacks before giving up
      try {
        if (config.vatRag && config.vatRag.corpusPath && config.vatRag.corpusPath !== this.corpusPath) {
          try {
            await tryLoad(config.vatRag.corpusPath);
            return;
          } catch (e) {
            // continue to next fallback
          }
        }

        if (process.env.TEST_VAT_RAG_CORPUS) {
          try {
            await tryLoad(process.env.TEST_VAT_RAG_CORPUS);
            return;
          } catch (e) {
            // continue
          }
        }

        // Last ditch: fallback to default data dir
        const defaultPath = path.join(process.cwd(), 'data', 'austrian_vat');
        if (defaultPath !== this.corpusPath) {
          try {
            await tryLoad(defaultPath);
            return;
          } catch (e) {
            // continue
          }
        }

        // If we reach here, nothing worked — preserve empty cache but record paths for debugging
        this.cache = [];
        this._loaded = true;
        console.warn(`InternalVatRag failed to load corpus. Tried paths: ${triedPaths.join(', ')}. Last error: ${err.message}`);
      } catch (finalErr) {
        // Ensure we don't crash the app due to corpus load issues
        this.cache = [];
        this._loaded = true;
        console.warn('InternalVatRag failed to load corpus (final):', finalErr.message);
      }
    }
  }

  isVatRelevant(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return VAT_KEYWORDS.some((kw) => lower.includes(kw));
  }

  // Retrieve top N (3) relevant sections/files as a single context string
  async retrieve(inputText, topN = 3) {
    await this._loadCorpus();
    if (!inputText || this.cache.length === 0) return '';

    const inputTokens = tokenize(inputText);
    const inputFreq = inputTokens.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {});
    const uniqueInput = new Set(inputTokens);

    const scores = this.cache.map((doc) => {
      // Keyword overlap score
      const keywordHits = VAT_KEYWORDS.reduce((acc, kw) => {
        const presentInInput = inputText.toLowerCase().includes(kw) ? 1 : 0;
        const presentInDoc = doc.text.toLowerCase().includes(kw) ? 1 : 0;
        return acc + (presentInInput && presentInDoc ? 1 : 0);
      }, 0);

      // Token overlap
      let shared = 0;
      for (const token of uniqueInput) {
        if (doc.freqMap[token]) shared += Math.min((inputFreq[token] || 0), doc.freqMap[token]);
      }

      // Normalize by doc length (+1 to avoid div by zero)
      const normShared = shared / (doc.tokens.length + 1);

      // Combined score (keywords weighted heavier)
      const score = keywordHits * 2 + normShared;
      return { doc, score, keywordHits, shared };
    });

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topN).filter(s => s.score > 0);

    if (top.length === 0) return '';

    const contexts = top.map(({ doc }) => {
      // Try to find a short excerpt around the first matching keyword or otherwise the start of doc
      const lower = doc.text.toLowerCase();
      let excerpt = '';
      let foundPos = -1;
      for (const kw of VAT_KEYWORDS) {
        foundPos = lower.indexOf(kw);
        if (foundPos >= 0) break;
      }

      if (foundPos >= 0) {
        const start = Math.max(0, foundPos - 200);
        excerpt = doc.text.substring(start, Math.min(doc.text.length, foundPos + 500));
      } else {
        excerpt = doc.text.substring(0, 700);
      }

      // Trim and normalize whitespace
      excerpt = excerpt.replace(/\s+/g, ' ').trim();
      return `--- ${doc.filename} ---\n${excerpt}\n`;
    });

    return contexts.join('\n');
  }
}

module.exports = new InternalVatRag();
