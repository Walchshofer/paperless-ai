const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { OpenAI } = require('openai');
const config = require('../config/config');
const AzureOpenAI = require('openai').AzureOpenAI;
const { isProtectedRuntimeKey } = require('../config/envPolicy');

class SetupService {
  constructor() {
    // Runtime environment file persisted by the app (renamed from data/.env ➜ data/runtime.env)
    this.envPath = path.join(process.cwd(), 'data', 'runtime.env');
    this.configured = null; // Variable to store the configuration status
  }

  /**
   * Attempt a safe migration from legacy `data/.env` to `data/runtime.env`.
   * - If legacy exists and runtime file is missing, copy legacy -> runtime and
   *   rename legacy to `.migrated` to preserve a backup.
   * - Operation is idempotent and safe; returns true if migration occurred.
   */
  async migrateLegacyEnv(baseDir = process.cwd()) {
    const legacyPath = path.join(baseDir, 'data', '.env');
    const runtimePath = baseDir === process.cwd() ? this.envPath : path.join(baseDir, 'data', 'runtime.env');

    try {
      // Check legacy presence
      await fs.access(legacyPath);
    } catch (e) {
      // Legacy file not present
      return false;
    }

    try {
      // If runtime already exists, skip migration
      await fs.access(runtimePath);
      console.info('[setup] runtime env already present, skipping legacy migration');
      return false;
    } catch (e) {
      // runtime missing; proceed
    }

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(runtimePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Copy legacy to runtime while stripping protected infra keys.
      const legacyContent = await fs.readFile(legacyPath, 'utf8');
      const sanitized = this.sanitizeRuntimeEnvContent(legacyContent);
      await fs.writeFile(runtimePath, sanitized.content, 'utf8');
      if (sanitized.removedKeys.length > 0) {
        console.warn(
          '[setup] Removed protected keys during legacy env migration:',
          sanitized.removedKeys.join(', ')
        );
      }

      // Rename legacy to .migrated to preserve original
      const migratedPath = `${legacyPath}.migrated`;
      try {
        await fs.rename(legacyPath, migratedPath);
        console.info(`[setup] Migrated ${legacyPath} -> ${migratedPath}`);
      } catch (renameErr) {
        // If rename fails, leave legacy in place but log the condition
        console.warn('[setup] Legacy env found but failed to rename after copying:', renameErr && renameErr.message ? renameErr.message : renameErr);
      }

      return true;
    } catch (err) {
      console.error('[setup] Migration from data/.env to data/runtime.env failed:', err && err.message ? err.message : err);
      return false;
    }
  }

  sanitizeRuntimeEnvContent(content) {
    if (!content || typeof content !== 'string') {
      return { content: '', removedKeys: [] };
    }
    const removedKeys = [];
    const sanitizedLines = content.split('\n').filter((line) => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (!match) return true;
      const key = match[1];
      if (!isProtectedRuntimeKey(key)) return true;
      removedKeys.push(key);
      return false;
    });

