const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'islands', 'runtime.js');
const destDir = path.join(__dirname, '..', 'public', 'js', 'dist');
const dest = path.join(destDir, 'island-runtime.js');

(async () => {
  try {
    await fs.promises.mkdir(destDir, { recursive: true });
    const data = await fs.promises.readFile(src, 'utf8');
    await fs.promises.writeFile(dest, data, 'utf8');
    console.log(`Wrote island runtime to ${dest}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to build island runtime:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();