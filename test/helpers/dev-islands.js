// Test-only helper: attach lightweight dev island fallbacks to a document
// Used by unit tests only. Do NOT include this in production templates.

function initDevIslands(doc) {
  const document = doc || (typeof window !== 'undefined' ? window.document : null);
  if (!document) return;

  // Manual Editor skeleton
  document.querySelectorAll('[data-island="manual-editor-island"]').forEach(el => {
    if (!el.querySelector('[data-testid="manual-editor-island-root"]')) {
      el.innerHTML = `
        <div data-testid="manual-editor-island-root">
          <div role="tablist" aria-label="Manual Editor Tabs" style="display:flex;gap:8px;margin-bottom:8px">
            <button role="tab" data-testid="tab-metadata" aria-selected="true">Metadata</button>
            <button role="tab" data-testid="tab-content" aria-selected="false">Content</button>
            <button role="tab" data-testid="tab-fields" aria-selected="false">Fields</button>
            <button role="tab" data-testid="tab-ai-debug" aria-selected="false">AI Debug</button>
          </div>
          <div id="manual-editor-panel">
            <div data-panel="metadata" data-testid="panel-metadata">
              <label>Title <input data-testid="manual-title-input" type="text"/></label>
            </div>
            <div data-panel="content" data-testid="panel-content" style="display:none">
              <textarea data-testid="manual-content-input" rows="4" style="width:100%"></textarea>
            </div>
            <div data-panel="fields" data-testid="panel-fields" style="display:none">
              <div>
                <input data-testid="field-name-0" placeholder="Field name">
                <input data-testid="field-value-0" placeholder="Field value">
              </div>
            </div>
          </div>
          <div style="margin-top:8px">
            <button data-testid="manual-save-btn">Save</button>
          </div>
        </div>
      `;
    }

    // Wire event listeners so dev fallback mirrors production island behavior (always attempt to wire to current DOM)
    try {
      const root = el.querySelector('[data-testid="manual-editor-island-root"]');
      if (root) {
        const titleInput = root.querySelector('[data-testid="manual-title-input"]');
        const contentInput = root.querySelector('[data-testid="manual-content-input"]');
        const fieldsPanel = root.querySelector('[data-testid="panel-fields"]');

        const onMeta = (e) => {
          const d = e && e.detail ? e.detail : {};
          try { console.log('[dev-islands] onMeta called with', JSON.stringify(d)); } catch (err) { /* ignore */ }
          if (titleInput && d.title !== undefined) {
            titleInput.value = d.title || '';
            // trigger input event so Preact controlled inputs receive the new value
            try { titleInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) { /* ignore */ }
          }
          if (contentInput && d.content !== undefined) {
            contentInput.value = d.content || '';
            try { contentInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) { /* ignore */ }
          }
        };

        const onFields = (e) => {
          const d = e && e.detail ? e.detail : {};
          const fields = Array.isArray(d.fields) ? d.fields : [];
          if (!fieldsPanel) return;
          if (fields.length === 0) {
            fieldsPanel.innerHTML = '<p class="text-gray-500 text-sm">No fields detected. Run Visual Analysis to extract fields.</p>';
            return;
          }
          fieldsPanel.innerHTML = '<div>' + fields.map((f, idx) => `<div><input data-testid="field-name-${idx}" value="${(f.label||f.name||'').replace(/"/g,'&quot;')}" placeholder="Field name"><input data-testid="field-value-${idx}" value="${(f.value||'').toString().replace(/"/g,'&quot;')}" placeholder="Field value"></div>`).join('') + '</div>';
        };

        window.addEventListener('manual:metadata-updated', onMeta);
        window.addEventListener('manual:fields-updated', onFields);
        try { console.log('[dev-islands] wired manual meta/fields listeners for manual-editor'); } catch(e) {}
      }
    } catch (e) { /* ignore dev-only wiring errors */ }
  });

  // Feedback Controls skeleton
  document.querySelectorAll('[data-island="feedback-controls-island"]').forEach(el => {
    if (!el.querySelector('[data-testid="feedback-controls-island-root"]')) {
      el.innerHTML = `
        <div data-testid="feedback-controls-island-root">
          <button data-testid="thumbs-up-tags" aria-pressed="false">👍 Tags</button>
          <button data-testid="thumbs-down-tags" aria-pressed="false">👎 Tags</button>
        </div>
      `;
    }

    try {
      const root = el.querySelector('[data-testid="feedback-controls-island-root"]');
      if (root && !root.dataset.wired) {
        root.dataset.wired = 'true';
        const up = root.querySelector('[data-testid="thumbs-up-tags"]');
        const down = root.querySelector('[data-testid="thumbs-down-tags"]');
        if (up) up.addEventListener('click', () => {
          const current = up.getAttribute('aria-pressed') === 'true';
          up.setAttribute('aria-pressed', (!current).toString());
          if (down) down.setAttribute('aria-pressed', 'false');
          if (typeof document !== 'undefined' && document.dispatchEvent) document.dispatchEvent(new CustomEvent('feedback:updated', { detail:{ component:'tags', feedback_type:'thumbs_up' } }));
        });
        if (down) down.addEventListener('click', () => {
          const current = down.getAttribute('aria-pressed') === 'true';
          down.setAttribute('aria-pressed', (!current).toString());
          if (up) up.setAttribute('aria-pressed', 'false');
          if (typeof document !== 'undefined' && document.dispatchEvent) document.dispatchEvent(new CustomEvent('feedback:updated', { detail:{ component:'tags', feedback_type:'thumbs_down' } }));
        });
      }
    } catch (e) { /* ignore */ }
  });
}

module.exports = { initDevIslands };