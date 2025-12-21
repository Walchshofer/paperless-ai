const config = require('../config/config');
const expertRegistry = require('./ExpertRegistry');

/**
 * Executes expert pipeline stages in sequence.
 * Additive to general extraction - results are merged.
 */
class ExpertPipelineExecutor {
    constructor(promptFactory, ollamaClient) {
        this.promptFactory = promptFactory;
        this.client = ollamaClient;
        this.apiUrl = config.ollama.apiUrl;
    }

    /**
     * Execute expert pipeline for a document
     * @param {string} domain - Expert domain
     * @param {Object} context - Execution context
     * @param {Object} telemetry - TelemetryCollector instance
     * @returns {Promise<Object>} Expert extraction result
     */
    async execute(domain, context, telemetry) {
        const expert = expertRegistry.get(domain);
        if (!expert || expert.status !== 'active') {
            console.log(`[EXPERT_PIPELINE] No active expert for domain: ${domain}`);
            return null;
        }

        const stages = expertRegistry.getApplicableStages(domain, context);
        if (stages.length === 0) {
            console.log('[EXPERT_PIPELINE] No applicable stages for context');
            return null;
        }

        console.log(`[EXPERT_PIPELINE] Executing ${stages.length} stages for ${domain}`);

        let stageInput = { ...context, content: context.content };
        let result = {};

        for (const stage of stages) {
            const stageTimer = telemetry?.startStage(`expert_${stage.stage}`, expert.models[stage.model]);

            try {
                const stageResult = await this._executeStage(stage, stageInput, expert, context);
                result = this._mergeResults(result, stageResult);
                stageInput = { ...context, previousStageOutput: stageResult };
                telemetry?.endStage(stageTimer, true);
                console.log(`[EXPERT_PIPELINE] Stage ${stage.stage} completed`);
            } catch (error) {
                telemetry?.endStage(stageTimer, false);
                console.error(`[EXPERT_PIPELINE] Stage ${stage.stage} failed: ${error.message}`);
            }
        }

        return result;
    }

    async _executeStage(stage, input, expert, context) {
        const modelName = expert.models[stage.model];
        if (!modelName) {
            throw new Error(`No model configured for stage: ${stage.stage}`);
        }

        const prompt = this._buildStagePrompt(stage, input, context);

        if (stage.input === 'image') {
            return this._callVisionAPI(modelName, prompt, context.base64Image);
        }

        const payload = input.previousStageOutput || input.content || input;
        return this._callTextAPI(modelName, prompt, payload);
    }

    _buildStagePrompt(stage, input, context) {
        if (this.promptFactory && typeof this.promptFactory[stage.promptBuilder] === 'function') {
            return this.promptFactory[stage.promptBuilder](input, context);
        }

        switch (stage.stage) {
            case 'ocr':
                return 'Transcribe all visible text, tables, and values into Markdown. Preserve table structure.';
            case 'analysis':
                return `Analyze this medical lab report and extract biomarkers as JSON:\n${JSON.stringify(input.previousStageOutput)}`;
            case 'reasoning':
                return 'Analyze this radiology image and extract findings as JSON.';
            case 'recovery':
                return 'Extract missing metadata fields: title, correspondent, document_date. Return JSON.';
            default:
                return '';
        }
    }

    async _callVisionAPI(model, prompt, base64Image) {
        const response = await this.client.post(`${this.apiUrl}/api/generate`, {
            model,
            prompt,
            images: [base64Image],
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 2000,
                num_ctx: 8192
            }
        });

        return this._parseResponse(response.data);
    }

    async _callTextAPI(model, prompt, content) {
        const response = await this.client.post(`${this.apiUrl}/api/generate`, {
            model,
            prompt: `${prompt}\n\nContent:\n${typeof content === 'string' ? content : JSON.stringify(content)}`,
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 2000,
                num_ctx: 8192
            }
        });

        return this._parseResponse(response.data);
    }

    _parseResponse(responseData) {
        if (!responseData?.response) return null;

        if (typeof responseData.response === 'object') {
            return responseData.response;
        }

        if (typeof responseData.response === 'string') {
            const jsonMatch = responseData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    return { raw: responseData.response };
                }
            }
        }

        return { raw: responseData.response };
    }

    _mergeResults(existing, newResult) {
        if (!newResult) return existing;

        return {
            ...existing,
            ...newResult,
            biomarkers: [
                ...(existing.biomarkers || []),
                ...(newResult.biomarkers || [])
            ],
            custom_fields: {
                ...(existing.custom_fields || {}),
                ...(newResult.custom_fields || {})
            }
        };
    }
}

module.exports = ExpertPipelineExecutor;
