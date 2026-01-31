const assert = require('assert');
const fs = require('fs');
const path = require('path');

function readAllEjs(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      results.push(...readAllEjs(full));
    } else if (it.isFile() && it.name.endsWith('.ejs')) {
      results.push(full);
    }
  }
  return results;
}

function extractIslandNamesFromRuntime(runtimePath) {
  const src = fs.readFileSync(runtimePath, 'utf8');
  const regs = [...src.matchAll(/'([a-z0-9-]+)'\s*:/gi)];
  return regs.map(m => m[1]);
}

describe('Templates audit (T21)', function() {
  const viewsDir = path.join(__dirname, '../../views');
  const runtimePath = path.join(__dirname, '../../src/islands/runtime.browser.tsx');
  const allViews = readAllEjs(viewsDir);
  const runtimeIslands = extractIslandNamesFromRuntime(runtimePath);

  it('no direct `config.` references in views (non-partials) — use `vm.*` instead', function() {
    const violations = [];
    for (const f of allViews) {
      if (f.includes(path.join('views', 'partials'))) continue; // partials allowed to be small helpers
      const src = fs.readFileSync(f, 'utf8');
      if (/\bconfig\./.test(src)) {
        violations.push({ file: f, snippet: src.split('\n').slice(0, 6).join('\n') });
      }
    }

    if (violations.length) {
      console.error('Found templates referencing `config.` directly:');
      violations.forEach(v => console.error(` - ${v.file}`));
    }
    assert.strictEqual(violations.length, 0, 'Templates should not reference `config.` directly; use `vm.*` provided by route handlers');
  });

  it('pages with a <body> tag must include a `data-page` attribute on <body>', function() {
    const failures = [];
    for (const f of allViews) {
      const src = fs.readFileSync(f, 'utf8');
      if (/<body/gi.test(src)) {
        if (!/<body[^>]*data-page=/i.test(src)) {
          failures.push(f);
        }
      }
    }
    if (failures.length) console.error('Missing data-page on body in:', failures.join('\n'));
    assert.strictEqual(failures.length, 0, 'All top-level pages must include `data-page` on <body>');
  });

  it('interactive elements like <button> should include a stable `data-testid`', function() {
    const missing = [];
    for (const f of allViews) {
      const src = fs.readFileSync(f, 'utf8');
      const buttonMatches = [...src.matchAll(/<button\b[^>]*>/gi)];
      for (const m of buttonMatches) {
        const tag = m[0];
        if (!/data-testid=/.test(tag)) {
          missing.push({ file: f, tag });
        }
      }
    }
    if (missing.length) console.error('Buttons missing data-testid in:', missing.slice(0,10).map(x => x.file).join('\n'));
    assert.strictEqual(missing.length, 0, 'All interactive <button> elements should have `data-testid` attributes');
  });

  it('data-island names used in templates must be registered in the island runtime', function() {
    const unregistered = [];
    for (const f of allViews) {
      const src = fs.readFileSync(f, 'utf8');
      const islandMatches = [...src.matchAll(/data-island="([^"]+)"/gi)];
      for (const m of islandMatches) {
        const name = m[1];
        if (!runtimeIslands.includes(name)) {
          unregistered.push({ file: f, island: name });
        }
      }
    }

    if (unregistered.length) console.error('Unregistered islands found:', unregistered.map(x => `${x.island} in ${x.file}`).join('\n'));
    assert.strictEqual(unregistered.length, 0, 'All data-island names must be present in the islands runtime registry');
  });
});
