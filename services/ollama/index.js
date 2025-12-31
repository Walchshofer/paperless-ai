const axios = require('axios');
const config = require('../../config/config');
const FieldProfiler = require('../visual-rag/FieldProfiler');
const PromptFactory = require('../PromptFactory');
const ExtractionValidator = require('../ExtractionValidator');

const helpers = require('./helpers');
const text = require('./text');
const vision = require('./vision')({
    ExpertPipelineExecutor: require('../experts/ExpertPipelineExecutor'),
    expertRegistry: require('../experts/ExpertRegistry').expertRegistry
});
const sequential = require('./sequential');
const playground = require('./playground');
const status = require('./status');
const compat = require('./compat');
const logger = require('../logger');

class OllamaService {
    constructor() {
        this.apiUrl = config.ollama.apiUrl;
        this.model = config.ollama.model;

        // FIX: Dynamic Timeout Configuration
        const timeoutMs = parseInt(process.env.AXIOS_TIMEOUT, 10);
        this.timeout = (!isNaN(timeoutMs) && timeoutMs >= 5000) ? timeoutMs : 600000;

        logger.info(`[INFO] Ollama Service initialized. Model: ${this.model}, Timeout: ${this.timeout}ms`);

        this.client = axios.create({
            timeout: this.timeout
        });

        this.isGptOss = this.model.toLowerCase().includes('gpt-oss');

        // Initialize FieldProfiler for Visual RAG
        this.fieldProfiler = new FieldProfiler();
        this.promptFactory = new PromptFactory(this.fieldProfiler);
        this.extractionValidator = new ExtractionValidator();

        this.documentAnalysisSchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                correspondent: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                document_type: { type: "string" },
                document_date: { type: "string" },
                language: { type: "string" },
                custom_fields: { type: "object", additionalProperties: true }
            },
            required: ["title", "correspondent", "tags", "document_type", "document_date", "language"]
        };

        // Standard playground schema
        this.playgroundSchema = this.documentAnalysisSchema;
    }
}

Object.assign(
    OllamaService.prototype,
    helpers,
    text,
    vision,
    sequential,
    playground,
    status,
    compat
);

module.exports = new OllamaService();
