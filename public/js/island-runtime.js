// Minimal browser-friendly island runtime
// This file provides mountIslands/registerIsland for production (no bundler required)
(function(global){
  'use strict';

  const registry = {};

  function registerIsland(name, renderer){
    registry[name] = renderer;
  }

  function mountIslands(container = document){
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

  // expose on window
  global.mountIslands = mountIslands;
  global.islandRuntime = { mountIslands, registerIsland, _registry: registry };

})(window);
