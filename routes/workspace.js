const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const paperlessService = require('../services/paperlessService.js');
const documentModel = require('../services/documentModel.js');
const configFile = require('../config/config.js');
const { UnifiedWorkspaceSchema } = require('../src/ui/contracts/UnifiedWorkspace.contract.js');
const {
  buildPaperlessProxyUrl,
  buildPaperlessProxyPreviewUrl
} = require('../services/utils/paperlessUrl');
const { authenticate } = require('../middleware/auth');
const { fieldMappingService } = require('../services/experts/FieldMappingService');
const { domainResolver } = require('../services/visual-rag-client/DomainResolver');
const { normalizeOverlayBoundingBox } = require('../services/visual-rag-client/overlayCoordinates');
const { isSupportedImageMimeType } = require('../services/visual-rag-client/PDFRenderer');
const modelResolutionService = require('../services/ModelResolutionService');

// All workspace routes require authentication
router.use(authenticate);

// Visual RAG integration
let visualOverlayRepository = null;
try {
    const visualRagClient = require('../services/visual-rag-client');
    visualOverlayRepository = visualRagClient.visualOverlayRepository;
} catch (e) {
    console.warn('[Unified Workspace] Visual RAG client not available:', e.message);
}

async function buildChatModelConfig(options = {}) {
  const resolver = options.resolver || modelResolutionService;
  const runtimeConfig = options.runtimeConfig || configFile;
  const env = options.env || process.env;
  const allowedProviders = ['ollama', 'openai', 'azure', 'custom'];

  const currentProvider = String(
    runtimeConfig.aiProvider || env.AI_PROVIDER || 'ollama'
  ).toLowerCase();

  const normalizeModels = (models) => Array.from(
    new Set(
      (Array.isArray(models) ? models : [])
        .map((modelName) => String(modelName || '').trim())
        .filter(Boolean)
    )
  );

  let providers = Object.fromEntries(
    allowedProviders.map((providerName) => [providerName, []])
  );
  try {
    const discoveredProviders = await resolver.getAllModels();
    if (discoveredProviders && typeof discoveredProviders === 'object') {
      Object.entries(discoveredProviders).forEach(([name, models]) => {
        const providerName = String(name || '').toLowerCase().trim();
        if (!providerName) return;
        if (!providers[providerName]) {
          providers[providerName] = [];
        }
        providers[providerName] = normalizeModels(models);
      });
    }
  } catch (error) {
    console.warn(
      '[Unified Workspace] Could not resolve provider models:',
      error.message
    );
  }

  // Ensure the current provider key always exists for deterministic UI logic.
  if (!providers[currentProvider]) {
    providers[currentProvider] = [];
  }

  const discoveredDefaults = {
    ollama: String(
      runtimeConfig?.ollama?.model || env.OLLAMA_MODEL || ''
    ).trim(),
    openai: String(
      env.PAPERLESS_OPENAI_MODEL ||
      env.OPENAI_MODEL ||
      runtimeConfig?.openai?.model ||
      ''
    ).trim(),
    azure: String(
      runtimeConfig?.azure?.deploymentName ||
      env.AZURE_DEPLOYMENT_NAME ||
      ''
    ).trim(),
    custom: String(
      runtimeConfig?.custom?.model || env.CUSTOM_MODEL || ''
    ).trim(),
  };

  const defaultModels = {};
  Object.keys(providers).forEach((providerName) => {
    const current = normalizeModels(providers[providerName]);
    const discoveredDefault = String(
      discoveredDefaults[providerName] || ''
    ).trim();

    if (current.length === 0 && discoveredDefault) {
      current.push(discoveredDefault);
    }

    providers[providerName] = current;
    defaultModels[providerName] = discoveredDefault &&
      current.includes(discoveredDefault)
      ? discoveredDefault
      : (current[0] || '');
  });

  let expertModels = [];
  if (currentProvider === 'ollama') {
    try {
      const rawExperts = resolver.getExpertModels();
      if (Array.isArray(rawExperts)) {
        const seen = new Set();
        expertModels = rawExperts
          .map((entry) => {
            if (!entry || !entry.model) return null;
            const model = String(entry.model).trim();
            if (!model || seen.has(model)) return null;
            seen.add(model);
            const labelParts = [entry.category, entry.role]
              .filter(Boolean)
              .map((part) => String(part));
            return {
              model,
              label: labelParts.length ? labelParts.join(' · ') : model,
              category: entry.category || undefined
            };
          })
          .filter(Boolean);
      }
    } catch (error) {
      console.warn(
        '[Unified Workspace] Could not resolve expert models:',
        error.message
      );
    }
  }

  return {
    providers,
    expertModels,
    currentProvider,
    defaultModels
  };
}

