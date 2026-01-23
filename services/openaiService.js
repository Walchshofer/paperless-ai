const {
  calculateTokens,
  calculateTotalPromptTokens,
  truncateToTokenLimit,
  writePromptToFile,
  appendFilenameFormat
} = require('./serviceUtils');
const OpenAI = require('openai');
const config = require('../config/config');
const paperlessService = require('./paperlessService');
const fs = require('fs').promises;
const { normalizeCustomFieldValue } = require('./customFieldUtils');
const path = require('path');
const { model } = require('./ollamaService');
const RestrictionPromptService = require('./restrictionPromptService');
const logger = require('./logger');

class OpenAIService {
  constructor() {
    this.client = null;
  }

  initialize() {
    if (!this.client && config.aiProvider === 'ollama') {
      this.client = new OpenAI({
        baseURL: config.ollama.apiUrl + '/v1',
        apiKey: 'ollama'
      });
    } else if (!this.client && config.aiProvider === 'custom') {
      this.client = new OpenAI({
        baseURL: config.custom.apiUrl,
        apiKey: config.custom.apiKey
      });
    } else if (!this.client && config.aiProvider === 'openai') {
      if (!this.client && config.openai.apiKey) {
        this.client = new OpenAI({
          apiKey: config.openai.apiKey
        });
      }
    }
  }

