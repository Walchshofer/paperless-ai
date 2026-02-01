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

// Default placeholder renderers (can be overridden via registerIsland)
const defaultRenderers = {
  'visual-annotation-island': (el) => {
    // Interactive red-pen style annotation canvas + save UI
    el.innerHTML = `
      <div data-testid="visual-annotation-island-root" data-hydrated="true" style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button data-testid="draw-toggle" aria-pressed="false">Draw Mode</button>
          <button data-testid="save-annotations">Save Annotations</button>
          <div aria-live="polite" data-testid="annotation-status" style="margin-left:8px;color:#333">No annotations</div>
        </div>
        <div data-testid="annotation-canvas" style="position:relative;border:1px solid #ddd;height:240px;touch-action:none;background:#fff;">
          <div data-testid="annotation-overlay" style="position:absolute;left:0;top:0;right:0;bottom:0"></div>
        </div>
        <div data-testid="annotations-list" style="margin-top:8px"></div>
      </div>
    `;

    (function(){
      try {
        const root = el.querySelector('[data-testid="visual-annotation-island-root"]');
        if (!root) return;
        const canvas = root.querySelector('[data-testid="annotation-canvas"]');
        const overlay = root.querySelector('[data-testid="annotation-overlay"]');
        const drawToggle = root.querySelector('[data-testid="draw-toggle"]');
        const saveBtn = root.querySelector('[data-testid="save-annotations"]');
        const status = root.querySelector('[data-testid="annotation-status"]');
        const list = root.querySelector('[data-testid="annotations-list"]');

        let drawing = false;
        let start = null;
        const annotations = [];

        function getLocalCoords(evt){
          const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left:0, top:0, width: canvas.clientWidth, height: canvas.clientHeight };
          const x = (evt.clientX - rect.left);
          const y = (evt.clientY - rect.top);
          return { x, y, w: rect.width, h: rect.height };
        }

        function renderRect(elm, x, y, w, h){
          elm.style.position = 'absolute';
          elm.style.left = `${x}px`;
          elm.style.top = `${y}px`;
          elm.style.width = `${w}px`;
          elm.style.height = `${h}px`;
          elm.style.border = '2px solid rgba(220,20,60,0.9)';
          elm.style.boxSizing = 'border-box';
          elm.style.pointerEvents = 'none';
        }

        function addAnnotation(norm){
          annotations.push(norm);
          const idx = annotations.length - 1;
          const container = document.createElement('div');
          container.setAttribute('data-testid', 'annotation-item');
          container.style.display = 'flex';
          container.style.gap = '8px';
          container.style.alignItems = 'center';
          container.style.marginBottom = '4px';

          const label = document.createElement('input');
          label.setAttribute('data-testid', `annotation-label-${idx}`);
          label.placeholder = 'Label';
          label.value = norm.label || '';

          const note = document.createElement('input');
          note.setAttribute('data-testid', `annotation-note-${idx}`);
          note.placeholder = 'Note (optional)';
          note.value = norm.note || '';

          const confirm = document.createElement('button');
          confirm.textContent = 'Confirm Match';
          confirm.addEventListener('click', async () => {
            try {
              const propsRaw = (root.closest('[data-props]') && root.closest('[data-props]').getAttribute('data-props')) || '{}';
              let props = {};
              try { props = JSON.parse(propsRaw); } catch{ props = {}; }

              const ann = annotations[idx];
              // Build bbox in [y1, x1, y2, x2] normalized format for the API
              const bbox = [ann.y || 0, ann.x || 0, (ann.y || 0) + (ann.height || 0), (ann.x || 0) + (ann.width || 0)];
              const requestId = `annotation-confirm-${Date.now()}`;

              // attempt POST to feedback endpoint with correct payload structure
              // API expects: { documentId, events: [{ event_type, field_name, corrected_value, context }] }
              if (typeof fetch !== 'undefined') {
                await fetch('/api/visual-rag/feedback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': requestId
                  },
                  body: JSON.stringify({
                    documentId: props.documentId ? Number(props.documentId) : null,
                    events: [{
                      event_type: 'annotation',
                      field_name: ann.label || 'visual_annotation',
                      corrected_value: {
                        label: ann.label || '',
                        text: ann.note || '',
                        bbox,
                        confidence: 1.0
                      },
                      context: {
                        request_id: requestId,
                        page: props.page || 0,
                        bbox,
                        label: ann.label || '',
                        note: ann.note || ''
                      }
                    }]
                  })
                });
              }
              confirm.disabled = true;
              confirm.textContent = 'Confirmed';
              (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('feedback:confirmed', { ...ann, documentId: props.documentId || null, page: props.page || null, bbox })); })();
            } catch(e){ console.warn('Failed to confirm match (runtime)', e); }
          });

          const remove = document.createElement('button');
          remove.textContent = 'Remove';
          remove.addEventListener('click', () => {
            annotations.splice(idx,1);
            list.removeChild(container);
            status.textContent = `${annotations.length} annotations`;
          });

          container.appendChild(label);
          container.appendChild(note);
          container.appendChild(confirm);
          container.appendChild(remove);
          list.appendChild(container);
          status.textContent = `${annotations.length} annotations`;

          // wire inputs to annotations array
          label.addEventListener('input', (e)=>{ annotations[idx].label = e.target.value; });
          note.addEventListener('input', (e)=>{ annotations[idx].note = e.target.value; });
        }

        // Apply annotations loaded from server or other islands
        function applyLoadedAnnotations(loaded) {
          if (!Array.isArray(loaded)) return;
          const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.clientWidth, height: canvas.clientHeight };
          for (const a of loaded) {
            // normalize shape: allow {bbox:{x,y,width,height}} or x/y/width/height
            const x = Number(a.bbox?.x ?? a.x ?? 0);
            const y = Number(a.bbox?.y ?? a.y ?? 0);
            const width = Number(a.bbox?.width ?? a.width ?? 0);
            const height = Number(a.bbox?.height ?? a.height ?? 0);
            const norm = { label: a.label || '', note: a.note || '', x, y, width, height };
            addAnnotation(norm);
            // Render a confirmed static box in the overlay
            try {
              const left = x * rect.width;
              const top = y * rect.height;
              const wpx = Math.max(2, width * rect.width);
              const hpx = Math.max(2, height * rect.height);
              const staticBox = document.createElement('div');
              staticBox.setAttribute('data-testid', `annotation-box-${annotations.length - 1}`);
              renderRect(staticBox, left, top, wpx, hpx);
              staticBox.style.borderColor = 'rgba(59,130,246,0.9)'; // blue for saved
              staticBox.classList.add('vai-box-confirmed');
              overlay.appendChild(staticBox);

              // mark the last added confirm button as disabled/confirmed
              const lastIdx = annotations.length - 1;
              const listItem = list.querySelectorAll('[data-testid="annotation-item"]')[lastIdx];
              if (listItem) {
                const btn = listItem.querySelector('button');
                if (btn) {
                  btn.disabled = true;
                  btn.textContent = 'Confirmed';
                }
              }
            } catch { /* ignore render errors */ }
          }
        }

        // Listen for cross-island loaded annotations
        document.addEventListener('annotations:loaded', (ev) => { try { applyLoadedAnnotations(ev?.detail?.annotations || []); } catch { /* ignore */ } });

        // If initial props include annotations, apply them (runtime/data-props payload)
        try {
          const propsRaw = (root.closest('[data-props]') && root.closest('[data-props]').getAttribute('data-props')) || '{}';
          let props = {};
          try { props = JSON.parse(propsRaw); } catch { /* ignore */ };
          if (Array.isArray(props.annotations)) applyLoadedAnnotations(props.annotations);
        } catch { /* ignore */ }


        drawToggle.addEventListener('click', ()=>{
          drawing = !drawing;
          drawToggle.setAttribute('aria-pressed', drawing ? 'true' : 'false');
          drawToggle.textContent = drawing ? 'Drawing: ON' : 'Draw Mode';
        });

        let liveRect = null;

        canvas.addEventListener('mousedown', (e)=>{
          if(!drawing) return;
          e.preventDefault();
          const { x, y } = getLocalCoords(e);
          start = { x, y };
          liveRect = document.createElement('div');
          renderRect(liveRect, x, y, 0, 0);
          overlay.appendChild(liveRect);
        });

        canvas.addEventListener('mousemove', (e)=>{
          if(!drawing || !start || !liveRect) return;
          const { x, y } = getLocalCoords(e);
          const left = Math.min(start.x, x);
          const top = Math.min(start.y, y);
          const width = Math.abs(x - start.x);
          const height = Math.abs(y - start.y);
          renderRect(liveRect, left, top, width, height);
        });

        canvas.addEventListener('mouseup', (e)=>{
          if(!drawing || !start || !liveRect) return;
          const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.clientWidth, height: canvas.clientHeight };
          const { x, y } = getLocalCoords(e);
          const left = Math.min(start.x, x);
          const top = Math.min(start.y, y);
          const width = Math.abs(x - start.x);
          const height = Math.abs(y - start.y);

          // normalize
          const nx = left / rect.width;
          const ny = top / rect.height;
          const nw = width / rect.width;
          const nh = height / rect.height;

          // cleanup live rect and replace with static red box
          overlay.removeChild(liveRect);
          const staticBox = document.createElement('div');
          renderRect(staticBox, left, top, width, height);
          overlay.appendChild(staticBox);

          addAnnotation({ label: '', x: nx, y: ny, width: nw, height: nh });

          start = null;
          liveRect = null;
        });

        saveBtn.addEventListener('click', () => {
          const propsRaw = (root.closest('[data-props]') && root.closest('[data-props]').getAttribute('data-props')) || '{}';
          let props = {};
          try { props = JSON.parse(propsRaw); } catch{ props = {}; }
          const payload = {
            documentId: props.documentId || null,
            page: props.page || null,
            annotations: annotations.map(a => ({ label: a.label || '', note: a.note || '', x: a.x, y: a.y, width: a.width, height: a.height }))
          };
          document.dispatchEvent(createCustomEvent('payload:ready', payload));
        });

      } catch(e){ console.warn('visual-annotation-island runtime setup failed', e); }
    })();
  },
  'feedback-controls-island': (el, props = {}) => {
    const comps = Array.isArray(props.availableComponents) ? props.availableComponents : ['tags'];
    const rows = comps.map(c => `\n        <div data-testid="feedback-controls-${c}" style="display:inline-block;margin-right:8px">\n          <button data-testid="thumbs-up-${c}" aria-pressed="false">👍 ${c}</button>\n          <button data-testid="thumbs-down-${c}" aria-pressed="false">👎 ${c}</button>\n        </div>\n      `).join('');

    el.innerHTML = `\n      <div data-testid="feedback-controls-island-root" data-hydrated="true" role="group" aria-label="Feedback Controls">\n        ${rows}\n      </div>\n      <script>\n        (function(){\n          try {\n            const root = document.currentScript.parentElement.querySelector('[data-testid="feedback-controls-island-root"]');\n            if (!root) return;\n            const ups = Array.from(root.querySelectorAll('[data-testid^="thumbs-up-"]'));
            const downs = Array.from(root.querySelectorAll('[data-testid^="thumbs-down-"]'));
            ups.forEach(u => {\n              u.addEventListener('click', ()=>{\n                const name = u.getAttribute('data-testid').replace('thumbs-up-','');\n                u.setAttribute('aria-pressed', (u.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');\n                const d = root.querySelector('[data-testid="thumbs-down-\${name}"]'); if (d) d.setAttribute('aria-pressed','false');\n                document.dispatchEvent(createCustomEvent('feedback:updated', { component: name, feedback_type: 'thumbs_up' }));\n                document.dispatchEvent(createCustomEvent('feedback:confirmed', { component: name, documentId: (root.closest('[data-props]') && JSON.parse(root.closest('[data-props]').getAttribute('data-props')||'{}').documentId) || null }));\n              });\n            });\n            downs.forEach(d => {\n              d.addEventListener('click', ()=>{\n                const name = d.getAttribute('data-testid').replace('thumbs-down-','');\n                d.setAttribute('aria-pressed', (d.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');\n                const u = root.querySelector('[data-testid="thumbs-up-\${name}"]'); if (u) u.setAttribute('aria-pressed','false');\n                (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') { _doc.dispatchEvent(createCustomEvent('feedback:updated', { component: name, feedback_type: 'thumbs_down' })); } })();\n              });\n            });\n          } catch(e){ console.warn('feedback-controls-island runtime setup failed', e); }\n        })();\n      </script>\n    `;
  },
  'manual-editor-island': (el) => {
    el.innerHTML = `
      <div data-testid="manual-editor-island-root" data-hydrated="true">
        <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">
          <button role="tab" data-testid="tab-metadata" aria-selected="true" onclick="(function(){ const root = this.closest('[data-testid="manual-editor-island-root"]'); const tabs = Array.from(root.querySelectorAll('[role="tab"]')); const panels = Array.from(root.querySelectorAll('[data-panel]')); const idx = tabs.indexOf(this); tabs.forEach((t,i)=>t.setAttribute('aria-selected', String(i===idx))); panels.forEach((p,i)=>p.style.display = i===idx ? '' : 'none'); }).call(this);">Metadata</button>
          <button role="tab" data-testid="tab-content" aria-selected="false" onclick="(function(){ const root = this.closest('[data-testid="manual-editor-island-root"]'); const tabs = Array.from(root.querySelectorAll('[role="tab"]')); const panels = Array.from(root.querySelectorAll('[data-panel]')); const idx = tabs.indexOf(this); tabs.forEach((t,i)=>t.setAttribute('aria-selected', String(i===idx))); panels.forEach((p,i)=>p.style.display = i===idx ? '' : 'none'); }).call(this);">Content</button>
          <button role="tab" data-testid="tab-fields" aria-selected="false" onclick="(function(){ const root = this.closest('[data-testid="manual-editor-island-root"]'); const tabs = Array.from(root.querySelectorAll('[role="tab"]')); const panels = Array.from(root.querySelectorAll('[data-panel]')); const idx = tabs.indexOf(this); tabs.forEach((t,i)=>t.setAttribute('aria-selected', String(i===idx))); panels.forEach((p,i)=>p.style.display = i===idx ? '' : 'none'); }).call(this);">Fields</button>
          <button role="tab" data-testid="tab-ai-debug" aria-selected="false" onclick="(function(){ const root = this.closest('[data-testid="manual-editor-island-root"]'); const tabs = Array.from(root.querySelectorAll('[role="tab"]')); const panels = Array.from(root.querySelectorAll('[data-panel]')); const idx = tabs.indexOf(this); tabs.forEach((t,i)=>t.setAttribute('aria-selected', String(i===idx))); panels.forEach((p,i)=>p.style.display = i===idx ? '' : 'none'); }).call(this);">AI Debug</button>
        </div>
        <div id="manual-editor-panel">
          <div data-panel="metadata" data-testid="panel-metadata">
            <label>Title <input data-testid="manual-title-input" type="text"/></label>
          </div>
          <div data-panel="content" data-testid="panel-content" style="display:none">
            <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>
          </div>
          <div data-panel="fields" data-testid="panel-fields" style="display:none">
            <div><input data-testid="field-name-0" placeholder="Field name"/><input data-testid="field-value-0" placeholder="Field value"/></div>
          </div>
          <div data-panel="ai-debug" style="display:none">
            <div data-testid="panel-ai-debug">AI Debug information will appear here (GPU state dependent)</div>
          </div>
        </div>
        <div style="margin-top:8px">
          <button data-testid="manual-save-btn">Save</button>
        </div>
      </div>
    `;
    // Note: Event wiring is handled in the post-mount setup in mountIslands() for JSDOM compatibility
  },
  'history-tabs-island': (el) => {
    el.innerHTML = `\n      <div data-testid="history-tabs-root" data-hydrated="true">\n        <div role="tablist" aria-label="Document tabs" style="display:flex;gap:8px;margin-bottom:8px">\n          <button role="tab" data-testid="tab-text" aria-selected="true">Text</button>\n          <button role="tab" data-testid="tab-metadata" aria-selected="false">Metadata</button>\n          <button role="tab" data-testid="tab-similar" aria-selected="false">Similar</button>\n        </div>\n        <div data-panel="text" data-testid="panel-text" aria-hidden="false">Text content unavailable</div>\n        <div data-panel="metadata" data-testid="panel-metadata" style="display:none" aria-hidden="true">Metadata unavailable</div>\n        <div data-panel="similar" data-testid="panel-similar" style="display:none" aria-hidden="true">\n          <div data-testid="gpu-initializing" style="display:none">GPU Initializing...</div>\n          <div data-testid="similar-results" style="display:none"></div>\n          <div data-testid="similar-empty">No similar results yet</div>\n        </div>\n      </div>\n    `;
  },

  'overlay-viewer-island': (el, props = {}) => {
    const page = props.page || 1;
    const initialOriginal = props.originalUrl || '';
    el.innerHTML = `
      <div data-testid="overlay-viewer-root" data-hydrated="true" data-original-url="${initialOriginal}">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button data-testid="overlay-prev-page" aria-label="Previous page" style="margin-right:8px;padding:4px 8px;">&lt;</button>
          <span data-testid="overlay-page-indicator">Page ${page}${props.pageCount ? ' of ' + props.pageCount : ''}</span>
          <button data-testid="overlay-next-page" aria-label="Next page" style="margin-left:8px;padding:4px 8px;">&gt;</button>

          <!-- Zoom & Pan (simple runtime fallback for non-hydrated environments/tests) -->
          <div style="display:flex;gap:6px;align-items:center;margin-left:12px">
            <button data-testid="overlay-zoom-out" style="padding:4px 6px">-</button>
            <span data-testid="overlay-zoom-percentage">100%</span>
            <button data-testid="overlay-zoom-in" style="padding:4px 6px">+</button>
            <button data-testid="overlay-zoom-reset" style="padding:4px 6px">Reset</button>
            <button data-testid="red-pen-toggle" aria-pressed="false" style="padding:4px 6px">Draw Mode</button>
            <button data-testid="overlay-pan-toggle" aria-pressed="false" style="padding:4px 6px">Pan</button>
          </div>
        </div>
        <div id="overlayContainer" data-testid="overlay-container">
          <img data-testid="document-image" alt="document" style="display:block;max-width:100%;height:auto;" />
        </div>
        <div id="overlayLoading" data-testid="overlay-loading" class="hidden">Loading...</div>
      </div>
      <script>
        (function(){
          try {
            const root = document.currentScript.parentElement.querySelector('[data-testid="overlay-viewer-root"]');
            if (!root) return;
            const pageEl = root.querySelector('[data-testid="overlay-page-indicator"]');
            const img = root.querySelector('img[data-testid="document-image"]');
            const prev = root.querySelector('[data-testid="overlay-prev-page"]');
            const next = root.querySelector('[data-testid="overlay-next-page"]');

            const buildSrc = (d) => {
              const page = d.page || 1;
              const original = d.originalUrl || d.original_url || '';
              if (original) return original + (original.includes('?') ? '&' : '?') + 'page=' + page;
              if (d.documentId) return '/documents/' + d.documentId + '/download/original/?page=' + page;
              return '';
            };

            function dispatchOverlayChange(pageNum) {
              const propsRaw = (document.currentScript.parentElement.getAttribute('data-props')) || '{}';
              let props = {};
              try { props = JSON.parse(propsRaw); } catch(e) { props = {}; }
              const docId = props.documentId || null;
              const original = props.originalUrl || props.original_url || '';
              const ev = new CustomEvent('overlay:document-changed', { detail: { documentId: docId, page: pageNum, originalUrl: original } });
              window.dispatchEvent(ev);
            }

            if (prev) prev.addEventListener('click', () => {
              const m = (pageEl.textContent || '').match(/(\\d+)/g);
              const cur = m ? Number(m[0]) : ${page};
              const nextPage = Math.max(1, cur - 1);
              if (pageEl) pageEl.textContent = 'Page ' + nextPage + (props.pageCount ? ' of ' + props.pageCount : '');
              dispatchOverlayChange(nextPage);
            });

            if (next) next.addEventListener('click', () => {
              const m = (pageEl.textContent || '').match(/(\\d+)/g);
              const cur = m ? Number(m[0]) : ${page};
              const nextPage = cur + 1;
              if (props.pageCount && nextPage > props.pageCount) return;
              if (pageEl) pageEl.textContent = 'Page ' + nextPage + (props.pageCount ? ' of ' + props.pageCount : '');
              dispatchOverlayChange(nextPage);
            });

            // Zoom & Pan fallback wiring (attach listeners instead of inline onclicks)
            (function(){
              const zoomIn = root.querySelector('[data-testid="overlay-zoom-in"]');
              const zoomOut = root.querySelector('[data-testid="overlay-zoom-out"]');
              const zoomPct = root.querySelector('[data-testid="overlay-zoom-percentage"]');
              const zoomReset = root.querySelector('[data-testid="overlay-zoom-reset"]');
              const drawToggle = root.querySelector('[data-testid="red-pen-toggle"]');
              const panToggle = root.querySelector('[data-testid="overlay-pan-toggle"]');
              let scale = 1;

              function setPct() {
                if (zoomPct) zoomPct.textContent = Math.round(scale * 100) + '%';
              }

              if (zoomIn && !zoomIn._hasFallbackZoomHandler) {
                zoomIn.addEventListener('click', () => { scale = Math.min(3, scale + 0.1); setPct(); });
                zoomIn._hasFallbackZoomHandler = true;
              }
              if (zoomOut && !zoomOut._hasFallbackZoomHandler) {
                zoomOut.addEventListener('click', () => { scale = Math.max(0.5, scale - 0.1); setPct(); });
                zoomOut._hasFallbackZoomHandler = true;
              }
              if (zoomReset && !zoomReset._hasFallbackZoomHandler) {
                zoomReset.addEventListener('click', () => { scale = 1; setPct(); });
                zoomReset._hasFallbackZoomHandler = true;
              }

              if (drawToggle && !drawToggle._hasFallbackDrawHandler) {
                drawToggle.addEventListener('click', function(){ const d = this.getAttribute('aria-pressed') === 'true'; this.setAttribute('aria-pressed', (!d).toString()); this.textContent = (!d) ? 'Drawing: ON' : 'Draw Mode'; });
                drawToggle._hasFallbackDrawHandler = true;
              }

              if (panToggle && !panToggle._hasFallbackPanHandler) {
                panToggle.addEventListener('click', function(){ const p = this.getAttribute('aria-pressed') === 'true'; this.setAttribute('aria-pressed', (!p).toString()); });
                panToggle._hasFallbackPanHandler = true;
              }
            })();

            window.addEventListener('overlay:document-changed', (e) => {
              const d = (e && e.detail) || {};
              if (pageEl && d.page !== undefined && d.page !== null) pageEl.textContent = 'Page ' + d.page + (d.pageCount ? ' of ' + d.pageCount : '');

              // Set root attribute for tests
              const resolvedOriginal = d.originalUrl || d.original_url || '';
              root.setAttribute('data-original-url', resolvedOriginal);

              // Update image src
              if (img) {
                const src = buildSrc(d);
                if (src) img.src = src;
              }
            });
          } catch { /* ignore */ }
        })();
      </script>
    `;
  },

  'overview-dashboard-island': (el) => {
    el.innerHTML = `
      <div data-testid="overview-dashboard-root" data-hydrated="true" style="padding:12px;font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
        <h2 style="margin:0 0 8px 0">Overview</h2>
        <div data-testid="overview-cards">(placeholder) summary cards will render here</div>
      </div>
    `;
  },

  'settings-sidebar-island': (el) => {
    el.innerHTML = `
      <div data-testid="settings-sidebar-root" data-hydrated="true" style="padding:8px;font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
        <nav aria-label="Settings navigation">
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">
            <li>Overview</li>
            <li>Connection</li>
            <li>AI Provider</li>
            <li>Expert Models</li>
            <li>Advanced</li>
            <li>Developer</li>
          </ul>
        </nav>
        <div style="margin-top:8px" data-testid="dev-toggle">Developer Mode: Off</div>
      </div>
    `;
  },

  'restart-banner-island': (el, props = {}) => {
    const visible = props && props.visible ? '' : 'none';
    el.innerHTML = `
      <div data-testid="restart-banner-root" data-hydrated="true" style="display:${visible};padding:8px;background:#fff7ed;border:1px solid #f59e0b;">
        <span>⚠️ <span data-testid="restart-message">Restart required for changes to take effect</span></span>
        <button data-testid="restart-btn" style="margin-left:8px;padding:4px 8px;">Restart Now</button>
      </div>
    `;
  },
  'export-panel-island': (el, props = {}) => {
    const docId = props && props.documentId ? props.documentId : '';
    el.innerHTML = `<div data-testid="export-panel-root" data-hydrated="true">Export Panel Placeholder${docId ? ' - documentId: ' + docId : ''}</div>`;
  },
  'unified-workspace-island': (el) => {
    el.innerHTML = '<div data-testid="unified-workspace-root" data-hydrated="true">Unified Workspace Placeholder</div>';
  },
  'document-context-bar-island': (el) => {
    el.innerHTML = '<div data-testid="document-context-bar-root" data-hydrated="true">Document Context Bar Placeholder</div>';
  },
  'context-sidebar-island': (el) => {
    el.innerHTML = '<div data-testid="context-sidebar-root" data-hydrated="true">Context Sidebar Placeholder</div>';
  },
};

