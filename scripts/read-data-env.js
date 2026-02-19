const fs = require('fs');
const path = require('path');

const runtimeEnvPath = path.join(__dirname, '..', 'data', 'runtime.env');
const legacyEnvPath = path.join(__dirname, '..', 'data', '.env');

const checkPath = (p, label) => {
  try {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      console.log(`--- START OF ${label} (${p}) ---`);
      console.log(content);
      console.log(`--- END OF ${label} ---`);
      return true;
    }
  } catch (err) {
    console.error(`Error reading ${label}:`, err.message);
  }
  return false;
};

const foundRuntime = checkPath(runtimeEnvPath, 'data/runtime.env');
if (!foundRuntime) {
  const foundLegacy = checkPath(legacyEnvPath, 'data/.env');
  if (!foundLegacy) {
    console.log('No data environment files found (checked runtime.env and .env)');
  }
}
