const fs = require('fs');
const path = require('path');

const publicSrc = path.join(__dirname, '..', 'public', 'js', 'island-runtime.js');
const fallbackSrc = path.join(__dirname, '..', 'src', 'islands', 'runtime.js');
const destDir = path.join(__dirname, '..', 'public', 'js', 'dist');
const dest = path.join(destDir, 'island-runtime.js');

(async () => {
  try {
    await fs.promises.mkdir(destDir, { recursive: true });
    let data;
    try {
      // Prefer browser-friendly source if present
      data = await fs.promises.readFile(publicSrc, 'utf8');
    } catch (e) {
      // Fall back to original src (legacy builds may rely on external bundling)
      data = await fs.promises.readFile(fallbackSrc, 'utf8');
    }
    await fs.promises.writeFile(dest, data, 'utf8');
    console.log(`Wrote island runtime to ${dest}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to build island runtime:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();