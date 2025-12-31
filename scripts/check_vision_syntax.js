const fs = require('fs');
const s = fs.readFileSync('services/ollama/vision.js', 'utf8');
console.log('LENGTH:', s.length);
console.log('LAST 300 CHARS:\n' + s.slice(-300));
let b = 0, p = 0, sq = 0, dq = 0, tl = 0;
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === '{') b++;
  if (ch === '}') b--;
  if (ch === '(') p++;
  if (ch === ')') p--;
  if (ch === "'") sq++;
  if (ch === '"') dq++;
  if (ch === '`') tl++;
}
console.log('BRACE_BALANCE=', b);
console.log('PAREN_BALANCE=', p);
console.log("SINGLE_QUOTE_COUNT=", sq);
console.log('DOUBLE_QUOTE_COUNT=', dq);
console.log('TEMPLATE_QUOTE_COUNT=', tl);
