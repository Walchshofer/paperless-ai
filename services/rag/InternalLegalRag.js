const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');

const LEGAL_KEYWORDS = [
  'contract',
  'agreement',
  'liability',
  'indemnification',
  'termination',
  'jurisdiction',
  'force majeure'
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

class InternalLegalRag {
  constructor() {
    if (InternalLegalRag._instance) return InternalLegalRag._instance;
    this.corpusPath = (config.legalRag && config.legalRag.corpusPath) || path.join(process.cwd(), 'data', 'legal_corpus');
    this.cache = [];
    this._loaded = false;
    InternalLegalRag._instance = this;
  }

  async _loadCorpus() {
    if (this._loaded) return;
    try {
      const files = await fs.readdir(this.corpusPath);
      const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
      const reads = mdFiles.map(async (fname) => {
        const fp = path.join(this.corpusPath, fname);
        const text = await fs.readFile(fp, 'utf8');
        const tokens = tokenize(text);
        const freqMap = tokens.reduce((m, t) => {
          m[t] = (m[t] || 0) + 1; return m;
        }, {});
        return { filename: fname, path: fp, text, tokens, freqMap };
      });
      this.cache = await Promise.all(reads);
      this._loaded = true;
    } catch (err) {
      this.cache = [];
      this._loaded = true;
      console.warn('InternalLegalRag failed to load corpus:', err.message);
    }
  }

  isLegalRelevant(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return LEGAL_KEYWORDS.some((kw) => lower.includes(kw));
  }

  async retrieve(inputText, topN = 3) {
    await this._loadCorpus();
    if (!inputText || this.cache.length === 0) return '';

    const inputTokens = tokenize(inputText);
    const inputFreq = inputTokens.reduce((m, t) => { m[t] = (m[t] || 0) + 1; return m; }, {});
    const uniqueInput = new Set(inputTokens);

    const scores = this.cache.map((doc) => {
      const keywordHits = LEGAL_KEYWORDS.reduce((acc, kw) => {
        const presentInInput = inputText.toLowerCase().includes(kw) ? 1 : 0;
        const presentInDoc = doc.text.toLowerCase().includes(kw) ? 1 : 0;
        return acc + (presentInInput && presentInDoc ? 1 : 0);
      }, 0);

      let shared = 0;
      for (const token of uniqueInput) {
        if (doc.freqMap[token]) shared += Math.min((inputFreq[token] || 0), doc.freqMap[token]);
      }

      const normShared = shared / (doc.tokens.length + 1);
      const score = keywordHits * 2 + normShared;
      return { doc, score, keywordHits, shared };
    });

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topN).filter(s => s.score > 0);

    if (top.length === 0) return '';

    const contexts = top.map(({ doc }) => {
      const lower = doc.text.toLowerCase();
      let excerpt = '';
      let foundPos = -1;
      for (const kw of LEGAL_KEYWORDS) {
        foundPos = lower.indexOf(kw);
        if (foundPos >= 0) break;
      }

      if (foundPos >= 0) {
        const start = Math.max(0, foundPos - 200);
        excerpt = doc.text.substring(start, Math.min(doc.text.length, foundPos + 500));
      } else {
        excerpt = doc.text.substring(0, 700);
      }

      excerpt = excerpt.replace(/\s+/g, ' ').trim();
      return `--- ${doc.filename} ---\n${excerpt}\n`;
    });

    return contexts.join('\n');
  }
}

module.exports = new InternalLegalRag();
