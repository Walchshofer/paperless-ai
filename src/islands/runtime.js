const { z } = require('zod');

// Primitive value union used for lightweight metadata and payloads
const PrimitiveValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]);

// Runtime Zod schemas (keep in sync with src/ui/contracts/*.ts)
const AnnotationSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  width: z.number().min(0).max(1).optional(),
  height: z.number().min(0).max(1).optional(),
  // optional legacy/alternate bbox representation
  bbox: z.array(z.number()).length(4).optional(),
  note: z.string().optional(),
  confirmed: z.boolean().optional(),
  context: z.object({
    correspondentId: z.number().int().nullable().optional(),
    tagIds: z.array(z.number().int()).optional(),
    page: z.number().int().nonnegative().optional(),
    documentTypeId: z.number().int().nullable().optional(),
    metadata: z.record(PrimitiveValue).optional(),
  }).optional(),
});

const VisualAnnotationSchema = z.object({
  // Accept both string and number documentId (paperless-ngx uses integers)
  documentId: z.union([z.string().min(1), z.number().int().positive()]).nullable().optional(),
  page: z.number().int().nonnegative().optional(),
  // allow mounting with no initial annotations; default to empty array
  annotations: z.array(AnnotationSchema).default([]),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).optional(),
});

// Reusable documentId schema (accepts both string and number for paperless-ngx compatibility)
const DocumentIdSchema = z.union([z.string().min(1), z.number().int().positive()]).nullable().optional();

// Event schemas for cross-island communication validation
const AnnotationCreatedEventSchema = z.object({
  type: z.literal('annotation:created'),
  documentId: DocumentIdSchema,
  page: z.number().int().nonnegative().optional(),
  annotation: AnnotationSchema,
  timestamp: z.number().optional(),
});

const VisualSearchTriggerEventSchema = z.object({
  type: z.literal('visual-search:trigger'),
  documentId: DocumentIdSchema,
  page: z.number().int().nonnegative().optional(),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  timestamp: z.number().optional(),
});

const FeedbackConfirmedEventSchema = z.object({
  type: z.literal('feedback:confirmed'),
  documentId: DocumentIdSchema,
  component: z.string().optional(),
  annotation: AnnotationSchema.optional(),
  timestamp: z.number().optional(),
});

const FeedbackUpdatedEventSchema = z.object({
  type: z.literal('feedback:updated'),
  component: z.string(),
  feedback_type: z.enum(['thumbs_up', 'thumbs_down']),
  documentId: z.number().int().nullable().optional(),
});

const PayloadReadyEventSchema = z.object({
  type: z.literal('payload:ready'),
  documentId: z.union([z.string(), z.number().int()]).nullable().optional(),
  page: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(PrimitiveValue).optional(),
  content: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), value: PrimitiveValue })).optional(),
  annotations: z.array(AnnotationSchema).optional(),
});

const SyncFailedEventSchema = z.object({
  type: z.literal('sync:failed'),
  documentId: z.union([z.string(), z.number().int()]).nullable().optional(),
  error: z.string(),
  timestamp: z.number().optional(),
});

// Settings-related event schemas
const SettingsChangedEventSchema = z.object({
  type: z.literal('settings:changed'),
  category: z.enum(['connection', 'ai-provider', 'expert-models', 'advanced', 'developer']),
  settings: z.record(PrimitiveValue),
  requiresRestart: z.boolean().optional().default(false),
});

const SettingsSavedEventSchema = z.object({
  type: z.literal('settings:saved'),
  category: z.enum(['connection', 'ai-provider', 'expert-models', 'advanced', 'developer']).optional(),
  success: z.boolean().optional().default(true),
  message: z.string().optional().nullable(),
});

const RestartRequiredEventSchema = z.object({
  type: z.literal('settings:restart-required'),
  reason: z.string().optional(),
  settings: z.array(z.string()).optional().default([]),
});

const PresetLoadedEventSchema = z.object({
  type: z.literal('preset:loaded'),
  presetName: z.string(),
  changedSettings: z.record(PrimitiveValue).optional(),
});

const DeveloperToggledEventSchema = z.object({
  type: z.literal('developer:toggled'),
  enabled: z.boolean()
});

