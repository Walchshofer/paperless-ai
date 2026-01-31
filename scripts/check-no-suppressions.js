#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Patterns to detect
const patterns = [
  /\/\*\s*eslint-disable(?!-next-line)/i,
  /\/\*\s*eslint-disable-next-line/i,
  /\/\*\s*eslint-disable-line/i,
  /@ts-ignore\b/i,
  /@ts-nocheck\b/i,
  /\/\*\s*istanbul ignore next\b/i,
  /\/\/\s*istanbul ignore next\b/i
];

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', 'test/output', 'artifacts', '.git', 'public', 'test/results', '.serena']);

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      results.push(...walk(entryPath));
    } else if (entry.isFile()) {
      // Only scan source files
      if (!/\.(js|ts|tsx|jsx|ejs|md)$/i.test(entry.name)) continue;
      results.push(entryPath);
    }
  }
  return results;
}

const files = walk(root);
let found = [];
for (const file of files) {
  // Skip the checker itself to avoid self-matches
  if (path.resolve(file) === path.resolve(__filename)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of patterns) {
      if (pat.test(line)) {
        found.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }
}

if (found.length === 0) {
  console.log('No suppression directives found.');
  process.exit(0);
}

console.log('Found suppression occurrences:');
for (const f of found) {
  console.log(`${f.file}:${f.line}: ${f.text}`);
}

console.log(`\nTotal occurrences: ${found.length}`);
process.exit(2);
