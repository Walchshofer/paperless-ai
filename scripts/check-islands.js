#!/usr/bin/env node
/**
 * Lightweight check to ensure views contain data-island anchors and data-testid attributes.
 */
const fs = require('fs');
const path = require('path');

function findFiles(dir, ext) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...findFiles(p, ext));
    else if (p.endsWith(ext)) results.push(p);
  }
  return results;
}

const views = findFiles(path.join(__dirname, '..', 'views'), '.ejs');
let missing = 0;
for (const v of views) {
  const content = fs.readFileSync(v, 'utf8');
  if (!content.includes('data-island') && !content.includes('data-testid')) {
    console.warn(`View ${v} has no data-island or data-testid anchors`);
    missing++;
  }
}
if (missing) {
  console.warn(`${missing} views missing island/testid anchors`);
  process.exit(0); // not fatal
}
console.log('Island anchor checks passed');
process.exit(0);
