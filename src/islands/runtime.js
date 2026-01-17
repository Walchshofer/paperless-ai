const { z } = require('zod');

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
    metadata: z.record(z.any()).optional(),
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
  metadata: z.record(z.any()).optional(),
  content: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), value: z.any() })).optional(),
  annotations: z.array(AnnotationSchema).optional(),
});

const SyncFailedEventSchema = z.object({
  type: z.literal('sync:failed'),
  documentId: z.union([z.string(), z.number().int()]).nullable().optional(),
  error: z.string(),
  timestamp: z.number().optional(),
});

// Event schema registry for both-side validation
const eventSchemaMap = {
  'annotation:created': AnnotationCreatedEventSchema,
  'visual-search:trigger': VisualSearchTriggerEventSchema,
  'feedback:confirmed': FeedbackConfirmedEventSchema,
  'feedback:updated': FeedbackUpdatedEventSchema,
  'payload:ready': PayloadReadyEventSchema,
  'sync:failed': SyncFailedEventSchema,
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

const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
});

const schemaMap = {
  'visual-annotation-island': VisualAnnotationSchema,
  'feedback-controls-island': FeedbackControlsSchema,
  'manual-editor-island': ManualEditorSchema,
  'history-tabs-island': HistoryTabsSchema,
  'overlay-viewer-island': OverlayViewerSchema,
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
      <div data-testid="visual-annotation-island-root" style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
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
              document.dispatchEvent(createCustomEvent('feedback:confirmed', {
                ...ann,
                documentId: props.documentId || null,
                page: props.page || null,
                bbox
              }));
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

    el.innerHTML = `\n      <div data-testid="feedback-controls-island-root" role="group" aria-label="Feedback Controls">\n        ${rows}\n      </div>\n      <script>\n        (function(){\n          try {\n            const root = document.currentScript.parentElement.querySelector('[data-testid="feedback-controls-island-root"]');\n            if (!root) return;\n            const ups = Array.from(root.querySelectorAll('[data-testid^="thumbs-up-"]'));
            const downs = Array.from(root.querySelectorAll('[data-testid^="thumbs-down-"]'));
            ups.forEach(u => {\n              u.addEventListener('click', ()=>{\n                const name = u.getAttribute('data-testid').replace('thumbs-up-','');\n                u.setAttribute('aria-pressed', (u.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');\n                const d = root.querySelector("[data-testid=\"thumbs-down-\${name}\"]"); if (d) d.setAttribute('aria-pressed','false');\n                document.dispatchEvent(createCustomEvent('feedback:updated', { component: name, feedback_type: 'thumbs_up' }));\n                document.dispatchEvent(createCustomEvent('feedback:confirmed', { component: name, documentId: (root.closest('[data-props]') && JSON.parse(root.closest('[data-props]').getAttribute('data-props')||'{}').documentId) || null }));\n              });\n            });\n            downs.forEach(d => {\n              d.addEventListener('click', ()=>{\n                const name = d.getAttribute('data-testid').replace('thumbs-down-','');\n                d.setAttribute('aria-pressed', (d.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');\n                const u = root.querySelector("[data-testid=\"thumbs-up-\${name}\"]"); if (u) u.setAttribute('aria-pressed','false');\n                document.dispatchEvent(createCustomEvent('feedback:updated', { component: name, feedback_type: 'thumbs_down' }));\n              });\n            });\n          } catch(e){ console.warn('feedback-controls-island runtime setup failed', e); }\n        })();\n      </script>\n    `;
  },
  'manual-editor-island': (el) => {
    el.innerHTML = `
      <div data-testid="manual-editor-island-root">
        <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">
          <button role="tab" data-testid="tab-metadata" aria-selected="true">Metadata</button>
          <button role="tab" data-testid="tab-content" aria-selected="false">Content</button>
          <button role="tab" data-testid="tab-fields" aria-selected="false">Fields</button>
        </div>
        <div id="manual-editor-panel">
          <div data-panel="metadata">
            <label>Title <input data-testid="manual-title-input" type="text"/></label>
          </div>
          <div data-panel="content" style="display:none">
            <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>
          </div>
          <div data-panel="fields" style="display:none">
            <div><input data-testid="field-name-0" placeholder="Field name"/><input data-testid="field-value-0" placeholder="Field value"/></div>
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
    el.innerHTML = `\n      <div data-testid="history-tabs-root">\n        <button data-testid="tab-text">Text</button>\n        <button data-testid="tab-metadata">Metadata</button>\n        <button data-testid="tab-similar">Similar</button>\n        <div data-testid="similar-results">(results placeholder)</div>\n      </div>\n    `;
  },
  'overlay-viewer-island': (el) => {
    el.innerHTML = `\n      <div data-testid="overlay-viewer-root">\n        <div id="overlayContainer" data-testid="overlay-container">(image placeholder)</div>\n        <div id="overlayLoading" data-testid="overlay-loading" class="hidden">Loading...</div>\n      </div>\n    `;
  }
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
                document.dispatchEvent(createCustomEvent('feedback:updated', { component: nm, feedback_type: 'thumbs_up' }));
                // emit confirmation for thumbs up
                const propsRaw = el.getAttribute('data-props') || '{}';
                let props = {};
                try { props = JSON.parse(propsRaw); } catch{ props = {}; }
                document.dispatchEvent(createCustomEvent('feedback:confirmed', { component: nm, documentId: props.documentId || null }));
              });
            });
            downs.forEach((d) => {
              d.addEventListener('click', () => {
                const nm = d.getAttribute('data-testid').replace('thumbs-down-','');
                d.setAttribute('aria-pressed', (d.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false');
                const u = root.querySelector(`[data-testid="thumbs-up-${nm}"]`);
                if (u) u.setAttribute('aria-pressed','false');
                document.dispatchEvent(createCustomEvent('feedback:updated', { component: nm, feedback_type: 'thumbs_down' }));
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

              document.dispatchEvent(createCustomEvent('payload:ready', payload));

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
                    document.dispatchEvent(createCustomEvent('sync:success', { documentId: props.documentId, ...result }));
                  } else {
                    const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
                    throw new Error(errorData.message || `Sync failed with status ${res.status}`);
                  }
                }
              } catch (err) {
                document.dispatchEvent(createCustomEvent('sync:failed', { documentId: props.documentId, error: err.message || 'Sync failed' }));
              }
            });
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
      document.dispatchEvent(createCustomEvent(eventName, result.data));
      return true;
    }
    // No schema defined - dispatch without validation
    document.dispatchEvent(createCustomEvent(eventName, detail));
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
    document.addEventListener(eventName, handler);
    return () => document.removeEventListener(eventName, handler);
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
