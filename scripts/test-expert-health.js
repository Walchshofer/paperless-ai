 
'use strict';

const path = require('path');

const defaultOllamaApiUrl = 'http://host.docker.internal:11434';
if (!process.env.OLLAMA_API_URL) {
  process.env.OLLAMA_API_URL = defaultOllamaApiUrl;
}

const result = {
  timestamp: new Date().toISOString(),
  ok: true,
  checks: {}
};

const setCheck = (name, ok, details) => {
  result.checks[name] = { ok, details };
  if (!ok) {
    result.ok = false;
  }
};

const makeMockOllama = () => ({
  async chat() {
    return {
      message: {
        content: JSON.stringify({
          classification: {
            primary_domain: 'General',
            document_type: 'correspondence',
            confidence: 0.51,
            evidence: ['mock']
          },
          routing: {
            recommended_pipeline: 'PIPELINE_GENERAL_V1',
            requires_visual_analysis: false,
            requires_expert_model: false,
            suggested_models: []
          },
          quality_assessment: {
            visual_clarity: 'low',
            text_legibility: 'high',
            completeness: 'complete',
            issues: []
          },
          metadata_hints: {
            detected_date: null,
            detected_entities: [],
            language: 'en'
          }
        })
      }
    };
  }
});

const run = async () => {
  // 1) Component Loading
  try {
    const { DocumentProcessor } = require('../services/integration/DocumentProcessor');
    const { promptRegistry } = require('../services/prompts/PromptRegistry');
    const { expertRegistry } = require('../services/experts/ExpertRegistry');

    const processor = new DocumentProcessor(makeMockOllama(), {
      features: {
        enableExpertPipeline: true,
        enableMedicalPipeline: true,
        enableMetricsLogging: false,
        enableFallbackToLegacy: false,
        enableVatRag: false
      }
    });

    const promptCount = promptRegistry.list().length;
    const pipelineCount = expertRegistry.list().length;

    setCheck('componentLoading', promptCount > 0 && pipelineCount > 0, {
      promptCount,
      pipelineCount,
      processorReady: !!processor
    });
  } catch (error) {
    setCheck('componentLoading', false, { error: error.message });
  }

  // 2) API Bridge Verification (compat.js)
  try {
    const config = require('../config/config');
    const ollamaService = require('../services/ollamaService');
    const model = process.env.OLLAMA_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b';
    const response = await ollamaService.chat({
      model,
      messages: [{ role: 'user', content: 'Hello' }],
      options: { temperature: 0 },
      stream: false
    });

    const content = typeof response === 'string'
      ? response
      : (response?.message?.content || response?.response || '');

    setCheck('chatBridge', typeof content === 'string' && content.length > 0, {
      model,
      responseLength: content.length,
      apiUrl: process.env.OLLAMA_API_URL
    });
  } catch (error) {
    setCheck('chatBridge', false, {
      error: error.message,
      apiUrl: process.env.OLLAMA_API_URL
    });
  }

  // 3) Pipeline Routing
  try {
    const { DocumentProcessor } = require('../services/integration/DocumentProcessor');
    const processor = new DocumentProcessor(makeMockOllama(), {
      features: {
        enableExpertPipeline: true,
        enableMedicalPipeline: true,
        enableMetricsLogging: false,
        enableFallbackToLegacy: false,
        enableVatRag: false
      }
    });

    const classification = await processor.classify({
      id: 'healthcheck-001',
      filename: 'healthcheck.txt',
      content: 'Invoice total 100 EUR',
      ocr_text: 'Invoice total 100 EUR'
    });

    const primaryDomain = classification?.classification?.primary_domain;
    setCheck('pipelineRouting', Boolean(primaryDomain), {
      primary_domain: primaryDomain || null,
      raw: classification
    });
  } catch (error) {
    setCheck('pipelineRouting', false, { error: error.message });
  }

  // 4) Legacy Fallback Safety
  try {
    const vision = require('../services/ollama/vision')({
      ExpertPipelineExecutor: require('../services/experts/ExpertPipelineExecutor'),
      expertRegistry: require('../services/experts/ExpertRegistry').expertRegistry
    });
    const text = require('../services/ollama/text');

    const visionOk = typeof vision.analyzeDocumentWithVision === 'function';
    const textOk = typeof text.analyzeDocument === 'function';

    setCheck('legacyFallback', visionOk && textOk, {
      visionLoaded: visionOk,
      textLoaded: textOk
    });
  } catch (error) {
    setCheck('legacyFallback', false, { error: error.message });
  }

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
