const fs = require('fs');
const path = require('path');
const { isProtectedRuntimeKey } = require('../config/envPolicy');

const envPath = path.join(__dirname, '..', 'data', 'runtime.env');
const settings = {
  EXPERT_PIPELINE_ENABLED: 'yes',
  ENABLE_VISUAL_RAG: 'yes',
  ENABLE_VISUAL_RAG_SIDECAR: 'yes'
};

try {
  const blocked = Object.keys(settings).filter((key) => isProtectedRuntimeKey(key));
  if (blocked.length > 0) {
    throw new Error(
      `Refusing to write protected keys to runtime env: ${blocked.join(', ')}`
    );
  }

  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  let lines = content.split('\n');
  const existingKeys = new Set();
  
  lines = lines.map(line => {
    const match = line.match(/^([A-Z_]+)=/);
    if (match) {
      const key = match[1];
      existingKeys.add(key);
      if (settings[key]) {
        return `${key}=${settings[key]}`;
      }
    }
    return line;
  });

  Object.entries(settings).forEach(([key, value]) => {
    if (!existingKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  });

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('Successfully enabled services in data/runtime.env');
} catch (err) {
  console.error('Failed to update settings:', err.message);
  process.exit(1);
}