const WORKSPACE_SHARED_CACHE_TTL_MS = Number.parseInt(
  process.env.WORKSPACE_SHARED_CACHE_TTL_MS || '',
  10
) || 5000;
const workspaceSharedCache = new Map();

function getWorkspaceCachedValue(key, loader, ttlMs = WORKSPACE_SHARED_CACHE_TTL_MS) {
  const cacheKey = String(key || '').trim();
  if (!cacheKey) {
    return Promise.resolve().then(loader);
  }

  const now = Date.now();
  const cached = workspaceSharedCache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > now) {
      if (cached.hasValue) return Promise.resolve(cached.value);
      if (cached.promise) return cached.promise;
    }

    if (cached.hasValue) {
      // Serve stale data immediately and refresh in background to avoid
      // blocking high-concurrency workspace routes on Paperless timeouts.
      if (!cached.promise) {
        const refreshPromise = Promise.resolve()
          .then(loader)
          .then((value) => {
            workspaceSharedCache.set(cacheKey, {
              hasValue: true,
              value,
              expiresAt: Date.now() + ttlMs
            });
            return value;
          })
          .catch((error) => {
            console.warn(
              `[Unified Workspace] Background refresh failed for ${cacheKey}:`,
              error && error.message ? error.message : error
            );
            workspaceSharedCache.set(cacheKey, {
              hasValue: true,
              value: cached.value,
              expiresAt: Date.now() + Math.max(1000, Math.floor(ttlMs / 2))
            });
            return cached.value;
          })
          .finally(() => {
            const latest = workspaceSharedCache.get(cacheKey);
            if (latest && latest.promise === refreshPromise) {
              workspaceSharedCache.set(cacheKey, {
                hasValue: true,
                value: latest.value,
                expiresAt: latest.expiresAt
              });
            }
          });

        workspaceSharedCache.set(cacheKey, {
          hasValue: true,
          value: cached.value,
          promise: refreshPromise,
          expiresAt: now + ttlMs
        });
      }
      return Promise.resolve(cached.value);
    }

    if (cached.promise) return cached.promise;
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      workspaceSharedCache.set(cacheKey, {
        hasValue: true,
        value,
        expiresAt: Date.now() + ttlMs
      });
      return value;
    })
    .catch((error) => {
      workspaceSharedCache.delete(cacheKey);
      throw error;
    });

  workspaceSharedCache.set(cacheKey, {
    hasValue: false,
    promise,
    expiresAt: now + ttlMs
  });
  return promise;
}

function withWorkspaceTimeout(promise, timeoutMs, fallbackValue, label) {
  let timer = null;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(
        `[Unified Workspace] Timed out waiting for ${label} after ${timeoutMs}ms`
      );
      resolve(fallbackValue);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .catch((error) => {
      console.warn(
        `[Unified Workspace] Failed to load ${label}:`,
        error && error.message ? error.message : error
      );
      return fallbackValue;
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

function normalizeWorkspaceDate(rawDate) {
  if (!rawDate) return '';
  const raw = String(rawDate).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s].*$/);
  if (isoMatch) return isoMatch[1];
  const parts = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]);
    let year = Number(parts[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

function asNonEmptyString(value) {
  if (value === undefined || value === null) return '';
  const normalized = String(value).trim();
  return normalized;
}

function toDeterministicFieldToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function buildDeterministicFieldId(field, prefix) {
  const explicitFieldId = asNonEmptyString(field.fieldId);
  if (explicitFieldId) return explicitFieldId;

  const paperlessToken = toDeterministicFieldToken(
    asNonEmptyString(field.paperlessField)
  );
  if (paperlessToken) return paperlessToken;

  const labelToken = toDeterministicFieldToken(
    asNonEmptyString(field.displayName?.en) ||
    asNonEmptyString(field.displayName?.de) ||
    asNonEmptyString(field.label)
  );
  if (labelToken) return `${prefix}_${labelToken}`;

  const stableSeed = JSON.stringify({
    fieldId: asNonEmptyString(field.fieldId),
    paperlessField: asNonEmptyString(field.paperlessField),
    displayName: {
      en: asNonEmptyString(field.displayName?.en),
      de: asNonEmptyString(field.displayName?.de)
    },
    label: asNonEmptyString(field.label),
    type: asNonEmptyString(field.type),
    enum: Array.isArray(field.enum) ? field.enum : []
  });
  const shortHash = crypto
    .createHash('sha1')
    .update(stableSeed)
    .digest('hex')
    .slice(0, 12);
  return `${prefix}_${shortHash}`;
}

function mapDomainFieldToWorkspaceField(field, isMandatory) {
  const safeField = field && typeof field === 'object' ? field : {};
  const fieldId = buildDeterministicFieldId(
    safeField,
    isMandatory ? 'required_field' : 'optional_field'
  );
  return {
    fieldId,
    label: safeField.displayName?.en || fieldId,
    paperlessField: safeField.paperlessField || null,
    type: safeField.type,
    enum: Array.isArray(safeField.enum) ? safeField.enum : undefined,
    validationRules: safeField.validationRules || {},
    isMandatory
  };
}

function normalizeCustomFieldsForWorkspace(rawCustomFields) {
  if (Array.isArray(rawCustomFields)) {
    return rawCustomFields
      .filter(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry)
      )
      .map((entry) => {
        const normalized = { ...entry };
        if (normalized.name !== undefined && normalized.name !== null) {
          normalized.name = String(normalized.name);
        }
        if (
          normalized.field_name !== undefined &&
          normalized.field_name !== null
        ) {
          normalized.field_name = String(normalized.field_name);
        }
        return normalized;
      });
  }

  if (rawCustomFields && typeof rawCustomFields === 'object') {
    return Object.entries(rawCustomFields)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => ({
        name,
        field_name: name,
        value
      }));
  }

  return [];
}

