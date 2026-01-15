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
  context: z.object({
    correspondentId: z.number().int().nullable().optional(),
    tagIds: z.array(z.number().int()).optional(),
    page: z.number().int().nonnegative().optional(),
    metadata: z.record(z.any()).optional(),
  }).optional(),
});

const VisualAnnotationSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().nonnegative(),
  // allow mounting with no initial annotations; default to empty array
  annotations: z.array(AnnotationSchema).default([]),
});

const FeedbackControlsSchema = z.object({
  documentId: z.number().int().nullable().optional().default(null),
  components: z.array(z.object({ component: z.string(), feedback_type: z.union([z.literal('thumbs_up'), z.literal('thumbs_down')]) })).optional().default([]),
  // list of available component names for inline rendering (matches UI contract)
  availableComponents: z.array(z.string()).optional().default(['tags']),
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

          const remove = document.createElement('button');
          remove.textContent = 'Remove';
          remove.addEventListener('click', () => {
            annotations.splice(idx,1);
            list.removeChild(container);
            status.textContent = `${annotations.length} annotations`;
          });

          container.appendChild(label);
          container.appendChild(note);
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
    el.innerHTML = `\n      <div data-testid="manual-editor-island-root">\n        <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">\n          <button role="tab" data-testid="tab-metadata" aria-selected="true">Metadata</button>\n          <button role="tab" data-testid="tab-content" aria-selected="false">Content</button>\n          <button role="tab" data-testid="tab-fields" aria-selected="false">Fields</button>\n        </div>\n        <div id="manual-editor-panel">\n          <div data-panel="metadata">\n            <label>Title <input data-testid="manual-title-input" type="text"/></label>\n          </div>\n          <div data-panel="content" style="display:none">\n            <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>\n          </div>\n          <div data-panel="fields" style="display:none">\n            <div><input data-testid="field-name-0" placeholder="Field name"/><input data-testid="field-value-0" placeholder="Field value"/></div>\n          </div>\n        </div>\n        <div style="margin-top:8px">\n          <button data-testid="manual-save-btn">Save</button>\n        </div>\n      </div>\n      <script>\n        (function(){\n          try {\n            const root = document.currentScript.parentElement.querySelector('[data-testid="manual-editor-island-root"]');\n            if (!root) return;\n            const tabs = Array.from(root.querySelectorAll('[role="tab"]'))||[];\n            const panels = Array.from(root.querySelectorAll('[data-panel]'))||[];\n            function setActive(idx){\n              tabs.forEach((t,i)=>{ t.setAttribute('aria-selected', i===idx ? 'true' : 'false'); });\n              panels.forEach((p,i)=>{ p.style.display = i===idx ? '' : 'none'; });\n            }\n            tabs.forEach((t,i)=>{ t.addEventListener('click', ()=> setActive(i)); t.addEventListener('keydown', (e)=>{ if(e.key==='ArrowLeft'){ setActive((i+tabs.length-1)%tabs.length); } if(e.key==='ArrowRight'){ setActive((i+1)%tabs.length); }}); });\n            const save = root.querySelector('[data-testid="manual-save-btn"]');\n            if (save) save.addEventListener('click', ()=>{\n              const payload = { documentId: (root.closest('[data-props]') && JSON.parse(root.closest('[data-props]').getAttribute('data-props')||'{}').documentId) || null, metadata:{}, content:'', fields:[] };\n              const title = root.querySelector('[data-testid="manual-title-input"]'); if(title) payload.metadata.title = title.value||'';\n              const content = root.querySelector('[data-testid="manual-content-input"]'); if(content) payload.content = content.value||'';\n              // collect simple single field row
              const fname = root.querySelector('[data-testid="field-name-0"]'); const fval = root.querySelector('[data-testid="field-value-0"]');\n              if(fname && fname.value) payload.fields.push({ name: fname.value, value: fval ? fval.value : '' });\n              document.dispatchEvent(createCustomEvent('payload:ready', payload));\n            });\n          } catch(e){ console.warn('manual-editor-island runtime setup failed', e); }\n        })();\n      </script>\n    `;
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
            if (save) save.addEventListener('click', ()=>{
              const payload = { documentId: (root.closest('[data-props]') && JSON.parse(root.closest('[data-props]').getAttribute('data-props')||'{}').documentId) || null, metadata:{}, content:'', fields:[] };
              const title = root.querySelector('[data-testid="manual-title-input"]'); if(title) payload.metadata.title = title.value||'';
              const content = root.querySelector('[data-testid="manual-content-input"]'); if(content) payload.content = content.value||'';
              const fname = root.querySelector('[data-testid="field-name-0"]'); const fval = root.querySelector('[data-testid="field-value-0"]');
              if(fname && fname.value) payload.fields.push({ name: fname.value, value: fval ? fval.value : '' });
              document.dispatchEvent(createCustomEvent('payload:ready', payload));
            });
          }
        }
      } catch{ /* best-effort */ }

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
