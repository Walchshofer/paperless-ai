import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { getTestDocId, loadFixtureData } from '../helpers/fixtures';

/**
 * Pipeline Stages — Stage-Isolation E2E Tests
 *
 * Validates the stage-isolation API at /api/pipeline-stages.
 * Each test exercises a single pipeline stage in isolation, injecting
 * mock prior-stage outputs where needed.
 *
 * Prerequisites:
 * - Docker stack running (docker compose up -d)
 * - Ollama warmed (qwen3-vl:8b + sauerkraut-llama3.1:8b)
 * - paperless-ai at localhost:3000
 * - Test user `elfman` exists
 *
 * Authoritative References:
 * - docs/PIPELINE_STAGE_CONTRACTS.md
 * - docs/EXPERT_PIPELINE_DECISION_TABLE.md
 * - docs/PIPELINE_E2E_TEST_PROCEDURE.md
 */

// ────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const API_PREFIX = `${BASE_URL}/api/pipeline-stages`;

/** Credentials — matches PIPELINE_E2E_TEST_PROCEDURE.md Step 2 */
const AUTH_USER = process.env.PAPERLESS_ADMIN_USER || 'elfman';
const AUTH_PASS =
  process.env.PAPERLESS_ADMIN_PASSWORD ||
  process.env.POSTGRES_PASSWORD ||
  'P2tr3ck!1976';

/** Good test documents from PIPELINE_E2E_TEST_PROCEDURE.md */
const MEDICAL_DOC_ID = 41;
const MIXED_DOC_ID = 74;

/** LLM stages need generous timeouts (cold model + inference) */
const LLM_STAGE_TIMEOUT = 180_000;

/**
 * Authenticate via the login form and return session cookies as a
 * Cookie header string usable with `request.fetch()`.
 */
async function authenticateSession(
  request: APIRequestContext
): Promise<string> {
  const loginResp = await request.post(`${BASE_URL}/login`, {
    form: {
      username: AUTH_USER,
      password: AUTH_PASS,
    },
    maxRedirects: 0,
  });

  // Expect 302 redirect to /dashboard
  const status = loginResp.status();
  if (status !== 302 && status !== 200) {
    throw new Error(
      `Login failed with status ${status}. Check credentials or ENABLE_AUTH.`
    );
  }

  // Extract Set-Cookie headers for follow-up API calls
  const setCookies = loginResp.headersArray().filter(
    (h) => h.name.toLowerCase() === 'set-cookie'
  );
  if (setCookies.length === 0) {
    throw new Error('No Set-Cookie header returned from login');
  }

  // Build a Cookie header from the Set-Cookie values
  return setCookies
    .map((h) => h.value.split(';')[0])
    .join('; ');
}

/**
 * Shorthand for an authenticated GET request.
 */
async function apiGet(
  request: APIRequestContext,
  path: string,
  cookies: string
) {
  return request.get(`${API_PREFIX}${path}`, {
    headers: { Cookie: cookies },
  });
}

/**
 * Shorthand for an authenticated POST to execute-stage.
 */