function resolveCustomFieldValue(customFields, customFieldDefs, name) {
  const normalizedName = asNonEmptyString(name).toLowerCase();
  if (!normalizedName) return null;

  const fieldByName = customFields.find((field) => {
    const candidateName = asNonEmptyString(
      field.name || field.field_name
    ).toLowerCase();
    return candidateName === normalizedName;
  });
  if (fieldByName) {
    return fieldByName.value ?? null;
  }

  if (!Array.isArray(customFieldDefs)) return null;
  const definition = customFieldDefs.find(
    (field) =>
      asNonEmptyString(field.name).toLowerCase() === normalizedName
  );
  if (!definition) return null;

  const fieldById = customFields.find(
    (field) => Number(field.field) === Number(definition.id)
  );
  return fieldById?.value ?? null;
}

/**
 * @swagger
 * /workspace/doc/{id}:
 *   get:
 *     summary: Unified Document Workspace
 *     description: |
 *       Renders the unified workspace for a specific document.
 *       Consolidates metadata editing, AI chat, and visual RAG capabilities.
 *     tags:
 *       - Navigation
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Unified Workspace rendered successfully
 */
router.get('/doc/:id', async (req, res) => {
  try {
    const username = req.user.username;
    
    // Support ?tab= query parameter for deep-linking to specific tabs
    const validTabs = ['metadata', 'content', 'chat', 'visual', 'debug'];
    const requestedTab = req.query.tab;
    const activeTab = validTabs.includes(requestedTab) ? requestedTab : 'metadata';

    // Handle "latest" as a special case - redirect to most recent document
    if (req.params.id === 'latest') {
      const history = await documentModel.getAllHistory(username);
      if (history && history.length > 0) {
        return res.redirect(`/workspace/doc/${history[0].document_id}`);
      }
      // Fallback to first document from Paperless
      const allDocs = await getWorkspaceCachedValue(
        'paperless:documents:all',
        () => paperlessService.getAllDocumentsUnfiltered(),
        3000
      );
      if (allDocs && allDocs.length > 0) {
        return res.redirect(`/workspace/doc/${allDocs[0].id}`);
      }
      return res.status(404).render('error', {
        message: 'No documents available',
        details: 'There are no documents to display.'
      });
    }

    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).render('error', {
        message: 'Invalid document ID',
        details: 'The document ID must be a number.'
      });
    }

    // 1. Fetch document from Paperless
    let document = null;
    try {
      document = await paperlessService.getDocument(documentId);
    } catch (e) {
      console.error(`[ERROR] Document ${documentId} not found in Paperless:`, e.message);
      return res.status(404).render('error', { 
        message: 'Document not found', 
        details: 'The requested document could not be retrieved from Paperless.' 
      });
    }

    // 2. Enforce User Isolation
    // Check if the document has history for this user or if it's a new document
    // If strict isolation is enabled, we should verify the user has access.
    // For now, we follow the mandate: "Database queries for document history/processing MUST filter by username"
    const _history = await documentModel.getHistory(documentId, username);
    
    // Note: If history is null, it might be a document that hasn't been processed by AI yet.
    // In a strict multi-tenant system, we'd check Paperless-ngx permissions here.

    // 3. Fetch content + supplementary data in parallel with bounded wait times
    const [
      content,
      availableDocs,
      allTags,
      correspondents,
      docTypes,
      customFieldDefs,
      chatModelConfig
    ] = await Promise.all([
      withWorkspaceTimeout(
        paperlessService.getDocumentContent(documentId),
        5000,
        '',
        'document content'
      ),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'paperless:documents:all',
          () => paperlessService.getAllDocumentsUnfiltered(),
          3000
        ),
        6000,
        [],
        'available documents'
      ),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'paperless:tags',
          () => paperlessService.getTags(),
          3000
        ),
        5000,
        [],
        'tags'
      ),
      document.correspondent
        ? withWorkspaceTimeout(
            getWorkspaceCachedValue(
              'paperless:correspondents',
              () => paperlessService.listCorrespondentsNames(),
              5000
            ),
            5000,
            [],
            'correspondents'
          )
        : Promise.resolve([]),
      document.document_type
        ? withWorkspaceTimeout(
            getWorkspaceCachedValue(
              'paperless:document-types',
              () => paperlessService.listDocumentTypesNames(),
              5000
            ),
            5000,
            [],
            'document types'
          )
        : Promise.resolve([]),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'paperless:custom-fields',
          () => paperlessService.listCustomFields(),
          5000
        ),
        5000,
        [],
        'custom field definitions'
      ),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'workspace:chat-model-config',
          () => buildChatModelConfig(),
          3000
        ),
        5000,
        {
          providers: { ollama: [], openai: [], azure: [], custom: [] },
          expertModels: [],
          currentProvider: String(
            configFile.aiProvider || process.env.AI_PROVIDER || 'ollama'
          ).toLowerCase(),
          defaultModels: {}
        },
        'chat model config'
      )
    ]);

    // 4. Resolve correspondent name
    let correspondentName = null;
    if (document.correspondent && Array.isArray(correspondents)) {
      const correspondent = correspondents.find(
        (c) => c.id === document.correspondent
      );
      correspondentName = correspondent?.name || null;
    }

    // 5. Resolve document type name
    let documentTypeName = null;
    if (document.document_type && Array.isArray(docTypes)) {
      const docType = docTypes.find((dt) => dt.id === document.document_type);
      documentTypeName = docType?.name || null;
    }

    // 6. Resolve tags (names + IDs + available list)
    let tagNames = [];
    let tagItems = [];
    let availableTags = [];
    try {
      availableTags = allTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || tag.colour || null,
        document_count: typeof tag.document_count === 'number' ? tag.document_count : 0
      }));
      if (document.tags && document.tags.length > 0) {
        tagItems = document.tags
          .map(tagId => {
            const tag = allTags.find(t => t.id === tagId);
            if (!tag) return null;
            return {
              id: tag.id,
              name: tag.name,
              color: tag.color || tag.colour || null
            };
          })
          .filter(tag => tag !== null);
        tagNames = tagItems.map(tag => tag.name);
      }
    } catch (e) {
      console.warn('[Unified Workspace] Could not resolve tag names:', e.message);
    }

    // 6.5 Resolve document domain + field profile for UI
    let documentDomain = 'general';
    try {
      documentDomain = await domainResolver.resolveDomain(documentId, {
        documentType: documentTypeName,
        tags: tagNames,
        content
      });
    } catch (e) {
      console.warn('[Unified Workspace] Domain resolution failed:', e.message);
    }

    const domainMapping = fieldMappingService.domainMappings?.[documentDomain] || {};
    const fieldProfile = {
      domain: documentDomain,
      displayName: domainMapping.displayName?.en || `${documentDomain} document`,
      icon: domainMapping.icon || '📄',
      requiredFields: fieldMappingService
        .getRequiredFields(documentDomain)
        .map((field) => mapDomainFieldToWorkspaceField(field, true)),
      optionalFields: fieldMappingService
        .getOptionalFields(documentDomain)
        .map((field) => mapDomainFieldToWorkspaceField(field, false))
    };

    // 7. Visual RAG Data
    let visualFields = [];
    let formattedOverlays = [];
    let overlayCount = 0;
    let visOcrPages = [];
    let visOcrSource = null;
    let visOcrQuality = null;
    if (visualOverlayRepository) {
      try {
        const overlays = await visualOverlayRepository.getByDocId(documentId);
        overlayCount = overlays.length;
        visualFields = overlays.map(o => {
          const data = o.overlayData || {};
          const bbox = normalizeOverlayBoundingBox(data) || {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          };
          return {
            id: String(o.id),
            overlayId: String(o.id),
            label: data.label || o.semanticLabel || 'Unknown',
            value: data.value || data.text || null,
            domain: data.domain || 'GENERAL',
            confidence: data.confidence || o.confidence || 0.5,
            paperlessMapping: data.paperlessMapping || null,
            paperlessField: data.paperlessField || data.paperlessMapping || null,
            mappingConfidence: data.mappingConfidence ?? null,
            matchType: data.matchType || null,
            isMandatory: data.isMandatory || false,
            pageNumber: o.pageNumber || 1,
            bbox
          };
        });
        // Format overlays for Visual Tab (with bbox)
        formattedOverlays = overlays.map(o => {
          const data = o.overlayData || {};
          const bbox = normalizeOverlayBoundingBox(data) || {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          };
          return {
            id: String(o.id),
            overlayId: String(o.id),
            label: data.label || o.semanticLabel || 'Unknown',
            pageNumber: o.pageNumber || data.pageNumber || 1,
            confidence: data.confidence || o.confidence || 0.5,
            bbox,
            paperlessMapping: data.paperlessMapping || null,
            paperlessField: data.paperlessField || data.paperlessMapping || null
          };
        });

        const expertKnowledge = await visualOverlayRepository
          .getExpertKnowledge(documentId);
        const expertMetadata = expertKnowledge?.expertMetadata || {};
        if (Array.isArray(expertMetadata.vis_ocr_pages)) {
          visOcrPages = expertMetadata.vis_ocr_pages
            .filter((page) => page && typeof page === 'object')
            .map((page) => ({
              pageNumber: Number(page.pageNumber) || 0,
              text: typeof page.text === 'string' ? page.text : '',
              success: page.success !== false
            }))
            .filter((page) => page.pageNumber > 0);
        }
        visOcrSource = expertMetadata.vis_ocr_source || null;
        visOcrQuality = Number.isFinite(expertMetadata.vis_ocr_quality)
          ? expertMetadata.vis_ocr_quality
          : null;
      } catch (e) {
        console.warn('[Unified Workspace] Could not fetch visual overlays:', e.message);
      }
    }

    // Extract saved rotation from visual settings
    let savedRotation = 0;
    try {
      if (visualOverlayRepository) {
        const knowledge = await visualOverlayRepository.getExpertKnowledge(documentId);
        const settings = knowledge?.expertMetadata?.visual_settings || {};
        savedRotation = Number.isFinite(settings.rotation) ? settings.rotation : 0;
      }
    } catch (e) {
      console.warn('[Unified Workspace] Could not fetch visual settings:', e.message);
    }

    // Build VM
    const normalizedCustomFields = normalizeCustomFieldsForWorkspace(
      document.custom_fields
    );
    const getCustomField = (name) =>
      resolveCustomFieldValue(normalizedCustomFields, customFieldDefs, name);

    const persistedNormalizedUrl = getCustomField('ai_normalized_url');
    const normalizationStatus = getCustomField('ai_normalization_status') || 'pending';

    // Determine if document is visual (supported image or PDF) for preview fallback
    const isVisual = isSupportedImageMimeType(document.mime_type) || 
                    String(document.mime_type).toLowerCase() === 'application/pdf';

    const vm = {
      version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
      config: {
        disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no',
      },
      document: {
        id: document.id,
        title: document.title,
        content: content,
        correspondent: correspondentName,
        correspondentId: document.correspondent || null,
        createdDate: normalizeWorkspaceDate(
          document.created || document.created_date || document.createdDate
        ),
        documentType: documentTypeName,
        documentTypeId: document.document_type || null,
        documentDomain: documentDomain,
        fieldProfile: fieldProfile,
        tags: tagNames,
        tagItems: tagItems,
        availableTags: availableTags,
        pageCount: document.page_count || 1,
        currentPage: 1,
        mimeType: document.mime_type,
        originalUrl: buildPaperlessProxyUrl(
          document.id,
          '/download/original/'
        ),
        // Use thumbnail as fallback for non-visual documents (ticket:009.1)
        previewUrl: isVisual 
          ? buildPaperlessProxyPreviewUrl(document.id)
          : buildPaperlessProxyUrl(document.id, '/thumb/'),
        persistedNormalizedUrl: persistedNormalizedUrl,
        normalizationStatus: normalizationStatus,
        normalizedUrl: persistedNormalizedUrl || `/api/normalized/${document.id}/1`,
        customFields: normalizedCustomFields,
        visOcrPages,
        visOcrSource,
        visOcrQuality,
        ocrContent: (content || '').substring(0, 600),
        status: 'saved',
      },
      availableDocuments: availableDocs.map(d => ({
        id: d.id,
        title: d.title,
        original_filename: d.original_file_name
      })),
      chat: {
        aiProvider: process.env.AI_PROVIDER || 'ollama',
        ollamaDefaultModel: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
        modelConfig: chatModelConfig,
      },
      visual: {
        fields: visualFields,
        overlays: formattedOverlays,
        overlayCount: overlayCount,
        rotation: savedRotation
      },
      ui: {
        activeTab: activeTab,
        sidebarCollapsed: false,
      },
      user: {
        username: req.user?.username || 'anonymous',
        isAdmin: req.user?.isAdmin || req.user?.is_superuser || false,
      },
    };

    // 9. Validate and Render
    const parsedVm = UnifiedWorkspaceSchema.parse(vm);
    res.render('document-workspace', { vm: parsedVm });

  } catch (error) {
    console.error('[ERROR] Unified Workspace route failed:', error);
    res.status(500).render('error', { 
      message: 'Internal Server Error', 
      details: error.message 
    });
  }
});

