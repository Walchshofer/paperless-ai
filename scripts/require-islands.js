const path = require('path');
const fs = require('fs');

const dir = path.join(process.cwd(), 'src', 'islands');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

console.log('Checking island modules:', files.length);
for (const f of files) {
  const full = path.join(dir, f);
  try {
    require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: { module: 'CommonJS', jsx: 'react-jsx', jsxImportSource: 'preact' }, ignore: [] });
    require(full);
    console.log('OK:', f);
  } catch (err) {
    console.error('FAIL:', f, err && err.message);
  }
}