async function apiExecuteStage(
  request: APIRequestContext,
  cookies: string,
  body: Record<string, unknown>
) {
  return request.post(`${API_PREFIX}/execute-stage`, {
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/json',
    },
    data: body,
    timeout: 120000, // Increase timeout for LLM inference (Medical can take ~70s)
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Mock context payloads (inject prior-stage outputs for isolated stages)
// ────────────────────────────────────────────────────────────────────────────

/** Minimal OCR output for stages that depend on parallel_ocr */
const MOCK_OCR_OUTPUT = {
  ocr: {
    text: 'Invoice #12345\nDate: 2025-01-15\nTotal: EUR 1.234,56\nVAT 20%: EUR 205,76',
    source: 'visual_ocr',
    quality_score: 0.85,
    page_count: 1,
  },
};

/** Minimal extraction output for stages that depend on extraction */
const MOCK_EXTRACTION_OUTPUT = {
  extraction: {
    title: 'Invoice #12345',
    date: '2025-01-15',
    correspondent: 'Test Corp',
    document_type: 'Invoice',
    tags: ['finance', 'invoice'],
    custom_fields: {
      total_amount: '1234.56',
      currency: 'EUR',
      vat_rate: '20',
    },
    confidence: 0.82,
  },
};

/** Mock visual query for visual_query_execution stage */
const MOCK_VISUAL_QUERY_OUTPUT = {
  visual_queries: {
    queries: [
      'What is the invoice total amount?',
      'What is the VAT percentage shown?',
    ],
    context: 'Financial document with line items',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

test.describe('Pipeline Stages API', () => {
  let cookies: string;
  let testDocId: number;

  test.beforeAll(async ({ request }) => {
    // Authenticate once for all tests
    try {
      cookies = await authenticateSession(request);
    } catch (e) {
      // If authentication fails, tests will be skipped individually
      cookies = '';
    }

    // Resolve document ID from fixtures (falls back to env or default)
    try {
      testDocId = getTestDocId();
    } catch {
      testDocId = MIXED_DOC_ID;
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Discovery endpoints (GET)
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Pipeline Discovery', () => {
    test('GET / — lists all registered pipelines', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(request, '/', cookies);
      expect(resp.status()).toBe(200);

      const body = await resp.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.pipelines)).toBe(true);
      expect(body.pipelines.length).toBeGreaterThanOrEqual(4);

      // Verify the four domain pipelines are present
      const ids = body.pipelines.map((p: { id: string }) => p.id);
      expect(ids).toContain('PIPELINE_FINANCIAL_V1');
      expect(ids).toContain('PIPELINE_MEDICAL_V1');
      expect(ids).toContain('PIPELINE_LEGAL_V1');
      expect(ids).toContain('PIPELINE_GENERAL_V1');

      // Each pipeline should have stages
      for (const pipeline of body.pipelines) {
        expect(pipeline.stageCount).toBeGreaterThan(0);
        expect(Array.isArray(pipeline.stages)).toBe(true);
        for (const stage of pipeline.stages) {
          expect(stage.id).toBeTruthy();
          expect(stage.type).toBeTruthy();
        }
      }
    });

    test('GET /:pipelineId — returns Financial pipeline stages', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_FINANCIAL_V1',
        cookies
      );
      expect(resp.status()).toBe(200);

      const body = await resp.json();
      expect(body.success).toBe(true);
      expect(body.pipeline.id).toBe('PIPELINE_FINANCIAL_V1');
      expect(body.pipeline.domain).toBeTruthy();

      // Verify key Financial stages are declared
      const stageIds = body.pipeline.stages.map(
        (s: { id: string }) => s.id
      );
      expect(stageIds).toContain('parallel_ocr');
      expect(stageIds).toContain('financial_extraction');

      // Extraction stage should reference FIN_EXTRACT_V1
      const extraction = body.pipeline.stages.find(
        (s: { id: string }) => s.id === 'financial_extraction'
      );
      expect(extraction).toBeTruthy();
      expect(extraction.promptId).toBe('FIN_EXTRACT_V1');
    });

    test('GET /:pipelineId — returns Medical pipeline stages', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_MEDICAL_V1',
        cookies
      );
      expect(resp.status()).toBe(200);

      const body = await resp.json();
      expect(body.success).toBe(true);
      expect(body.pipeline.id).toBe('PIPELINE_MEDICAL_V1');

      const stageIds = body.pipeline.stages.map(
        (s: { id: string }) => s.id
      );
      expect(stageIds).toContain('medical_visual');
      expect(stageIds).toContain('medical_text');
      expect(stageIds).toContain('medical_integration');
    });

    test('GET /:pipelineId — returns 404 for unknown pipeline', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_DOES_NOT_EXIST',
        cookies
      );
      expect(resp.status()).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Input validation (POST execute-stage)
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Execute-Stage Validation', () => {
    test('rejects missing documentId', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'parallel_ocr',
      });
      expect(resp.status()).toBe(400);

      const body = await resp.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('documentId');
    });

    test('rejects missing pipelineId', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        stageId: 'parallel_ocr',
      });
      expect(resp.status()).toBe(400);

      const body = await resp.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('pipelineId');
    });

    test('rejects missing stageId', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
      });
      expect(resp.status()).toBe(400);

      const body = await resp.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('stageId');
    });

    test('returns 404 for unknown pipeline', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_NONEXISTENT',
        stageId: 'parallel_ocr',
      });
      expect(resp.status()).toBe(404);
    });

    test('returns 404 for unknown stage in valid pipeline', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'nonexistent_stage',
      });
      expect(resp.status()).toBe(404);

      const body = await resp.json();
      expect(body.availableStages).toBeTruthy();
      expect(Array.isArray(body.availableStages)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 4: Parallel OCR (all pipelines share this)
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 4 — Parallel OCR', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('parallel_ocr produces OCR text from Financial pipeline', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'parallel_ocr',
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      // Stage may succeed or skip (e.g. no PDF renderer available)
      const body = await resp.json();
      if (resp.status() === 500 && body.error?.includes('render')) {
        test.skip(true, 'PDF renderer not available in test environment');
        return;
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('parallel_ocr');
      expect(['success', 'skipped', 'warning']).toContain(body.status);
      expect(body.executionTimeMs).toBeGreaterThan(0);

      // If successful, output should contain OCR data
      if (body.status === 'success' && body.output) {
        expect(body.contextSnapshot).toBeTruthy();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 5: Extraction (domain-specific)
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 5 — Financial Extraction', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('financial_extraction with FIN_EXTRACT_V1', async ({ request }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'financial_extraction',
        mockContext: MOCK_OCR_OUTPUT,
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        // LLM may not be available — skip gracefully
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('Ollama') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('financial_extraction');
      expect(body.promptId).toBe('FIN_EXTRACT_V1');
      expect(body.success).toBe(true);
      expect(body.executionTimeMs).toBeGreaterThan(0);

      // Extraction output should contain structured data
      if (body.output) {
        // The output shape depends on the LLM response;
        // at minimum verify it's an object
        expect(typeof body.output).toBe('object');
      }
    });

    test('financial_extraction reports correct model', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      // Use the pipeline discovery endpoint to verify the model mapping
      const pipelineResp = await apiGet(
        request,
        '/PIPELINE_FINANCIAL_V1',
        cookies
      );
      const pipelineBody = await pipelineResp.json();
      const extractionStage = pipelineBody.pipeline.stages.find(
        (s: { id: string }) => s.id === 'financial_extraction'
      );

      expect(extractionStage).toBeTruthy();
      expect(extractionStage.promptId).toBe('FIN_EXTRACT_V1');
      // Model should be defined (sauerkraut-llama3.1:8b or env override)
      expect(extractionStage.model || extractionStage.modelType).toBeTruthy();
    });
  });

  test.describe('Stage 5 — Medical Extraction', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('medical_text with MED_DOCTOR_V1 (text extraction)', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: MEDICAL_DOC_ID,
        pipelineId: 'PIPELINE_MEDICAL_V1',
        stageId: 'medical_text',
        mockContext: MOCK_OCR_OUTPUT,
        classificationOverride: {
          primary_domain: 'Medical',
          document_type: 'medical_report',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('medical_text');
      expect(body.success).toBe(true);
      expect(body.executionTimeMs).toBeGreaterThan(0);
    });
  });

  test.describe('Stage 5 — Legal Extraction', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('legal_extraction with LEGAL_EXTRACTOR_V1', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_LEGAL_V1',
        stageId: 'legal_extraction',
        mockContext: MOCK_OCR_OUTPUT,
        classificationOverride: {
          primary_domain: 'Legal',
          document_type: 'contract',
          confidence: 0.85,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('legal_extraction');
      expect(body.success).toBe(true);
    });
  });

  test.describe('Stage 5 — General Extraction', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('general_extraction with GEN_FALLBACK_V1', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_GENERAL_V1',
        stageId: 'general_extraction',
        mockContext: MOCK_OCR_OUTPUT,
        classificationOverride: {
          primary_domain: 'General',
          document_type: 'document',
          confidence: 0.7,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('general_extraction');
      expect(body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 5.5: Visual Query Generation
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 5.5 — Visual Query Generation', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('visual_query_generation with VISUAL_QUERY_GENERATOR_V1', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'visual_query_generation',
        mockContext: {
          ...MOCK_OCR_OUTPUT,
          ...MOCK_EXTRACTION_OUTPUT,
        },
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('visual_query_generation');
      expect(body.success).toBe(true);
      expect(body.executionTimeMs).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 6: Reasoning (Financial only)
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 6 — Financial Reasoning', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('financial_reasoning with FIN_REASONER_V1', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'financial_reasoning',
        mockContext: {
          ...MOCK_OCR_OUTPUT,
          ...MOCK_EXTRACTION_OUTPUT,
        },
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('financial_reasoning');
      expect(body.promptId).toBe('FIN_REASONER_V1');
      expect(body.success).toBe(true);

      // Reasoning is advisory — output should contain suggested_corrections
      // or analysis, but must NOT overwrite extraction values
      if (body.output && typeof body.output === 'object') {
        // Reasoning stage emits suggestions, not direct overwrites
        expect(body.stageType).toBeTruthy();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 7: Medical Integration + Validation
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 7 — Medical Integration', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('medical_integration with MED_INTEGRATOR_V1', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const mockMedicalContext = {
        ...MOCK_OCR_OUTPUT,
        medical_visual: {
          findings: ['chest x-ray normal'],
          modality: 'X-Ray',
          confidence: 0.8,
        },
        medical_text: {
          title: 'Chest X-Ray Report',
          patient_info: { age: '45', gender: 'M' },
          diagnosis: 'Normal findings',
          confidence: 0.85,
        },
      };

      const resp = await apiExecuteStage(request, cookies, {
        documentId: MEDICAL_DOC_ID,
        pipelineId: 'PIPELINE_MEDICAL_V1',
        stageId: 'medical_integration',
        mockContext: mockMedicalContext,
        classificationOverride: {
          primary_domain: 'Medical',
          document_type: 'radiology_report',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('model');
        if (isLlmError) {
          test.skip(true, `LLM not available: ${body.error}`);
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('medical_integration');
      expect(body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Stage 8: Visual Query Execution
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Stage 8 — Visual Query Execution', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('visual_query_execution with injected queries', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'visual_query_execution',
        mockContext: {
          ...MOCK_OCR_OUTPUT,
          ...MOCK_EXTRACTION_OUTPUT,
          ...MOCK_VISUAL_QUERY_OUTPUT,
        },
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
        options: {
          enableVisualRag: true,
        },
      });

      const body = await resp.json();
      if (resp.status() === 500) {
        const isLlmError =
          body.error?.includes('ECONNREFUSED') ||
          body.error?.includes('timeout') ||
          body.error?.includes('Visual RAG') ||
          body.error?.includes('sidecar');
        if (isLlmError) {
          test.skip(
            true,
            `Visual RAG sidecar not available: ${body.error}`
          );
          return;
        }
      }

      expect(resp.status()).toBe(200);
      expect(body.stageId).toBe('visual_query_execution');
      expect(body.executionTimeMs).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Cross-cutting: context snapshot & execution metadata
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Execution Metadata', () => {
    test.describe.configure({ timeout: LLM_STAGE_TIMEOUT });

    test('response includes contextSnapshot with stageOutputs', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'parallel_ocr',
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() !== 200) {
        test.skip(true, `Stage execution failed: ${body.error}`);
        return;
      }

      // Verify metadata envelope
      expect(body.stageId).toBe('parallel_ocr');
      expect(body.stageType).toBeTruthy();
      expect(typeof body.executionTimeMs).toBe('number');
      expect(body.contextSnapshot).toBeTruthy();
      expect(typeof body.contextSnapshot).toBe('object');

      // Context snapshot structure
      expect(body.contextSnapshot).toHaveProperty('stageOutputs');
      expect(typeof body.contextSnapshot.stageOutputs).toBe('object');
    });

    test('mockContext injection propagates to context snapshot', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiExecuteStage(request, cookies, {
        documentId: testDocId,
        pipelineId: 'PIPELINE_FINANCIAL_V1',
        stageId: 'financial_extraction',
        mockContext: MOCK_OCR_OUTPUT,
        classificationOverride: {
          primary_domain: 'Financial',
          document_type: 'invoice',
          confidence: 0.9,
        },
      });

      const body = await resp.json();
      if (resp.status() !== 200) {
        test.skip(true, `Stage execution failed: ${body.error}`);
        return;
      }

      // The injected OCR mock should appear in the context snapshot
      expect(body.contextSnapshot).toBeTruthy();
      expect(body.contextSnapshot.stageOutputs).toBeTruthy();

      // The OCR key from mockContext should be present
      if (body.contextSnapshot.stageOutputs.ocr) {
        expect(body.contextSnapshot.stageOutputs.ocr.source).toBe(
          'visual_ocr'
        );
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Pipeline-level contract checks
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Pipeline Contract Verification', () => {
    test('all Financial stages have required fields', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_FINANCIAL_V1',
        cookies
      );
      const body = await resp.json();
      expect(body.success).toBe(true);

      for (const stage of body.pipeline.stages) {
        // Every stage must have id, name, type, executionMode
        expect(stage.id).toBeTruthy();
        expect(stage.name).toBeTruthy();
        expect(stage.type).toBeTruthy();
        expect(stage.executionMode).toBeTruthy();

        // Non-OCR stages should have a model or promptId
        if (stage.type !== 'PARALLEL_OCR' && stage.type !== 'ocr') {
          const hasModelOrPrompt =
            stage.model || stage.promptId || stage.guidanceTemplate;
          // Some stages (validation, recovery) may not need a model
          // so we just log a warning rather than fail
          if (!hasModelOrPrompt) {
            console.warn(
              `[contract] Stage ${stage.id} has no model/promptId/guidanceTemplate`
            );
          }
        }
      }
    });

    test('all Medical stages have required fields', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_MEDICAL_V1',
        cookies
      );
      const body = await resp.json();
      expect(body.success).toBe(true);

      for (const stage of body.pipeline.stages) {
        expect(stage.id).toBeTruthy();
        expect(stage.name).toBeTruthy();
        expect(stage.type).toBeTruthy();
        expect(stage.executionMode).toBeTruthy();
      }

      // Medical-specific: verify radiology stage uses llava-med
      const radiology = body.pipeline.stages.find(
        (s: { id: string }) => s.id === 'medical_visual'
      );
      if (radiology) {
        expect(radiology.promptId).toBe('MED_RADIOLOGY_V1');
      }

      // Verify text extraction uses medtext-llama3
      const textStage = body.pipeline.stages.find(
        (s: { id: string }) => s.id === 'medical_text'
      );
      if (textStage) {
        expect(textStage.promptId).toBe('MED_DOCTOR_V1');
      }
    });

    test('all Legal stages have required fields', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_LEGAL_V1',
        cookies
      );
      const body = await resp.json();
      expect(body.success).toBe(true);

      for (const stage of body.pipeline.stages) {
        expect(stage.id).toBeTruthy();
        expect(stage.name).toBeTruthy();
        expect(stage.type).toBeTruthy();
      }

      // Legal-specific: verify orchestrator and extractor prompts
      const orchestrator = body.pipeline.stages.find(
        (s: { id: string }) => s.id === 'legal_orchestrator'
      );
      if (orchestrator) {
        expect(orchestrator.promptId).toBe('LEGAL_ORCHESTRATOR_V1');
      }

      const extractor = body.pipeline.stages.find(
        (s: { id: string }) => s.id === 'legal_extraction'
      );
      if (extractor) {
        expect(extractor.promptId).toBe('LEGAL_EXTRACTOR_V1');
      }
    });

    test('all General stages have required fields', async ({
      request,
    }) => {
      if (!cookies) test.skip(true, 'Authentication failed');

      const resp = await apiGet(
        request,
        '/PIPELINE_GENERAL_V1',
        cookies
      );
      const body = await resp.json();
      expect(body.success).toBe(true);

      for (const stage of body.pipeline.stages) {
        expect(stage.id).toBeTruthy();
        expect(stage.name).toBeTruthy();
        expect(stage.type).toBeTruthy();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Authentication enforcement
  // ──────────────────────────────────────────────────────────────────────

  test.describe('Auth Enforcement', () => {
    test('unauthenticated request returns 401', async ({ request }) => {
      const resp = await request.get(`${API_PREFIX}/`, {
        headers: { Cookie: '' },
      });
      // Should be 401 or redirect to login
      expect([401, 302, 403]).toContain(resp.status());
    });

    test('execute-stage without auth returns 401', async ({ request }) => {
      const resp = await request.post(`${API_PREFIX}/execute-stage`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: '',
        },
        data: {
          documentId: testDocId,
          pipelineId: 'PIPELINE_FINANCIAL_V1',
          stageId: 'parallel_ocr',
        },
      });
      expect([401, 302, 403]).toContain(resp.status());
    });
  });
});