/**
 * Backward-compatible redirect: /workspace/latest -> /workspace/doc/latest
 */
router.get('/latest', (req, res) => {
  res.redirect(302, '/workspace/doc/latest');
});

/**
 * Backward-compatible redirect: /workspace/{numericId} -> /workspace/doc/{id}
 * This catches old URLs like /workspace/9 and redirects to /workspace/doc/9
 */
router.get('/:id(\\d+)', (req, res) => {
  res.redirect(302, `/workspace/doc/${req.params.id}`);
});

/**
 * @swagger
 * /api/workspace/doc/{id}:
 *   get:
 *     summary: Get document data for inline workspace loading
 *     description: Returns document metadata in JSON format for client-side document switching
 *     tags:
 *       - API
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Document data returned successfully
 */
router.get('/api/doc/:id', async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Fetch document from Paperless
    let document = null;
    try {
      document = await paperlessService.getDocument(documentId);
    } catch (e) {
      console.error(`[API] Document ${documentId} not found:`, e.message);
      return res.status(404).json({ error: 'Document not found' });
    }

    const [
      correspondents,
      docTypes,
      allTags,
      customFieldDefs,
      content
    ] = await Promise.all([
      document.correspondent
        ? withWorkspaceTimeout(
            getWorkspaceCachedValue(
              'paperless:correspondents',
              () => paperlessService.listCorrespondentsNames(),
              5000
            ),
            5000,
            [],
            'api/doc correspondents'
          )
        : Promise.resolve([]),
      document.document_type
        ? withWorkspaceTimeout(
            getWorkspaceCachedValue(
              'paperless:document-types',
              () => paperlessService.listDocumentTypesNames(),
              5000
            ),
            5000,
            [],
            'api/doc document types'
          )
        : Promise.resolve([]),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'paperless:tags',
          () => paperlessService.getTags(),
          3000
        ),
        5000,
        [],
        'api/doc tags'
      ),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          'paperless:custom-fields',
          () => paperlessService.listCustomFields(),
          5000
        ),
        5000,
        [],
        'api/doc custom field definitions'
      ),
      withWorkspaceTimeout(
        getWorkspaceCachedValue(
          `paperless:doc-content:${documentId}`,
          () => paperlessService.getDocumentContent(documentId),
          3000
        ),
        5000,
        '',
        'api/doc content'
      )
    ]);

    // Resolve correspondent name
    let correspondentName = null;
    if (document.correspondent && Array.isArray(correspondents)) {
      const correspondent = correspondents.find(
        (c) => c.id === document.correspondent
      );
      correspondentName = correspondent?.name || null;
    }

    // Resolve document type name
    let documentTypeName = null;
    if (document.document_type && Array.isArray(docTypes)) {
      const docType = docTypes.find((dt) => dt.id === document.document_type);
      documentTypeName = docType?.name || null;
    }

    // Resolve tags (names + IDs + available list)
    let tagNames = [];
    let tagItems = [];
    let availableTags = [];
    try {
      availableTags = allTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || tag.colour || null,
        document_count: typeof tag.document_count === 'number' ? tag.document_count : 0
      }));
      if (document.tags && document.tags.length > 0) {
        tagItems = document.tags
          .map(tagId => {
            const tag = allTags.find(t => t.id === tagId);
            if (!tag) return null;
            return {
              id: tag.id,
              name: tag.name,
              color: tag.color || tag.colour || null
            };
          })
          .filter(tag => tag !== null);
        tagNames = tagItems.map(tag => tag.name);
      }
    } catch (e) { /* ignore */ }

    // Resolve custom fields to canonical workspace shape and flat lookups
    const normalizedCustomFields = normalizeCustomFieldsForWorkspace(
      document.custom_fields
    );
    const getCustomField = (name) =>
      resolveCustomFieldValue(normalizedCustomFields, customFieldDefs, name);

    const persistedNormalizedUrl = getCustomField('ai_normalized_url');
    const normalizationStatus = getCustomField('ai_normalization_status') || 'pending';

    // Determine if document is visual (supported image or PDF) for preview fallback
    const isVisual = isSupportedImageMimeType(document.mime_type) || 
                    String(document.mime_type).toLowerCase() === 'application/pdf';

    let documentDomain = 'general';
    try {
      documentDomain = await domainResolver.resolveDomain(documentId, {
        documentType: documentTypeName,
        tags: tagNames,
        content
      });
    } catch (e) { /* ignore */ }

    const domainMapping = fieldMappingService.domainMappings?.[documentDomain] || {};
    const fieldProfile = {
      domain: documentDomain,
      displayName: domainMapping.displayName?.en || `${documentDomain} document`,
      icon: domainMapping.icon || '📄',
      requiredFields: fieldMappingService
        .getRequiredFields(documentDomain)
        .map((field) => mapDomainFieldToWorkspaceField(field, true)),
      optionalFields: fieldMappingService
        .getOptionalFields(documentDomain)
        .map((field) => mapDomainFieldToWorkspaceField(field, false))
    };

    let visualFields = [];
    let formattedOverlays = [];
    let overlayCount = 0;
    let visOcrPages = [];
    let visOcrSource = null;
    let visOcrQuality = null;
    if (visualOverlayRepository) {
      try {
        const overlays = await visualOverlayRepository.getByDocId(documentId);
        overlayCount = overlays.length;
        visualFields = overlays.map(o => {
          const data = o.overlayData || {};
          const bbox = normalizeOverlayBoundingBox(data) || {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          };
          return {
            id: String(o.id),
            overlayId: String(o.id),
            label: data.label || o.semanticLabel || 'Unknown',
            value: data.value || data.text || null,
            domain: data.domain || 'GENERAL',
            confidence: data.confidence || o.confidence || 0.5,
            paperlessMapping: data.paperlessMapping || null,
            paperlessField: data.paperlessField || data.paperlessMapping || null,
            mappingConfidence: data.mappingConfidence ?? null,
            matchType: data.matchType || null,
            isMandatory: data.isMandatory || false,
            pageNumber: o.pageNumber || 1,
            bbox
          };
        });
        formattedOverlays = overlays.map(o => {
          const data = o.overlayData || {};
          const bbox = normalizeOverlayBoundingBox(data) || {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          };
          return {
            id: String(o.id),
            overlayId: String(o.id),
            label: data.label || o.semanticLabel || 'Unknown',
            pageNumber: o.pageNumber || data.pageNumber || 1,
            confidence: data.confidence || o.confidence || 0.5,
            bbox,
            paperlessMapping: data.paperlessMapping || null,
            paperlessField: data.paperlessField || data.paperlessMapping || null
          };
        });

        const expertKnowledge = await visualOverlayRepository
          .getExpertKnowledge(documentId);
        const expertMetadata = expertKnowledge?.expertMetadata || {};
        if (Array.isArray(expertMetadata.vis_ocr_pages)) {
          visOcrPages = expertMetadata.vis_ocr_pages
            .filter((page) => page && typeof page === 'object')
            .map((page) => ({
              pageNumber: Number(page.pageNumber) || 0,
              text: typeof page.text === 'string' ? page.text : '',
              success: page.success !== false
            }))
            .filter((page) => page.pageNumber > 0);
        }
        visOcrSource = expertMetadata.vis_ocr_source || null;
        visOcrQuality = Number.isFinite(expertMetadata.vis_ocr_quality)
          ? expertMetadata.vis_ocr_quality
          : null;
      } catch (e) { /* ignore */ }
    }

    // Build response
    res.json({
      id: document.id,
      title: document.title,
      content,
      correspondent: correspondentName,
      correspondentId: document.correspondent || null,
      createdDate: normalizeWorkspaceDate(
        document.created || document.created_date || document.createdDate
      ),
      documentType: documentTypeName,
      documentTypeId: document.document_type || null,
      documentDomain,
      fieldProfile,
      tags: tagNames,
      tagItems,
      availableTags,
      customFields: normalizedCustomFields,
      pageCount: document.page_count || 1,
      mimeType: document.mime_type,
      originalUrl: buildPaperlessProxyUrl(
        document.id,
        '/download/original/'
      ),
      // Use thumbnail as fallback for non-visual documents (ticket:009.1)
      previewUrl: isVisual 
        ? buildPaperlessProxyPreviewUrl(document.id)
        : buildPaperlessProxyUrl(document.id, '/thumb/'),
      persistedNormalizedUrl: persistedNormalizedUrl,
      normalizationStatus: normalizationStatus,
      normalizedUrl: persistedNormalizedUrl || `/api/normalized/${document.id}/1`,
      visual: {
        fields: visualFields,
        overlays: formattedOverlays,
        overlayCount
      },
      currentUser: req.user?.username || null,
      visOcrPages,
      visOcrSource,
      visOcrQuality,
      ocrContent: (content || '').substring(0, 600)
    });

  } catch (error) {
    console.error('[API] Error fetching document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /workspace/api/tags:
 *   get:
 *     summary: Get all tags from Paperless
 *     description: Returns all available tags for document tagging
 *     tags:
 *       - API
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 */
router.get('/api/tags', async (req, res) => {
  try {
    const tags = await getWorkspaceCachedValue(
      'paperless:tags',
      () => paperlessService.getTags(),
      3000
    );
    res.json(tags);
  } catch (error) {
    console.error('[API] Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

/**
 * @swagger
 * /workspace/api/documents:
 *   get:
 *     summary: Get all documents from Paperless
 *     description: Returns all available documents (unfiltered)
 *     tags:
 *       - API
 *       - Documents
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 */
router.get('/api/documents', async (req, res) => {
  try {
    const documents = await getWorkspaceCachedValue(
      'paperless:documents:all',
      () => paperlessService.getAllDocumentsUnfiltered(),
      3000
    );
    res.json(documents);
  } catch (error) {
    console.error('[API] Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * @swagger
 * /workspace:
 *   get:
 *     summary: Document workspace entry
 *     description: Redirects to the latest processed document or shows an empty state.
 *     tags:
 *       - Navigation
 */
router.get('/', async (req, res) => {
  try {
    const username = req.user.username;
    // Render workspace without auto-selecting a document. Provide the list of documents for user selection.
    const history = await documentModel.getAllHistory(username).catch(() => []);
    const allDocs = await getWorkspaceCachedValue(
      'paperless:documents:all',
      () => paperlessService.getAllDocumentsUnfiltered(),
      3000
    ).catch(() => []);
    const availableDocs = (allDocs || []).map(d => ({ id: d.id, title: d.title, original_filename: d.original_file_name }));

    // Backwards-compatible: allow explicit request to open latest via ?latest=1
    if (req.query && req.query.latest === '1') {
      if (history && history.length > 0) return res.redirect(`/workspace/doc/${history[0].document_id}`);
      if (allDocs && allDocs.length > 0) return res.redirect(`/workspace/doc/${allDocs[0].id}`);
    }

    const chatModelConfig = await getWorkspaceCachedValue(
      'workspace:chat-model-config',
      () => buildChatModelConfig(),
      3000
    );

    res.render('document-workspace', {
      vm: UnifiedWorkspaceSchema.parse({
        version: configFile.PAPERLESS_AI_VERSION || '1.0.0',
        config: { disableGithubFetch: process.env.DISABLE_GITHUB_FETCH || 'no' },
        document: null,
        availableDocuments: availableDocs,
        chat: {
          aiProvider: process.env.AI_PROVIDER || 'ollama',
          ollamaDefaultModel:
            process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b',
          modelConfig: chatModelConfig,
        },
        visual: { fields: [], overlayCount: 0 },
        ui: { activeTab: 'metadata', sidebarCollapsed: false },
        user: {
          username: req.user?.username || 'anonymous',
          isAdmin: req.user?.isAdmin || req.user?.is_superuser || false,
        },
      })
    });
  } catch (error) {
    res.status(500).render('error', { message: 'Error loading workspace', details: error.message });
  }
});

module.exports = router;
module.exports._buildChatModelConfig = buildChatModelConfig;
