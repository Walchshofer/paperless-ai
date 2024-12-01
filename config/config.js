require('dotenv').config();

module.exports = {
  paperless: {
    apiUrl: process.env.PAPERLESS_API_URL,
    apiToken: process.env.PAPERLESS_API_TOKEN
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  scanInterval: process.env.SCAN_INTERVAL || '*/30 * * * *'
};