// Event schema registry for both-side validation
const eventSchemaMap = {
  'annotation:created': AnnotationCreatedEventSchema,
  'visual-search:trigger': VisualSearchTriggerEventSchema,
  'feedback:confirmed': FeedbackConfirmedEventSchema,
  'feedback:updated': FeedbackUpdatedEventSchema,
  'payload:ready': PayloadReadyEventSchema,
  'sync:failed': SyncFailedEventSchema,
  // Settings events
  'settings:changed': SettingsChangedEventSchema,
  'settings:saved': SettingsSavedEventSchema,
  'settings:restart-required': RestartRequiredEventSchema,
  'preset:loaded': PresetLoadedEventSchema,
  'developer:toggled': DeveloperToggledEventSchema,
};

const FeedbackControlsSchema = z.object({
  documentId: z.number().int().nullable().optional().default(null),
  components: z.array(z.object({ component: z.string(), feedback_type: z.union([z.literal('thumbs_up'), z.literal('thumbs_down')]) })).optional().default([]),
  // list of available component names for inline rendering (matches UI contract)
  availableComponents: z.array(z.string()).optional().default(['tags']),
});

// Field schema for custom field rows
const FieldSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// Extended metadata schema for manual editing
const MetadataSchema = z.object({
  title: z.string().optional(),
  correspondent: z.string().optional(),
  documentType: z.string().optional(),
}).passthrough();

const ManualEditorSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().nonnegative().optional(),
  metadata: MetadataSchema.optional(),
  content: z.string().optional(),
  fields: z.array(FieldSchema).optional(),
  activeTab: z.enum(['metadata', 'content', 'fields', 'ai-debug']).optional(),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).optional(),
});

const ManualDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional(),
});

const ManualWorkspaceSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  content: z.string().optional(),
  title: z.string().nullable().optional(),
  correspondent: z.string().nullable().optional(),
  tags: z.array(z.union([z.string(), z.number()])).optional().default([]),
  originalUrl: z.string().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
  documents: z.array(ManualDocumentSchema).optional().default([]),
});

// Tag schema for history tabs metadata
const TagItemSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

// History metadata schema
const HistoryMetadataSchema = z.object({
  correspondent: z.string().optional(),
  correspondentId: z.number().int().optional(),
  tags: z.array(TagItemSchema).optional(),
  documentType: z.string().optional(),
  created: z.string().optional(),
  modified: z.string().optional()
});

const HistoryTabsSchema = z.object({
  documentId: z.number().int().nullable(),
  content: z.string().optional(),
  metadata: HistoryMetadataSchema.optional()
});

const OverlayItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  domain: z.string().optional(),
  color: z.string().optional(),
  isMandatory: z.boolean().optional(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  originalUrl: z.string().nullable().optional(),
  pageCount: z.number().int().optional(),
  overlayMode: z.enum(['none', 'document']).optional().default('none'),
  showLegend: z.boolean().optional().default(false),
  allowSelection: z.boolean().optional().default(true),
  mode: z.enum(['view', 'draw', 'locate', 'visual-search']).optional().default('visual-search'),
  suggestions: z.array(OverlayItemSchema).optional().default([]),
});

const ViewModeToggleSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  mode: z.enum(['text', 'visual']).optional().default('text'),
  visualEnabled: z.boolean().optional().default(true),
});

const TagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string().optional(),
});

const TagsManagerSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  currentTags: z.array(TagSchema).optional().default([]),
  suggestedTags: z.array(TagSchema).optional().default([]),
  availableTags: z.array(TagSchema).optional().default([]),
  isSaving: z.boolean().optional().default(false),
});

const AIAnalysisSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  content: z.string().optional(),
  isAnalyzing: z.boolean().optional().default(false),
  analysisType: z.enum(['text', 'visual', 'chat']).nullable().optional(),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error'])
    .optional()
    .default('idle'),
});

const ChatDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  original_filename: z.string().optional(),
});

const ChatWorkspaceSchema = z.object({
  openDocumentId: z.number().int().nullable().optional(),
  documents: z.array(ChatDocumentSchema).optional().default([]),
  aiProvider: z.string().optional(),
  ollamaDefaultModel: z.string().nullable().optional(),
});

const HistoryTagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const HistoryFiltersSchema = z.object({
  tags: z.array(HistoryTagSchema).optional().default([]),
  correspondents: z.array(z.string()).optional().default([]),
});

