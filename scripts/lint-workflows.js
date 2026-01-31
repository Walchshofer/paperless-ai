const fs = require('fs');
const path = require('path');
const workflowsDir = path.join(__dirname, '..', '.github', 'workflows');
const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
let issues = [];
for (const f of files) {
  const filePath = path.join(workflowsDir, f);
  const txt = fs.readFileSync(filePath, 'utf8');
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/i.test(line)) {
      // Look backwards up to 6 lines for an 'env:' mapping
      let inEnv = false;
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        if (/\benv:\s*$/i.test(lines[j])) { inEnv = true; break; }
        // Stop scanning if we hit a new step or job declaration
        if (/^-\s*name:\s*/i.test(lines[j])) break;
      }
      issues.push({ file: f, line: i + 1, text: line.trim(), inEnv });
    }
  }
}

if (issues.length === 0) {
  console.log('No secret-in-env mapping issues found. Workflow linter check passed.');
  process.exit(0);
}

console.log('Found potential secret-in-env mapping issues:');
issues.forEach(it => console.log(`${it.file}:${it.line}: ${it.text} ${it.inEnv ? '(inside env mapping)' : ''}`));
process.exit(2);
