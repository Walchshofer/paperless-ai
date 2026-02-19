const PROTECTED_ENV_KEYS = new Set([
  'PAPERLESS_API_URL',
  'PAPERLESS_API_TOKEN',
  'PAPERLESS_USERNAME',
  'PAPERLESS_MEDIA_ROOT',
  'PAPERLESS_CONSUME_DIR',
  'OLLAMA_API_URL',
  'OLLAMA_HOST',
  'VISUAL_RAG_URL',
  'TEXT_RAG_URL',
  'GUIDANCE_SERVICE_URL',
  'BIAS_ENGINE_URL',
  'REDIS_URL',
  'DATABASE_URL',
  'JWT_SECRET',
  'QDRANT_HOST',
  'QDRANT_PORT',
  'QDRANT_API_KEY',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'PAPERLESS_DBHOST',
  'PAPERLESS_DBPORT',
  'PAPERLESS_DBNAME',
  'PAPERLESS_DBUSER',
  'PAPERLESS_DBPASS',
  'PAPERLESS_OPENAI_API_KEY',
  'AZURE_API_KEY',
  'CUSTOM_API_KEY'
]);

const PROTECTED_ENV_PREFIXES = [
  'POSTGRES_',
  'PAPERLESS_DB',
  'QDRANT_'
];

function isProtectedRuntimeKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (PROTECTED_ENV_KEYS.has(key)) return true;
  return PROTECTED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function findProtectedRuntimeKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.filter((key) => isProtectedRuntimeKey(key));
}

module.exports = {
  PROTECTED_ENV_KEYS,
  PROTECTED_ENV_PREFIXES,
  isProtectedRuntimeKey,
  findProtectedRuntimeKeys
};
