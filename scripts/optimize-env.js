const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const settings = {
  POSTGRES_HOST: 'paperless_db',
  VISUAL_RAG_QUERY_TIMEOUT: '10000',
  OLLAMA_API_URL: 'http://host.docker.internal:11434',
  RAG_SERVICE_URL: 'http://text_rag:8004',
  VISUAL_RAG_URL: 'http://visual_rag:8001',
  GUIDANCE_SERVICE_URL: 'http://guidance_service:8002'
};

try {
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
  console.log('Successfully updated .env with correct container hostnames and timeouts.');
} catch (err) {
  console.error('Failed to update .env:', err.message);
  process.exit(1);
}
