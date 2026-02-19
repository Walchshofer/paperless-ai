const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.join(__dirname, '..', 'docker-compose.env');
const settings = {
  POSTGRES_HOST: 'paperless_db',
  VISUAL_RAG_QUERY_TIMEOUT: '10000',
  OLLAMA_API_URL: 'http://host.docker.internal:11434',
  RAG_SERVICE_URL: 'http://text_rag:8004',
  VISUAL_RAG_URL: 'http://visual_rag:8001',
  GUIDANCE_SERVICE_URL: 'http://guidance_service:8002'
};

try {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing authoritative env file: ${envPath}`);
  }

  let content = fs.readFileSync(envPath, 'utf8');
  let lines = content.split('\n');
  
  lines = lines.map(line => {
    const match = line.match(/^([A-Z_]+)=/);
    if (match) {
      const key = match[1];
      if (settings[key]) {
        return `${key}=${settings[key]}`;
      }
    }
    return line;
  });

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('Successfully updated docker-compose.env with optimized settings.');
  execSync('npm run -s env:sync', { stdio: 'inherit' });
  console.log('Regenerated compatibility .env from docker-compose.env.');
} catch (err) {
  console.error('Failed to optimize environment settings:', err.message);
  process.exit(1);
}
