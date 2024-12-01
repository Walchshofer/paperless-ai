const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { OpenAI } = require('openai');

class SetupService {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
  }

  async loadConfig() {
    try {
      const envContent = await fs.readFile(this.envPath, 'utf8');
      const config = {};
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          config[key.trim()] = value.trim();
        }
      });
      return config;
    } catch (error) {
      return null;
    }
  }

  async validatePaperlessConfig(url, token) {
    try {
      const response = await axios.get(`${url}/documents/`, {
        headers: {
          'Authorization': `Token ${token}`
        }
      });
      return response.status === 200;
    } catch (error) {
      console.error('Paperless validation error:', error.message);
      return false;
    }
  }

  async validateOpenAIConfig(apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Test" }],
      });
      return response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('OpenAI validation error:', error.message);
      return false;
    }
  }

  async saveConfig(config) {
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    await fs.writeFile(this.envPath, envContent);
    
    // Reload environment variables
    Object.entries(config).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  async isConfigured() {
    try {
      await fs.access(this.envPath);
      const config = await this.loadConfig();
      return config !== null;
    } catch {
      return false;
    }
  }
}

module.exports = new SetupService();