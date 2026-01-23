const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'test-results', 'playwright-report-zip');
const files = fs.readdirSync(dir);
const keywords = ['shadcn','shadcn-compat','data-mounted','island="shadcn-compat"','island'];
let found = false;
for (const f of files) {
  const p = path.join(dir, f);
  const txt = fs.readFileSync(p,'utf8');
  for (const kw of keywords) {
    if (txt.indexOf(kw) !== -1) {
      console.log('Found', kw, 'in', f);
      found = true;
    }
  }
}
if (!found) console.log('No keywords found in report files.');