const HistorySortSchema = z.object({
  column: z.enum(['document_id', 'title', 'created_at', 'tags', 'correspondent'])
    .optional()
    .default('created_at'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
});

const HistoryQuerySchema = z.object({
  search: z.string().optional().default(''),
  tag: z.string().nullable().optional().default(null),
  correspondent: z.string().nullable().optional().default(null),
  sort: HistorySortSchema.optional().default({ column: 'created_at', dir: 'desc' }),
  page: z.number().int().nonnegative().optional().default(0),
  pageSize: z.number().int().positive().optional().default(10),
});

const HistoryManagerSchema = z.object({
  filters: HistoryFiltersSchema,
  initialQuery: HistoryQuerySchema.optional().default({}),
});

// Playground Island schema (ticket:017.2)
const PlaygroundSchema = z.object({
  mode: z.enum(['visual-debug', 'text-debug']).default('visual-debug'),
  collection: z.enum(['visual_pages', 'visual_overlays']).default('visual_pages'),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).default('idle'),
  documentId: z.number().int().nullable().optional(),
  sidecarStatus: z.object({
    state: z.enum(['unknown', 'initializing', 'ready', 'error']),
    model: z.string().optional(),
    vram: z.object({
      used_mb: z.number().optional(),
      total_mb: z.number().optional(),
      percent: z.number().optional(),
    }).optional(),
    error: z.string().optional(),
  }).optional(),
});

// Unified Workspace Schema - lightweight shape used for runtime validation
const UnifiedWorkspaceSchema = z.object({
  documentId: z.union([z.string().min(1), z.number().int().positive()]).nullable().optional(),
  visual: z.object({
    overlays: z.array(OverlayItemSchema).optional(),
    overlayItems: z.array(OverlayItemSchema).optional(),
    items: z.array(OverlayItemSchema).optional(),
    fields: z.array(FieldSchema).optional(),
  }).optional(),
}).optional();

// Document Context Bar Schema
const DocumentContextBarSchema = z.object({
  documentId: z.number().int().nullable().optional(),
  title: z.string().nullable().optional(),
  availableDocuments: z.array(z.object({ id: z.number().int(), title: z.string().optional(), original_filename: z.string().optional() })).optional().default([]),
  status: z.enum(['saved', 'unsaved', 'processing', 'error']).optional(),
}).optional();

// Context Sidebar Schema
const ContextSidebarSchema = z.object({
  activeTab: z.enum(['metadata','content','chat','debug']).optional(),
  isAdmin: z.boolean().optional(),
  document: MetadataSchema.optional(),
  availableDocuments: z.array(z.object({ id: z.number().int() })).optional().default([]),
  chat: ChatWorkspaceSchema.optional(),
  visual: z.object({ overlays: z.array(OverlayItemSchema).optional(), overlayItems: z.array(OverlayItemSchema).optional(), items: z.array(OverlayItemSchema).optional(), fields: z.array(FieldSchema).optional() }).optional(),
}).optional();

// Overview Dashboard Schema (minimal runtime shape)
const OverviewDashboardSchema = z.object({
  connection: z.object({ paperlessApiUrl: z.string().optional(), isConnected: z.boolean().optional() }).optional(),
  aiProvider: z.object({ provider: z.string().optional(), model: z.string().optional(), tokenLimit: z.number().optional() }).optional(),
  expertModels: z.object({ enabled: z.boolean().optional(), medicalVisionModel: z.string().optional(), financialAnalysisModel: z.string().optional() }).optional(),
  advanced: z.object({ activateTagging: z.boolean().optional(), activateCorrespondents: z.boolean().optional(), scanInterval: z.number().optional() }).optional(),
}).optional();

// Settings Sidebar Schema (minimal runtime shape)
const SettingsSidebarSchema = z.object({
  activeCategory: z.string().optional(),
  developerModeEnabled: z.boolean().optional(),
  aiProvider: z.string().optional(),
}).optional();

// Restart Banner Schema
const RestartBannerSchema = z.object({
  initiallyVisible: z.boolean().optional(),
  initialReason: z.string().optional(),
  initialChangedSettings: z.array(z.string()).optional().default([]),
}).optional();

