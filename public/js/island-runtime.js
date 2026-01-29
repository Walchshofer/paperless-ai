// Minimal browser-friendly island runtime
// This file provides mountIslands/registerIsland for production (no bundler required)
(function(global){
  'use strict';

  const registry = {};

  // Self-check: warn if not loaded from expected path (helps debug deployment issues)
  if (typeof document !== 'undefined' && document.currentScript) {
    const src = document.currentScript.src;
    if (src && !src.includes('/js/island-runtime.js') && !src.includes('/js/dist/island-runtime.js')) {
      console.warn('island-runtime: detected loading from unexpected path:', src);
    }
  }

  function registerIsland(name, renderer){
    registry[name] = renderer;
  }

  function mountIslands(container = document){
    if (global) {
      global.__islandRuntimeMounted = true;
    }
    const nodes = container.querySelectorAll('[data-island]');
    nodes.forEach((el) => {
      const name = el.getAttribute('data-island');
      if (!name) return;
      const raw = el.getAttribute('data-props') || '{}';
      let props = {};
      try { props = JSON.parse(raw); } catch(e){ props = {}; }

      const renderer = registry[name];
      if (typeof renderer === 'function'){
        try { renderer(el, props); } catch (err){ console.warn('island-runtime: renderer error for', name, err); }
      } else {
        console.warn("island-runtime: no renderer registered for island '" + name + "'");
      }
    });
  }

  // Default playground-island renderer (lightweight, mirrors server-side helper)
  registerIsland('playground-island', function(el, props){
    const collection = props && props.collection ? props.collection : 'visual_pages';
    const gpuState = props && props.gpuState ? props.gpuState : 'idle';
    el.innerHTML = `
      <div data-testid="playground-island-root" style="font-family: system-ui, sans-serif; padding: 16px;">
        <div style="margin-bottom: 16px;">
          <h1 style="font-size: 1.5rem; font-weight: bold;">Visual RAG Playground</h1>
          <p style="color: #666; font-size: 0.875rem;">Debug Qdrant payloads and visual search</p>
        </div>

        <div data-testid="sidecar-status" style="padding: 8px; background: #f0f9ff; border-left: 4px solid #3b82f6; margin-bottom: 16px;">
          <span style="padding: 2px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 0.75rem;">Checking...</span>
          <span style="margin-left: 8px; color: #666;">Model: ColQwen3-4B-AWQ</span>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1;">
            <label style="display: block; font-weight: 500; margin-bottom: 4px;">Collection</label>
            <select data-testid="collection-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="visual_pages" ${collection === 'visual_pages' ? 'selected' : ''}>visual_pages (320D, Dot)</option>
              <option value="visual_overlays" ${collection === 'visual_overlays' ? 'selected' : ''}>visual_overlays (320D, Cosine)</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-weight: 500; margin-bottom: 4px;">Filter by Doc ID</label>
            <input data-testid="doc-id-filter" type="text" placeholder="e.g., 12345" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 4px;">&nbsp;</label>
            <button data-testid="search-button" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Search</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button data-testid="upload-button" style="padding: 4px 12px; background: #f3f4f6; border: 1px solid #ccc; border-radius: 4px;">Upload Image</button>
              <button data-testid="draw-toggle" aria-pressed="false" style="padding: 4px 12px; background: #f3f4f6; border: 1px solid #ccc; border-radius: 4px;">Draw</button>
            </div>
            <div data-testid="canvas-area" style="height: 300px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; color: #666;">
              Upload an image to begin
            </div>
          </div>
          <div>
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin-bottom: 8px;">
              <div style="font-weight: 500; margin-bottom: 8px;">Search Results</div>
              <div data-testid="search-results" style="color: #666; font-size: 0.875rem;">No results yet</div>
            </div>
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 8px;">
              <div style="font-weight: 500; margin-bottom: 8px;">Payload Inspector</div>
              <div data-testid="payload-inspector" style="color: #666; font-size: 0.875rem;">No payloads to display</div>
            </div>
          </div>
        </div>

        ${gpuState === 'preparing' ? `
        <div data-testid="gpu-preparing-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50;">
          <div style="background: white; padding: 24px; border-radius: 8px; text-align: center;">
            <div style="width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
            <h2 style="font-weight: bold;">GPU Preparing</h2>
            <p style="color: #666;">ColQwen3-4B-AWQ loading...</p>
          </div>
        </div>
        ` : ''}
      </div>
    `;

    // Basic interactivity (search button) - emits a custom event
    try {
      const searchBtn = el.querySelector('[data-testid="search-button"]');
      const collectionEl = el.querySelector('[data-testid="collection-select"]');
      const results = el.querySelector('[data-testid="search-results"]');
      if (searchBtn && collectionEl && results) {
        searchBtn.addEventListener('click', async () => {
          const collection = collectionEl.value;
          results.textContent = 'Searching...';
          // Fire a document-level custom event (consumers can listen)
          const evt = new CustomEvent('playground:search', { detail: { collection } });
          document.dispatchEvent(evt);
          setTimeout(() => { results.textContent = 'No results (demo)'; }, 300);
        });
      }
    } catch (e){ /* best-effort */ }
  });

  // History tabs fallback (E2E-friendly)
  registerIsland('history-tabs-island', function(el, props){
    if (el.dataset && el.dataset.mounted === 'true') return;
    if (el.dataset) el.dataset.mounted = 'true';

    const content = props && props.content ? props.content : '';
    const metadata = props && props.metadata ? props.metadata : {};
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];

    el.innerHTML = `
      <div data-testid="history-tabs-root" class="h-full flex flex-col">
        <div role="tablist" aria-label="Document tabs" class="flex border-b border-gray-200">
          <button role="tab" data-testid="tab-text" aria-selected="true">Text</button>
          <button role="tab" data-testid="tab-metadata" aria-selected="false">Metadata</button>
          <button role="tab" data-testid="tab-similar" aria-selected="false">Similar</button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div role="tabpanel" id="panel-text" data-testid="panel-text">
            ${content ? `<pre class="whitespace-pre-wrap text-sm text-gray-700">${content}</pre>` : `<p class="text-gray-500 italic">No text content available</p>`}
          </div>
          <div role="tabpanel" id="panel-metadata" data-testid="panel-metadata" style="display:none">
            <dl class="space-y-3">
              ${metadata.correspondent ? `<div class="flex justify-between"><dt class="text-sm font-medium text-gray-500">Correspondent</dt><dd class="text-sm text-gray-900">${metadata.correspondent}</dd></div>` : ''}
              ${tags.length ? `<div><dt class="text-sm font-medium text-gray-500 mb-1">Tags</dt><dd class="flex flex-wrap gap-1">${tags.map(tag => `<span class="inline-flex items-center px-2 py-1 text-xs bg-gray-100 rounded">${tag.name || tag.id}</span>`).join('')}</dd></div>` : ''}
              ${metadata.documentType ? `<div class="flex justify-between"><dt class="text-sm font-medium text-gray-500">Document Type</dt><dd class="text-sm text-gray-900">${metadata.documentType}</dd></div>` : ''}
              ${metadata.created ? `<div class="flex justify-between"><dt class="text-sm font-medium text-gray-500">Created</dt><dd class="text-sm text-gray-900">${metadata.created}</dd></div>` : ''}
              ${metadata.modified ? `<div class="flex justify-between"><dt class="text-sm font-medium text-gray-500">Modified</dt><dd class="text-sm text-gray-900">${metadata.modified}</dd></div>` : ''}
            </dl>
          </div>
          <div role="tabpanel" id="panel-similar" data-testid="panel-similar" style="display:none">
            <div data-testid="gpu-initializing" style="display:none" class="flex flex-col items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p class="text-sm text-gray-600">GPU Initializing...</p>
              <p class="text-xs text-gray-400 mt-1">RTX 3090 Ti loading ColQwen3-4B-AWQ</p>
            </div>
            <div data-testid="searching" style="display:none" class="flex flex-col items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p class="text-sm text-gray-600">Searching...</p>
            </div>
            <div data-testid="search-error" style="display:none" class="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700"></div>
            <div data-testid="similar-results" style="display:none" class="text-sm text-gray-600">Results ready</div>
            <div data-testid="similar-empty" class="text-center py-8">
              <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
              <p class="text-sm text-gray-500">Select a region in the document viewer to find similar documents</p>
              <p class="text-xs text-gray-400 mt-2">Results use MaxSim scoring from ColQwen3-4B-AWQ</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const root = el.querySelector('[data-testid="history-tabs-root"]');
    if (!root) return;
    const tabs = {
      text: root.querySelector('[data-testid="tab-text"]'),
      metadata: root.querySelector('[data-testid="tab-metadata"]'),
      similar: root.querySelector('[data-testid="tab-similar"]'),
    };
    const panels = {
      text: root.querySelector('[data-testid="panel-text"]'),
      metadata: root.querySelector('[data-testid="panel-metadata"]'),
      similar: root.querySelector('[data-testid="panel-similar"]'),
    };
    const gpuInit = root.querySelector('[data-testid="gpu-initializing"]');
    const searching = root.querySelector('[data-testid="searching"]');
    const searchError = root.querySelector('[data-testid="search-error"]');
    const similarResults = root.querySelector('[data-testid="similar-results"]');
    const similarEmpty = root.querySelector('[data-testid="similar-empty"]');

    const setActive = (tabId) => {
      Object.keys(tabs).forEach((key) => {
        const isActive = key === tabId;
        const btn = tabs[key];
        const panel = panels[key];
        if (btn) btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (panel) panel.style.display = isActive ? '' : 'none';
      });
    };

    const setSimilarState = (state, message) => {
      if (gpuInit) gpuInit.style.display = state === 'initializing' ? '' : 'none';
      if (searching) searching.style.display = state === 'searching' ? '' : 'none';
      if (searchError) {
        searchError.style.display = state === 'error' ? '' : 'none';
        if (message) searchError.textContent = message;
      }
      if (similarResults) {
        similarResults.style.display = state === 'results' ? '' : 'none';
        if (state === 'results' && message) similarResults.textContent = message;
      }
      if (similarEmpty) {
        similarEmpty.style.display = state === 'empty' ? '' : 'none';
      }
    };

    setActive('text');
    setSimilarState('empty');

    const handleKey = (e, current) => {
      const order = ['text', 'metadata', 'similar'];
      const idx = order.indexOf(current);
      if (e.key === 'ArrowRight') {
        const next = order[(idx + 1) % order.length];
        setActive(next);
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') {
        const prev = order[(idx + order.length - 1) % order.length];
        setActive(prev);
        e.preventDefault();
      }
    };

    if (tabs.text) {
      tabs.text.addEventListener('click', () => setActive('text'));
      tabs.text.addEventListener('keydown', (e) => handleKey(e, 'text'));
    }
    if (tabs.metadata) {
      tabs.metadata.addEventListener('click', () => setActive('metadata'));
      tabs.metadata.addEventListener('keydown', (e) => handleKey(e, 'metadata'));
    }
    if (tabs.similar) {
      tabs.similar.addEventListener('click', () => setActive('similar'));
      tabs.similar.addEventListener('keydown', (e) => handleKey(e, 'similar'));
    }

    const doSearch = async (detail) => {
      if (!detail || !detail.imageBase64) return;
      setActive('similar');
      setSimilarState('searching');
      try {
        const response = await fetch('/api/visual-rag/search/visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: detail.imageBase64,
            collection: detail.collection || 'visual_pages',
            k: 5
          })
        });
        if (response.status === 503) {
          const data = await response.json().catch(() => ({}));
          if (data.type === 'SIDECAR_INITIALIZING') {
            setSimilarState('initializing');
            return;
          }
          setSimilarState('error', data.error || 'Service unavailable');
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setSimilarState('error', data.error || 'Search failed');
          return;
        }
        const data = await response.json().catch(() => ({}));
        const count = Array.isArray(data.results) ? data.results.length : 0;
        if (count > 0) {
          setSimilarState('results', `Found ${count} similar documents`);
        } else {
          setSimilarState('empty');
        }
      } catch (err) {
        setSimilarState('error', err && err.message ? err.message : 'Search failed');
      }
    };

    if (!global.__historyTabsListenerAttached) {
      global.__historyTabsListenerAttached = true;
      window.addEventListener('visual-search-requested', (event) => {
        doSearch(event && event.detail ? event.detail : {});
      });
    }
  });

  // Overlay viewer fallback (E2E-friendly)
  registerIsland('overlay-viewer-island', function(el){
    if (el.dataset && el.dataset.mounted === 'true') return;
    if (el.dataset) el.dataset.mounted = 'true';
    el.innerHTML = `
      <div data-testid="overlay-viewer-root">
        <div data-testid="overlay-container">(image placeholder)</div>
        <div data-testid="overlay-loading" style="display:none">Loading...</div>
      </div>
    `;
  });

  // expose on window
  global.mountIslands = mountIslands;
  global.islandRuntime = { mountIslands, registerIsland, _registry: registry };

  if (typeof document !== 'undefined') {
    const autoMount = () => {
      if (global.__islandRuntimeMounted) return;
      if (!document.querySelector) return;
      if (document.querySelector('[data-island]')) {
        mountIslands(document);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      setTimeout(autoMount, 0);
    }
  }

})(window);