const registry = Object.assign({}, defaultRenderers);

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

      // Post-mount setup for environments where inline <script> won't execute (JSDOM)
      try {
        if (name === 'feedback-controls-island') {
          const root = el.querySelector('[data-testid="feedback-controls-island-root"]');
          if (root) {
            const ups = Array.from(root.querySelectorAll('[data-testid^="thumbs-up-"]'));
            const downs = Array.from(root.querySelectorAll('[data-testid^="thumbs-down-"]'));
            ups.forEach((u) => {
              u.addEventListener('click', () => {
                const nm = u.getAttribute('data-testid').replace('thumbs-up-','');
                u.setAttribute('aria-pressed', (u.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');
                const d = root.querySelector(`[data-testid="thumbs-down-${nm}"]`);
                if (d) d.setAttribute('aria-pressed','false');
                (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('feedback:updated', { component: nm, feedback_type: 'thumbs_up' })); })();
                // emit confirmation for thumbs up
                const propsRaw = el.getAttribute('data-props') || '{}';
                let props = {};
                try { props = JSON.parse(propsRaw); } catch{ props = {}; }
                (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('feedback:confirmed', { component: nm, documentId: props.documentId || null })); })();
              });
            });
            downs.forEach((d) => {
              d.addEventListener('click', () => {
                const nm = d.getAttribute('data-testid').replace('thumbs-down-','');
                d.setAttribute('aria-pressed', (d.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');
                const u = root.querySelector(`[data-testid="thumbs-up-${nm}"]`);
                if (u) u.setAttribute('aria-pressed','false');
                (function(){ const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('feedback:updated', { component: nm, feedback_type: 'thumbs_down' })); })();
              });
            });
          }
        }

        if (name === 'manual-editor-island') {
          const root = el.querySelector('[data-testid="manual-editor-island-root"]');
          if (root) {
            const tabs = Array.from(root.querySelectorAll('[role="tab"]')) || [];
            const panels = Array.from(root.querySelectorAll('[data-panel]')) || [];
            function setActive(idx){
              tabs.forEach((t,i)=>{ t.setAttribute('aria-selected', i===idx ? 'true' : 'false'); });
              panels.forEach((p,i)=>{ p.style.display = i===idx ? '' : 'none'; });
            }
            tabs.forEach((t,i)=>{ t.addEventListener('click', ()=> setActive(i)); t.addEventListener('keydown', (e)=>{ if(e.key==='ArrowLeft'){ setActive((i+tabs.length-1)%tabs.length); } if(e.key==='ArrowRight'){ setActive((i+1)%tabs.length); }}); });

            const save = root.querySelector('[data-testid="manual-save-btn"]');
            if (save) save.addEventListener('click', async ()=>{
              const propsRaw = (root.closest('[data-props]') && root.closest('[data-props]').getAttribute('data-props')) || '{}';
              let props = {};
              try { props = JSON.parse(propsRaw); } catch{ props = {}; }

              const requestId = `mei-${Date.now()}`;
              const titleEl = root.querySelector('[data-testid="manual-title-input"]');
              const contentEl = root.querySelector('[data-testid="manual-content-input"]');
              const fnameEl = root.querySelector('[data-testid="field-name-0"]');
              const fvalEl = root.querySelector('[data-testid="field-value-0"]');

              const title = titleEl ? titleEl.value || '' : '';
              const content = contentEl ? contentEl.value || '' : '';
              const custom_fields = [];
              if (fnameEl && fnameEl.value) {
                custom_fields.push({ name: fnameEl.value, value: fvalEl ? fvalEl.value : '' });
              }

              const document_updates = {
                title,
                correspondent: '',
                documentType: '',
                content,
                custom_fields,
              };


              // For the runtime fallback, we don't have initial values to diff against
              // so we just include all fields that have values
              const feedback_events = [];
              if (title) {
                feedback_events.push({
                  event_type: 'correction',
                  field_name: 'title',
                  original_value: '',
                  corrected_value: title,
                  context: { page: props.page || 0, request_id: requestId },
                });
              }
              if (content) {
                feedback_events.push({
                  event_type: 'correction',
                  field_name: 'content',
                  original_value: '',
                  corrected_value: content.substring(0, 500),
                  context: { page: props.page || 0, request_id: requestId },
                });
              }
              custom_fields.forEach(f => {
                feedback_events.push({
                  event_type: 'correction',
                  field_name: `custom_field:${f.name}`,
                  original_value: '',
                  corrected_value: f.value,
                  context: { page: props.page || 0, request_id: requestId },
                });
              });

              const payload = {
                documentId: props.documentId ?? null,
                document_updates,
                feedback_events,
                transactional: true,
              };

              const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('payload:ready', payload));

              // POST to Hybrid SOT orchestrator
              try {
                if (typeof fetch !== 'undefined') {
                  const res = await fetch('/manual/updateDocument', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Request-Id': requestId,
                    },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    const result = await res.json().catch(() => ({}));
                    const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('sync:success', { documentId: props.documentId, ...result }));
                  } else {
                    const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
                    throw new Error(errorData.message || `Sync failed with status ${res.status}`);
                  }
                }
              } catch (err) {
                  const _doc = (typeof document !== 'undefined') ? document : (typeof window !== 'undefined' && window.document) ? window.document : null; if (_doc && typeof _doc.dispatchEvent === 'function') _doc.dispatchEvent(createCustomEvent('sync:failed', { documentId: props.documentId, error: err.message || 'Sync failed' }));
              }
            });
          }
        }
        if (name === 'overlay-viewer-island') {
          const root = el.querySelector('[data-testid="overlay-viewer-root"]');
          if (root) {
            const draw = root.querySelector('[data-testid="red-pen-toggle"]');
            const pan = root.querySelector('[data-testid="overlay-pan-toggle"]');

            if (draw && !draw._hasFallbackDrawHandler) {
              draw.addEventListener('click', function(){ const d = this.getAttribute('aria-pressed') === 'true'; this.setAttribute('aria-pressed', (!d).toString()); this.textContent = (!d) ? 'Drawing: ON' : 'Draw Mode'; });
              draw._hasFallbackDrawHandler = true;
            }

            if (pan && !pan._hasFallbackPanHandler) {
              pan.addEventListener('click', function(){ const p = this.getAttribute('aria-pressed') === 'true'; this.setAttribute('aria-pressed', (!p).toString()); });
              pan._hasFallbackPanHandler = true;
            }
          }
        }
        if (name === 'history-tabs-island') {
          const root = el.querySelector('[data-testid="history-tabs-root"]');
          if (root) {
            const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
            const panels = {
              text: root.querySelector('[data-panel="text"]'),
              metadata: root.querySelector('[data-panel="metadata"]'),
              similar: root.querySelector('[data-panel="similar"]')
            };
            const setActive = (id) => {
              tabs.forEach((t) => {
                const tid = t.getAttribute('data-testid')?.replace('tab-', '');
                const active = tid === id;
                t.setAttribute('aria-selected', active ? 'true' : 'false');
              });
              Object.entries(panels).forEach(([key, panel]) => {
                if (!panel) return;
                panel.style.display = key === id ? '' : 'none';
                panel.setAttribute('aria-hidden', key === id ? 'false' : 'true');
              });
            };
            tabs.forEach((t) => {
              const tid = t.getAttribute('data-testid')?.replace('tab-', '');
              if (!tid) return;
              t.addEventListener('click', () => setActive(tid));
            });
            setActive('text');

            // Keyboard navigation for non-hydrated environments (JSDOM/test runtime)
            // Supports ArrowLeft / ArrowRight and a deterministic test hook event `history-tabs:navigate`.
            root.addEventListener('keydown', function (e) {
              const key = (e && (e.key || e.keyCode || e.which));
              const idx = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
              if (!tabs || tabs.length === 0) return;
              if (key === 'ArrowRight' || key === 39) {
                const next = tabs[(idx + 1) % tabs.length];
                if (next) {
                  const id = next.getAttribute('data-testid')?.replace('tab-', '');
                  setActive(id);
                  try { next.focus && next.focus(); } catch(e){}
                }
              } else if (key === 'ArrowLeft' || key === 37) {
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                if (prev) {
                  const id = prev.getAttribute('data-testid')?.replace('tab-', '');
                  setActive(id);
                  try { prev.focus && prev.focus(); } catch(e){}
                }
              }
            });

            window.addEventListener('history-tabs:navigate', function (ev) {
              const d = (ev && ev.detail) || {};
              if (!d || !d.dir) return;
              const idx = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
              if (d.dir === 'right') {
                const next = tabs[(idx + 1) % tabs.length];
                if (next) {
                  const id = next.getAttribute('data-testid')?.replace('tab-', '');
                  setActive(id);
                  try { next.focus && next.focus(); } catch(e){}
                }
              } else if (d.dir === 'left') {
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                if (prev) {
                  const id = prev.getAttribute('data-testid')?.replace('tab-', '');
                  setActive(id);
                  try { prev.focus && prev.focus(); } catch(e){}
                }
              }
            });

            const gpuInit = root.querySelector('[data-testid="gpu-initializing"]');
            const resultsEl = root.querySelector('[data-testid="similar-results"]');
            const emptyEl = root.querySelector('[data-testid="similar-empty"]');

            const handleSearch = async (detail) => {
              const imageBase64 = detail && detail.imageBase64;
              if (!imageBase64) return;
              setActive('similar');
              if (gpuInit) gpuInit.style.display = 'none';
              if (resultsEl) {
                resultsEl.style.display = 'none';
                resultsEl.textContent = '';
              }
              if (emptyEl) emptyEl.style.display = 'none';

              if (typeof fetch !== 'function') {
                if (resultsEl) {
                  resultsEl.style.display = '';
                  resultsEl.textContent = 'Search unavailable';
                }
                return;
              }

              try {
                const res = await fetch('/api/visual-rag/search/visual', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    image: imageBase64,
                    collection: detail.collection || 'visual_pages',
                    k: 5
                  })
                });

                if (res.status === 503) {
                  const data = await res.json().catch(() => ({}));
                  if (data.type === 'SIDECAR_INITIALIZING') {
                    if (gpuInit) gpuInit.style.display = '';
                    return;
                  }
                  throw new Error(data.error || 'Service unavailable');
                }

                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || `Search failed (${res.status})`);
                }

                const data = await res.json().catch(() => ({}));
                const results = Array.isArray(data.results) ? data.results : [];
                if (resultsEl) {
                  resultsEl.style.display = '';
                  resultsEl.textContent = `${results.length} similar documents`;
                }
                if (emptyEl) emptyEl.style.display = results.length ? 'none' : '';
              } catch {
                if (resultsEl) {
                  resultsEl.style.display = '';
                  resultsEl.textContent = 'Search failed';
                }
              }
            };

            const win = (typeof window !== 'undefined') ? window : null;
            if (win && typeof win.addEventListener === 'function') {
              win.addEventListener('visual-search-requested', (e) => {
                handleSearch(e.detail || {});
              });
            }
          }
        }

        if (name === 'overlay-viewer-island') {
          const root = el.querySelector('[data-testid="overlay-viewer-root"]');
          if (root) {
            const pageEl = root.querySelector('[data-testid="overlay-page-indicator"]');
            const img = root.querySelector('img[data-testid="document-image"]');
            const prev = root.querySelector('[data-testid="overlay-prev-page"]');
            const next = root.querySelector('[data-testid="overlay-next-page"]');

            const dispatchOverlayChange = (pageNum) => {
              const propsRaw = el.getAttribute('data-props') || '{}';
              let props = {};
              try { props = JSON.parse(propsRaw); } catch { props = {}; }
              const docId = props.documentId || null;
              const original = props.originalUrl || props.original_url || '';

              // Ensure CustomEvent is constructed on the page's window (JSDOM requires window.CustomEvent instances)
              let ev;
              if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
                ev = new window.CustomEvent('overlay:document-changed', { detail: { documentId: docId, page: pageNum, originalUrl: original } });
              } else {
                ev = new CustomEvent('overlay:document-changed', { detail: { documentId: docId, page: pageNum, originalUrl: original } });
              }

              window.dispatchEvent(ev);
            };

            if (prev) prev.addEventListener('click', () => {
              const m = (pageEl.textContent || '').match(/(\d+)/g);
              const cur = m ? Number(m[0]) : 1;
              const nextPage = Math.max(1, cur - 1);
              if (pageEl) pageEl.textContent = 'Page ' + nextPage;
              dispatchOverlayChange(nextPage);
            });

            if (next) next.addEventListener('click', () => {
              const m = (pageEl.textContent || '').match(/(\d+)/g);
              const cur = m ? Number(m[0]) : 1;
              const nextPage = cur + 1;
              // If attached props contained pageCount, respect it
              try {
                const propsRaw = el.getAttribute('data-props') || '{}';
                const props = JSON.parse(propsRaw);
                if (props.pageCount && nextPage > props.pageCount) return;
              } catch { /* ignore */ }
              if (pageEl) pageEl.textContent = 'Page ' + nextPage;
              dispatchOverlayChange(nextPage);
            });

            if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
              window.addEventListener('overlay:document-changed', (e) => {
                const d = (e && e.detail) || {};
                if (pageEl && d.page !== undefined && d.page !== null) pageEl.textContent = 'Page ' + d.page + (d.pageCount ? ' of ' + d.pageCount : '');

                // Set a test-visible attribute for original url (accepts camelCase or snake_case)
                const resolvedOriginal = d.originalUrl || d.original_url || '';
                root.setAttribute('data-original-url', resolvedOriginal);

                // Update inline image src if present (runtime browser fallback for tests)
                if (img) {
                  let src = '';
                  if (resolvedOriginal) src = resolvedOriginal + (resolvedOriginal.includes('?') ? '&' : '?') + 'page=' + (d.page || 1);
                  else if (d.documentId) src = '/documents/' + d.documentId + '/download/original/?page=' + (d.page || 1);
                  if (src) img.src = src;
                }
              });
            }
          }
        }
      } catch{ /* best-effort */ }

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