const schemaMap = {
  'visual-annotation-island': VisualAnnotationSchema,
  'feedback-controls-island': FeedbackControlsSchema,
  'manual-editor-island': ManualEditorSchema,
  'manual-workspace-island': ManualWorkspaceSchema,
  'history-tabs-island': HistoryTabsSchema,
  'overlay-viewer-island': OverlayViewerSchema,
  'view-mode-toggle-island': ViewModeToggleSchema,
  'tags-manager-island': TagsManagerSchema,
  'ai-analysis-island': AIAnalysisSchema,
  'chat-workspace-island': ChatWorkspaceSchema,
  'history-manager-island': HistoryManagerSchema,
  'playground-island': PlaygroundSchema,
  'unified-workspace-island': UnifiedWorkspaceSchema,
  'document-context-bar-island': DocumentContextBarSchema,
  'context-sidebar-island': ContextSidebarSchema,
  // Base settings islands scaffolding (P1.3)
  'overview-dashboard-island': OverviewDashboardSchema,
  'settings-sidebar-island': SettingsSidebarSchema,
  'restart-banner-island': RestartBannerSchema,
};

// Helper to create a Cross-Environment CustomEvent (JSDOM vs Node)
function createCustomEvent(name, detail){
  try{
    const C = (typeof window !== 'undefined' && window.CustomEvent) ? window.CustomEvent : (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
    if (C) return new C(name, { detail });
  }catch{ /* ignore */ }
  // Last resort: try to construct via document.defaultView
  try{
    if (typeof document !== 'undefined' && document.defaultView && document.defaultView.CustomEvent){
      return new document.defaultView.CustomEvent(name, { detail });
    }
  }catch{ /* ignore */ }
  // If all else fails, return a plain object (dispatchEvent will likely fail)
  return { type: name, detail };
}

const registry = {};

function registerIsland(name, renderer) {
  registry[name] = renderer;
}

function mountIslands(container = document) {
  const nodes = container.querySelectorAll('[data-island]');
  nodes.forEach((el) => {
    const name = el.getAttribute('data-island');
    if (!name) return;

    const raw = el.getAttribute('data-props') || '{}';
    let props = {};
    try {
      props = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`island-runtime: failed to parse props for ${name}`, parseErr.message);
      return;
    }

    // Validate if schema exists
    const schema = schemaMap[name];
    if (schema) {
      const result = schema.safeParse(props);
      if (!result.success) {
        console.warn(`island-runtime: props failed validation for ${name}`, result.error.errors);
        return; // skip mounting invalid props
      }
      props = result.data;
    }

    const renderer = registry[name];
    if (!renderer) {
      console.warn(`island-runtime: no renderer registered for island '${name}'`);
      return;
    }

    try {
      renderer(el, props);
      el.setAttribute('data-mounted', 'true');
    } catch (err) {
      console.error(`island-runtime: error rendering island '${name}'`, err && err.stack ? err.stack : err);
    }
  });
}

/**
 * Event Bus with Both-Side Validation
 *
 * Validates events on dispatch and provides validated event listening.
 * This ensures type safety across island boundaries.
 */
const eventBus = {
  /**
   * Dispatch a validated event through the document event system.
   * @param {string} eventName - Event name (e.g., 'feedback:confirmed')
   * @param {object} detail - Event payload
   * @returns {boolean} - True if validation passed and event was dispatched
   */
  dispatch(eventName, detail) {
    const schema = eventSchemaMap[eventName];
    if (schema) {
      const payload = { type: eventName, ...detail };
      const result = schema.safeParse(payload);
      if (!result.success) {
        console.warn(`eventBus: dispatch validation failed for '${eventName}'`, result.error.errors);
        return false;
      }
      (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent(eventName, result.data)); })();
      return true;
    }
    // No schema defined - dispatch without validation
    (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent(eventName, detail)); })();
    return true;
  },

  /**
   * Listen for a validated event.
   * @param {string} eventName - Event name to listen for
   * @param {function} callback - Handler receiving validated detail
   * @returns {function} - Cleanup function to remove listener
   */
  listen(eventName, callback) {
    const handler = (e) => {
      const schema = eventSchemaMap[eventName];
      if (schema) {
        const payload = { type: eventName, ...(e.detail || {}) };
        const result = schema.safeParse(payload);
        if (!result.success) {
          console.warn(`eventBus: listener validation failed for '${eventName}'`, result.error.errors);
          return;
        }
        callback(result.data);
      } else {
        callback(e.detail);
      }
    };
    const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null;
    if (_doc && typeof _doc.addEventListener === 'function'){
      _doc.addEventListener(eventName, handler);
      return () => _doc.removeEventListener(eventName, handler);
    }
    console.warn('eventBus: document not available to register listener', eventName);
    return () => {};
  }
};

module.exports = {
  mountIslands,
  registerIsland,
  eventBus,
  _registry: registry, // exported for tests
  _schemas: schemaMap,
  _eventSchemas: eventSchemaMap,
};