# start-services.sh - Start Node.js Paperless-AI only (RAG services run externally)

echo "Starting Node.js Paperless-AI service..."
exec pm2-runtime ecosystem.config.js