  async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
    const cachePath = path.join('./public/images', `${id}.png`);
    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }

      // Handle thumbnail caching
      try {
        await fs.access(cachePath);
        logger.debug('Thumbnail already cached');
      } catch (err) {
        logger.debug('Thumbnail not cached, fetching from Paperless');

        const thumbnailData = await paperlessService.getThumbnailImage(id);

        if (!thumbnailData) {
          console.warn('Thumbnail nicht gefunden');
        }

        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, thumbnailData);
      }

      // Format existing tags
      let existingTagsList = existingTags.join(', ');

      // Get external API data if available and validate it
      let externalApiData = options.externalApiData || null;
      let validatedExternalApiData = null;

      if (externalApiData) {
        try {
          validatedExternalApiData = await this._validateAndTruncateExternalApiData(externalApiData);
          logger.debug('External API data validated and included');
        } catch (error) {
          console.warn('[WARNING] External API data validation failed:', error.message);
          validatedExternalApiData = null;
        }
      }

      let systemPrompt = '';
      let promptTags = '';
      const model = process.env.PAPERLESS_OPENAI_MODEL;

      // Parse CUSTOM_FIELDS from environment variable
      let customFieldsObj;
      try {
        customFieldsObj = JSON.parse(process.env.CUSTOM_FIELDS);
      } catch (error) {
        console.error('Failed to parse CUSTOM_FIELDS:', error);
        customFieldsObj = { custom_fields: [] };
      }

      // Generate custom fields template for the prompt
      const customFieldsTemplate = {};

      customFieldsObj.custom_fields.forEach((field) => {
        if (field?.value) {
          customFieldsTemplate[field.value] = null;
        }
      });

      // Convert template to string for replacement and wrap in custom_fields
      const customFieldsStr = '"custom_fields": ' + JSON.stringify(customFieldsTemplate, null, 2)
        .split('\n')
        .map(line => '    ' + line)  // Add proper indentation
        .join('\n');

      // Get system prompt and model
      if (config.useExistingData === 'yes' && config.restrictToExistingTags === 'no' && config.restrictToExistingCorrespondents === 'no') {
        systemPrompt = `
        Pre-existing tags: ${existingTagsList}\n\n
        Pre-existing correspondents: ${existingCorrespondentList}\n\n
        Pre-existing document types: ${existingDocumentTypesList.join(', ')}\n\n
        ` + process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        promptTags = '';
      } else {
        config.mustHavePrompt = config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        systemPrompt = process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt;
        promptTags = '';
      }

      // Process placeholder replacements in system prompt
      systemPrompt = RestrictionPromptService.processRestrictionsInPrompt(
        systemPrompt,
        existingTags,
        existingCorrespondentList,
        config
      );

      // Include validated external API data if available
      if (validatedExternalApiData) {
        systemPrompt += `\n\nAdditional context from external API:\n${validatedExternalApiData}`;
      }

      if (process.env.USE_PROMPT_TAGS === 'yes') {
        promptTags = process.env.PROMPT_TAGS;
        systemPrompt = `
        Take these tags and try to match one or more to the document content.\n\n
        ` + config.specialPromptPreDefinedTags;
      }

      if (customPrompt) {
        logger.debug('Replace system prompt with custom prompt via WebHook');
        systemPrompt = customPrompt + '\n\n' + config.mustHavePrompt;
      }

      systemPrompt = appendFilenameFormat(systemPrompt);

      // Calculate tokens AFTER all prompt modifications are complete
      const totalPromptTokens = await calculateTotalPromptTokens(
        systemPrompt,
        process.env.USE_PROMPT_TAGS === 'yes' ? [promptTags] : [],
        model
      );

      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens);
      const availableTokens = maxTokens - reservedTokens;

      // Validate that we have positive available tokens
      if (availableTokens <= 0) {
        console.warn(`[WARNING] No available tokens for content. Reserved: ${reservedTokens}, Max: ${maxTokens}`);
        throw new Error('Token limit exceeded: prompt too large for available token limit');
      }

      logger.debug(`Token calculation - Prompt: ${totalPromptTokens}, Reserved: ${reservedTokens}, Available: ${availableTokens}`);
      logger.debug(`Use existing data: ${config.useExistingData}, Restrictions applied based on useExistingData setting`);
      logger.debug(`External API data: ${validatedExternalApiData ? 'included' : 'none'}`);

      const truncatedContent = await truncateToTokenLimit(content, availableTokens, model);

      await writePromptToFile(systemPrompt, truncatedContent);

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        ...(model !== 'o3-mini' && { temperature: 0.3 }),
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }

      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(`[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`);

      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
        //write to file and append to the file (txt)
        fs.appendFile('./logs/response.txt', jsonContent, (err) => {
          if (err) throw err;
        });
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        throw new Error('Invalid JSON response from API');
      }

      if (!parsedResponse || !Array.isArray(parsedResponse.tags) || typeof parsedResponse.correspondent !== 'string') {
        throw new Error('Invalid response structure: missing tags array or correspondent string');
      }

      const normalizedResponse = this._normalizeDocumentOutput(parsedResponse);

      return {
        document: normalizedResponse,
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length
      };
    } catch (error) {
      console.error('Failed to analyze document:', error);
      return {
        document: this._normalizeDocumentOutput(null),
        metrics: null,
        error: error.message
      };
    }
  }

  _normalizeDocumentOutput(data) {
    const customFields = (data && typeof data.custom_fields === 'object' && !Array.isArray(data.custom_fields))
      ? data.custom_fields
      : {};

    // Normalize custom field values so numeric values can't trigger Django len() errors
    const normalizedCustomFields = {};
    for (const k of Object.keys(customFields || {})) {
      normalizedCustomFields[k] = normalizeCustomFieldValue(customFields[k]);
    }

    return {
      title: data?.title ?? null,
      correspondent: data?.correspondent ?? null,
      tags: Array.isArray(data?.tags) ? data.tags : [],
      document_type: data?.document_type ?? null,
      document_date: data?.document_date ?? null,
      language: data?.language ?? null,
      custom_fields: normalizedCustomFields
    };
  }

  /**
   * Validate and truncate external API data to prevent token overflow
   * @param {any} apiData - The external API data to validate
   * @param {number} maxTokens - Maximum tokens allowed for external data (default: 500)
   * @returns {string} - Validated and potentially truncated data string
   */
  async _validateAndTruncateExternalApiData(apiData, maxTokens = 500) {
    if (!apiData) {
      return null;
    }

    const dataString = typeof apiData === 'object'
      ? JSON.stringify(apiData, null, 2)
      : String(apiData);

    // Calculate tokens for the data
    const dataTokens = await calculateTokens(dataString, process.env.PAPERLESS_OPENAI_MODEL);

    if (dataTokens > maxTokens) {
      console.warn(`[WARNING] External API data (${dataTokens} tokens) exceeds limit (${maxTokens}), truncating`);
      return await truncateToTokenLimit(dataString, maxTokens, process.env.PAPERLESS_OPENAI_MODEL);
    }

    console.log(`[DEBUG] External API data validated: ${dataTokens} tokens`);
    return dataString;
  }

  async analyzePlayground(content, prompt) {
    const musthavePrompt = `
    Return the result EXCLUSIVELY as a JSON object. The Tags and Title MUST be in the language that is used in the document.:  
        {
          "title": "xxxxx",
          "correspondent": "xxxxxxxx",
          "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
          "document_date": "YYYY-MM-DD",
          "language": "en/de/es/..."
        }`;

    try {
      this.initialize();
      const now = new Date();
      const timestamp = now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

      if (!this.client) {
        throw new Error('OpenAI client not initialized - missing API key');
      }

      // Calculate total prompt tokens including musthavePrompt
      const totalPromptTokens = await calculateTotalPromptTokens(
        prompt + musthavePrompt // Combined system prompt
      );

      // Calculate available tokens
      const maxTokens = Number(config.tokenLimit);
      const reservedTokens = totalPromptTokens + Number(config.responseTokens); // Reserve for response
      const availableTokens = maxTokens - reservedTokens;

      // Truncate content if necessary
      const truncatedContent = await truncateToTokenLimit(content, availableTokens);
      const model = process.env.PAPERLESS_OPENAI_MODEL;
      // Make API request
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: prompt + musthavePrompt
          },
          {
            role: "user",
            content: truncatedContent
          }
        ],
        ...(model !== 'o3-mini' && { temperature: 0.3 }),
      });

      // Handle response
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }

      // Log token usage
      console.log(`[DEBUG] [${timestamp}] OpenAI request sent`);
      console.log(`[DEBUG] [${timestamp}] Total tokens: ${response.usage.total_tokens}`);

      const usage = response.usage;
      const mappedUsage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      };

      let jsonContent = response.choices[0].message.content;
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonContent);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        throw new Error('Invalid JSON response from API');
      }

      // Validate response structure
      if (!parsedResponse || !Array.isArray(parsedResponse.tags) || typeof parsedResponse.correspondent !== 'string') {
        throw new Error('Invalid response structure: missing tags array or correspondent string');
      }

      const normalizedResponse = this._normalizeDocumentOutput(parsedResponse);

      return {
        document: normalizedResponse,
        metrics: mappedUsage,
        truncated: truncatedContent.length < content.length
      };
    } catch (error) {
      console.error('Failed to analyze document:', error);
      return {
        document: this._normalizeDocumentOutput(null),
        metrics: null,
        error: error.message
      };
    }
  }

  /**
   * Generate text based on a prompt
   * @param {string} prompt - The prompt to generate text from
   * @returns {Promise<string>} - The generated text
   */
  async generateText(prompt) {
    try {
      this.initialize();

      if (!this.client) {
        throw new Error('OpenAI client not initialized - missing API key');
      }

      const model = process.env.PAPERLESS_OPENAI_MODEL || config.openai.model;

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating text with OpenAI:', error);
      throw error;
    }
  }

  async checkStatus() {
    // send test request to OpenAI API and respond with 'ok' or 'error'
    try {
      this.initialize();

      if (!this.client) {
        throw new Error('OpenAI client not initialized - missing API key');
      }
      const response = await this.client.chat.completions.create({
        model: process.env.PAPERLESS_OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: "Test"
          }
        ],
        temperature: 0.7
      });
      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response structure');
      }
      return { status: 'ok', model: process.env.PAPERLESS_OPENAI_MODEL };
    } catch (error) {
      console.error('Error checking OpenAI status:', error);
      return { status: 'error', error: error.message };
    }
  }
}

module.exports = new OpenAIService();
