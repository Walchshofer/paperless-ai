const { z } = require('zod');

// Runtime Zod schemas (keep in sync with src/ui/contracts/*.ts)
const AnnotationSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  comment: z.string().optional(),
  page: z.number().int().optional(),
});

const VisualAnnotationSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  initialAnnotations: z.array(AnnotationSchema).optional(),
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
  'visual-annotation-island': (el, props) => {
    el.innerHTML = `\n      <div data-testid="visual-annotation-island-root">\n        <!-- Visual Annotation Island (runtime placeholder) -->\n        <button data-testid="draw-toggle">Draw Mode</button>\n        <div data-testid="annotation-canvas">(canvas placeholder)</div>\n      </div>\n    `;
  },
  'feedback-controls-island': (el, props) => {
    el.innerHTML = `\n      <div data-testid="feedback-controls-island-root">\n        <button data-testid="thumbs-up-tags">👍 Tags</button>\n        <button data-testid="thumbs-down-tags">👎 Tags</button>\n      </div>\n    `;
  },
  'manual-editor-island': (el, props) => {
    el.innerHTML = `\n      <div data-testid="manual-editor-island-root">\n        <div data-testid="tab-metadata">Metadata Tab</div>\n        <div data-testid="tab-content">Content Tab</div>\n        <div data-testid="tab-fields">Fields Tab</div>\n        <button data-testid="manual-save-btn">Save</button>\n      </div>\n    `;
  },
  'history-tabs-island': (el, props) => {
    el.innerHTML = `\n      <div data-testid="history-tabs-root">\n        <button data-testid="tab-text">Text</button>\n        <button data-testid="tab-metadata">Metadata</button>\n        <button data-testid="tab-similar">Similar</button>\n        <div data-testid="similar-results">(results placeholder)</div>\n      </div>\n    `;
  },
  'overlay-viewer-island': (el, props) => {
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