    return {
      content: sanitizedLines.join('\n'),
      removedKeys
    };
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
      if (error && error.code !== 'ENOENT') {
        console.error('Error loading config:', error.message);
      }
      return null;
    }
  }

  async validatePaperlessConfig(url, token) {
    try {
      console.log('Validating Paperless config for:', url + '/api/documents/');
      const response = await axios.get(`${url}/api/documents/`, {
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

  async validateApiPermissions(url, token) {
    for (const endpoint of ['correspondents', 'tags', 'documents', 'document_types', 'custom_fields', 'users']) {
      try {
        console.log(`Validating API permissions for ${url}/api/${endpoint}/`);
        const response = await axios.get(`${url}/api/${endpoint}/`, {
          headers: {
            'Authorization': `Token ${token}`
          }
        });
        console.log(`API permissions validated for ${endpoint}, ${response.status}`);
        if (response.status !== 200) {
          console.error(`API permissions validation failed for ${endpoint}`);
          return { success: false, message: `API permissions validation failed for endpoint '/api/${endpoint}/'` };
        }
      } catch (error) {
        console.error(`API permissions validation failed for ${endpoint}:`, error.message);
        return { success: false, message: `API permissions validation failed for endpoint '/api/${endpoint}/'` };
      }
    }
    return { success: true, message: 'API permissions validated successfully' };
}


  async validateOpenAIConfig(apiKey) {
    if (config.CONFIGURED === false) {
      try {
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Test" }],
        });
        const now = new Date();
        const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
        console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
        return response.choices && response.choices.length > 0;
      } catch (error) {
        console.error('OpenAI validation error:', error.message);
        return false;
      }
    }else{
      return true;
    }
  }

  async validateCustomConfig(url, apiKey, model) {
    const config = {
      baseURL: url,
      apiKey: apiKey,
      model: model
    };
    console.log('Custom AI config:', config);
    try {
      const openai = new OpenAI({ 
        apiKey: config.apiKey, 
        baseURL: config.baseURL,
      });
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: "Test" }],
        model: config.model,
      });
      return completion.choices && completion.choices.length > 0;
    } catch (error) {
      console.error('Custom AI validation error:', error);
      return false;
    }
  }



  async validateOllamaConfig(url, model) {
    try {
      const response = await axios.post(`${url}/api/generate`, {
        model: model || 'sauerkraut-llama3.1:8b',
        prompt: 'Test',
        stream: false
      });
      return response.data && response.data.response;
    } catch (error) {
      console.error('Ollama validation error:', error.message);
      return false;
    }
  }

  async validateAzureConfig(apiKey, endpoint, deploymentName, apiVersion) {
    console.log('Endpoint: ', endpoint);
    if (config.CONFIGURED === false) {
      try {
        const openai = new AzureOpenAI({ apiKey: apiKey,
                endpoint: endpoint,
                deploymentName: deploymentName,
                apiVersion: apiVersion });
        const response = await openai.chat.completions.create({
          model: deploymentName,
          messages: [{ role: "user", content: "Test" }],
        });
        const now = new Date();
        const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
        console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
        return response.choices && response.choices.length > 0;
      } catch (error) {
        console.error('OpenAI validation error:', error.message);
        return false;
      }
    }else{
      return true;
    }
  }

  async validateConfig(config) {
    // Helper to read values safely from either a plain config object or a proxied config with getRaw/__getOriginal
    const readConfigValue = (cfg, key) => {
      try {
        if (!cfg) return undefined;
        if (typeof key === 'string' && key.includes('.')) {
          const parts = key.split('.');
          // try getRaw with path
          if (typeof cfg.getRaw === 'function') return cfg.getRaw(parts.join('.'));
          if (typeof cfg.__getOriginal === 'function') return cfg.__getOriginal(parts.join('.'));
          // fallback to nested property access
          let cur = cfg;
          for (const p of parts) {
            if (!cur) return undefined;
            cur = cur[p];
          }
          return cur;
        }

        if (typeof cfg.getRaw === 'function') {
          const v = cfg.getRaw(key);
          if (v !== undefined) return v;
          const all = cfg.getRaw();
          return all && all[key];
        }
        if (typeof cfg.__getOriginal === 'function') {
          const v = cfg.__getOriginal(key);
          if (v !== undefined) return v;
          const all = cfg.__getOriginal();
          return all && all[key];
        }
        return cfg && cfg[key];
      } catch (e) {
        return cfg && cfg[key];
      }
    };

    // Validate Paperless config (support both env-style and nested config formats)
    const rawUrl = readConfigValue(config, 'PAPERLESS_API_URL')
      || readConfigValue(config, 'paperless.apiUrl')
      || process.env.PAPERLESS_API_URL
      || '';
    const rawToken = readConfigValue(config, 'PAPERLESS_API_TOKEN')
      || readConfigValue(config, 'paperless.apiToken')
      || process.env.PAPERLESS_API_TOKEN
      || '';
    const paperlessApiUrl = String(rawUrl).replace(/\/api/g, '');
    const paperlessValid = await this.validatePaperlessConfig(
      paperlessApiUrl,
      rawToken
    );
    
    if (!paperlessValid) {
      throw new Error('Invalid Paperless configuration');
    }

    // Validate AI provider config
    const aiProvider = config.AI_PROVIDER || process.env.AI_PROVIDER || 'openai';

    console.log('AI provider:', aiProvider);
    
    if (aiProvider === 'openai') {
      const openaiValid = await this.validateOpenAIConfig(
        config.PAPERLESS_OPENAI_API_KEY || process.env.PAPERLESS_OPENAI_API_KEY
      );
      if (!openaiValid) {
        throw new Error('Invalid OpenAI configuration');
      }
    } else if (aiProvider === 'ollama') {
      const ollamaValid = await this.validateOllamaConfig(
        config.OLLAMA_API_URL || process.env.OLLAMA_API_URL || 'http://localhost:11434',
        config.OLLAMA_MODEL || process.env.OLLAMA_MODEL
      );
      if (!ollamaValid) {
        throw new Error('Invalid Ollama configuration');
      }
    } else if (aiProvider === 'custom') {
      const customValid = await this.validateCustomConfig(
        config.CUSTOM_BASE_URL || process.env.CUSTOM_BASE_URL,
        config.CUSTOM_API_KEY || process.env.CUSTOM_API_KEY,
        config.CUSTOM_MODEL || process.env.CUSTOM_MODEL
      );
      if (!customValid) {
        throw new Error('Invalid Custom AI configuration');
      }
    } else if (aiProvider === 'azure') {
      const azureValid = await this.validateAzureConfig(
        config.AZURE_API_KEY || process.env.AZURE_API_KEY,
        config.AZURE_ENDPOINT || process.env.AZURE_ENDPOINT,
        config.AZURE_DEPLOYMENT_NAME || process.env.AZURE_DEPLOYMENT_NAME,
        config.AZURE_API_VERSION || process.env.AZURE_API_VERSION
      );
      if (!azureValid) {
        throw new Error('Invalid Azure configuration');
      }
    }


    return true;
  }

  async saveConfig(config) {
    try {
      // Validate the new configuration before saving
      await this.validateConfig(config);

      const _JSON_STANDARD_PROMPT = `
        Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:

        {
          "title": "xxxxx",
          "correspondent": "xxxxxxxx",
          "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
          "document_date": "YYYY-MM-DD",
          "language": "en/de/es/..."
        }`;

      // Ensure data directory exists
      const dataDir = path.dirname(this.envPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Prefer a plain unproxied object for enumeration when available (config may be a proxied module.exports)
      let src = config;
      try {
        if (config && typeof config.getRaw === 'function') src = config.getRaw();
        else if (config && typeof config.__getOriginal === 'function') src = config.__getOriginal();
      } catch (e) {
        // Fall back to the provided object on any error
        src = config;
      }

      const skippedProtectedKeys = [];
      const runtimeEntries = Object.entries(src).filter(([key]) => {
        if (!isProtectedRuntimeKey(key)) return true;
        skippedProtectedKeys.push(key);
        return false;
      });

      if (skippedProtectedKeys.length > 0) {
        console.warn(
          '[setup] Skipping protected keys in runtime env persistence:',
          skippedProtectedKeys.join(', ')
        );
      }

      const envContent = runtimeEntries
        .map(([key, value]) => {
          if (key === "SYSTEM_PROMPT") {
            return `${key}=\`${value}\n\``;
          }
          return `${key}=${value}`;
        })
        .join('\n');

      await fs.writeFile(this.envPath, envContent);
      
      // Reload environment variables from the same plain source
      Object.entries(src).forEach(([key, value]) => {
        process.env[key] = value;
      });
    } catch (error) {
      console.error('Error saving config:', error.message);
      throw error;
    }
  }

  async isConfigured() {
    if (this.configured !== null) {
      return this.configured;
    }

    const maxAttempts = 60; // 5 minutes = 300 seconds, attempting every 5 seconds = 60 attempts
    const delayBetweenAttempts = 5000; // 5 seconds in milliseconds
    let attempts = 0;

    // Attempt to migrate legacy env if present (non-destructive)
    try {
      await this.migrateLegacyEnv();
    } catch (e) {
      // ignore migration failures here; we'll surface issues below
      console.warn('[setup] migrateLegacyEnv failed (ignored):', e && e.message ? e.message : e);
    }

    // First check whether effective PAPERLESS_API_URL is available.
    try {
      const runtimeConfig = await this.loadConfig();
      const effectivePaperlessUrl = runtimeConfig?.PAPERLESS_API_URL
        || process.env.PAPERLESS_API_URL;
      if (!effectivePaperlessUrl) {
        console.log('PAPERLESS_API_URL not set. Starting setup process...');
        this.configured = false;
        return false;
      }
    } catch (error) {
      console.error('Error checking initial configuration:', error.message);
      this.configured = false;
      return false;
    }

    const attemptConfiguration = async () => {
      try {
        // Check data directory and create if needed
        const dataDir = path.dirname(this.envPath);
        try {
          await fs.access(dataDir, fs.constants.F_OK);
        } catch (err) {
          console.log('Creating data directory...');
          await fs.mkdir(dataDir, { recursive: true });
        }

        // Merge runtime overrides over environment SOT and validate.
        const runtimeConfig = (await this.loadConfig()) || {};
        const effectiveConfig = { ...process.env, ...runtimeConfig };
        await this.validateConfig(effectiveConfig);
        this.configured = true;
        return true;
      } catch (error) {
        console.error('Configuration attempt failed:', error.message);
        throw error;
      }
    };

    // Only enter retry loop if we have PAPERLESS_API_URL set
    while (attempts < maxAttempts) {
      try {
        const result = await attemptConfiguration();
        return result;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          console.error('Max configuration attempts reached. Final error:', error.message);
          this.configured = false;
          return false;
        }
        console.log(`Retrying configuration (attempt ${attempts}/${maxAttempts}) in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
    }

    this.configured = false;
    return false;
  }
}

module.exports = new SetupService();
