// Minimal browser-friendly island runtime
// This file provides mountIslands for production (no bundler required)
// The actual island components are expected to be registered in the global islandRuntime.registerIsland
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

  /**
   * Registers a new island component renderer.
   * Called by individual island bundles.
   */
  function registerIsland(name, renderer){
    registry[name] = renderer;
  }

  /**
   * Scans the container for [data-island] elements and mounts the registered components.
   */
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
        try { 
          renderer(el, props); 
          el.setAttribute('data-mounted', 'true');
        } catch (err){ console.error('island-runtime: renderer error for', name, err); }
      } else {
        console.warn("island-runtime: no renderer registered for island '" + name + "'. Ensure the island bundle is loaded.");
      }
    });
  }

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