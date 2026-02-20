# start-services.sh - Start Node.js Paperless-AI only (RAG services run externally)

echo "Running environment preflight audit..."
if ! node scripts/audit_env_sot.js --preflight; then
  echo "Environment preflight command failed unexpectedly; continuing startup."
fi

echo "Starting Node.js Paperless-AI service..."
exec pm2-runtime ecosystem.config.js
