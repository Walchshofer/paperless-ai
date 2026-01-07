const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'js', 'dist', 'island-runtime.js');

(async () => {
  try {
    const stat = await fs.promises.stat(file);
    if (!stat || stat.size < 20) {
      console.error(`Island runtime file missing or too small: ${file}`);
      process.exit(2);
    }
    console.log(`Island runtime file present: ${file} (${stat.size} bytes)`);
    process.exit(0);
  } catch (err) {
    console.error('Island runtime check failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();