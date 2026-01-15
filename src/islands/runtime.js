const { z } = require('zod');

// Runtime Zod schemas (keep in sync with src/ui/contracts/*.ts)
const AnnotationSchema = z.object({
  label: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  note: z.string().optional(),
});

const VisualAnnotationSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().nonnegative(),
  annotations: z.array(AnnotationSchema).min(1),
});

const FeedbackControlsSchema = z.object({
  documentId: z.number().int().nullable(),
  components: z.array(z.object({ component: z.string(), feedback_type: z.union([z.literal('thumbs_up'), z.literal('thumbs_down')]) })),
});

const ManualEditorSchema = z.object({
  documentId: z.number().int().nullable(),
  metadata: z.record(z.any()).optional(),
  content: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), value: z.any() })).optional(),
});

const HistoryTabsSchema = z.object({
  documentId: z.number().int().nullable(),
  content: z.string().optional(),
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

// Default placeholder renderers (can be overridden via registerIsland)
const defaultRenderers = {
  'visual-annotation-island': (el) => {
    el.innerHTML = `\n      <div data-testid="visual-annotation-island-root">\n        <!-- Visual Annotation Island (runtime placeholder) -->\n        <button data-testid="draw-toggle">Draw Mode</button>\n        <div data-testid="annotation-canvas">(canvas placeholder)</div>\n      </div>\n    `;
  },
  'feedback-controls-island': (el) => {
    el.innerHTML = `\n      <div data-testid="feedback-controls-island-root" role="group" aria-label="Feedback Controls">\n        <button data-testid="thumbs-up-tags" aria-pressed="false">👍 Tags</button>\n        <button data-testid="thumbs-down-tags" aria-pressed="false">👎 Tags</button>\n      </div>\n      <script>\n        (function(){\n          try {\n            const root = document.currentScript.parentElement.querySelector('[data-testid="feedback-controls-island-root"]');\n            if (!root) return;\n            const up = root.querySelector('[data-testid="thumbs-up-tags"]');\n            const down = root.querySelector('[data-testid="thumbs-down-tags"]');\n            if (up) up.addEventListener('click', () => { up.setAttribute('aria-pressed', (up.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false'); down.setAttribute('aria-pressed', 'false'); document.dispatchEvent(new CustomEvent('feedback:updated', { detail: { component: 'tags', feedback_type: 'thumbs_up' } })); });\n            if (down) down.addEventListener('click', () => { down.setAttribute('aria-pressed', (down.getAttribute('aria-pressed') !== 'true') ? 'true' : 'false'); up.setAttribute('aria-pressed', 'false'); document.dispatchEvent(new CustomEvent('feedback:updated', { detail: { component: 'tags', feedback_type: 'thumbs_down' } })); });\n          } catch(e){ console.warn('feedback-controls-island runtime setup failed', e); }\n        })();\n      </script>\n    `;
  },
  'manual-editor-island': (el) => {
    el.innerHTML = `\n      <div data-testid="manual-editor-island-root">\n        <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">\n          <button role="tab" data-testid="tab-metadata" aria-selected="true">Metadata</button>\n          <button role="tab" data-testid="tab-content" aria-selected="false">Content</button>\n          <button role="tab" data-testid="tab-fields" aria-selected="false">Fields</button>\n        </div>\n        <div id="manual-editor-panel">\n          <div data-panel="metadata">\n            <label>Title <input data-testid="manual-title-input" type="text"/></label>\n          </div>\n          <div data-panel="content" style="display:none">\n            <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>\n          </div>\n          <div data-panel="fields" style="display:none">\n            <div><input data-testid="field-name-0" placeholder="Field name"/><input data-testid="field-value-0" placeholder="Field value"/></div>\n          </div>\n        </div>\n        <div style="margin-top:8px">\n          <button data-testid="manual-save-btn">Save</button>\n        </div>\n      </div>\n      <script>\n        (function(){\n          try {\n            const root = document.currentScript.parentElement.querySelector('[data-testid="manual-editor-island-root"]');\n            if (!root) return;\n            const tabs = Array.from(root.querySelectorAll('[role="tab"]'))||[];\n            const panels = Array.from(root.querySelectorAll('[data-panel]'))||[];\n            function setActive(idx){\n              tabs.forEach((t,i)=>{ t.setAttribute('aria-selected', i===idx ? 'true' : 'false'); });\n              panels.forEach((p,i)=>{ p.style.display = i===idx ? '' : 'none'; });\n            }\n            tabs.forEach((t,i)=>{ t.addEventListener('click', ()=> setActive(i)); t.addEventListener('keydown', (e)=>{ if(e.key==='ArrowLeft'){ setActive((i+tabs.length-1)%tabs.length); } if(e.key==='ArrowRight'){ setActive((i+1)%tabs.length); }}); });\n            const save = root.querySelector('[data-testid="manual-save-btn"]');\n            if (save) save.addEventListener('click', ()=>{\n              const payload = { documentId: (root.closest('[data-props]') && JSON.parse(root.closest('[data-props]').getAttribute('data-props')||'{}').documentId) || null, metadata:{}, content:'', fields:[] };\n              const title = root.querySelector('[data-testid="manual-title-input"]'); if(title) payload.metadata.title = title.value||'';\n              const content = root.querySelector('[data-testid="manual-content-input"]'); if(content) payload.content = content.value||'';\n              // collect simple single field row
              const fname = root.querySelector('[data-testid="field-name-0"]'); const fval = root.querySelector('[data-testid="field-value-0"]');\n              if(fname && fname.value) payload.fields.push({ name: fname.value, value: fval ? fval.value : '' });\n              document.dispatchEvent(new CustomEvent('payload:ready', { detail: payload }));\n            });\n          } catch(e){ console.warn('manual-editor-island runtime setup failed', e); }\n        })();\n      </script>\n    `;
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
    } catch (err) {
      console.error(`island-runtime: error rendering island '${name}'`, err && err.stack ? err.stack : err);
    }
  });
}

module.exports = {
  mountIslands,
  registerIsland,
  _registry: registry, // exported for tests
  _schemas: schemaMap,
};
