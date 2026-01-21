import { h, render } from 'preact';
import VisualAnnotationIsland from './VisualAnnotationIsland';
import FeedbackControlsIsland from './FeedbackControlsIsland';
import ManualEditorIsland from './ManualEditorIsland';
import HistoryTabsIsland from './HistoryTabsIsland';
import OverlayViewerIsland from './OverlayViewerIsland';
import PlaygroundIsland from './PlaygroundIsland';
import ShadcnCompat from './shadcn-compat';

type IslandComponent = (props: any) => JSX.Element;

type IslandRegistry = Record<string, IslandComponent>;

const registry: IslandRegistry = {
  'visual-annotation-island': VisualAnnotationIsland,
  'feedback-controls-island': FeedbackControlsIsland,
  'manual-editor-island': ManualEditorIsland,
  'history-tabs-island': HistoryTabsIsland,
  'overlay-viewer-island': OverlayViewerIsland,
  'playground-island': PlaygroundIsland,
  'shadcn-compat': ShadcnCompat,
};

function parseProps(el: Element): Record<string, any> | null {
  const raw = el.getAttribute('data-props') || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('island-runtime: failed to parse props', err);
    return null;
  }
}

export function registerIsland(name: string, component: IslandComponent) {
  registry[name] = component;
}

export function mountIslands(container: ParentNode = document) {
  if (typeof window !== 'undefined') {
    window.__islandRuntimeMounted = true;
  }
  const nodes = container.querySelectorAll('[data-island]');
  nodes.forEach((el) => {
    const name = el.getAttribute('data-island');
    if (!name) return;

    const Component = registry[name];
    if (!Component) {
      console.warn(`island-runtime: no component for '${name}'`);
      return;
    }

    const props = parseProps(el);
    if (props === null) return;

    render(h(Component, props), el as HTMLElement);
    const host = el as HTMLElement;
    if (host.dataset) {
      host.dataset.mounted = 'true';
    }
    const root = host.querySelector('[data-testid$="-root"]') as HTMLElement | null;
    if (root && !root.getAttribute('data-hydrated')) {
      root.setAttribute('data-hydrated', 'true');
    }
  });
}

if (typeof window !== 'undefined') {
  (window as any).mountIslands = mountIslands;
  (window as any).islandRuntime = {
    mountIslands,
    registerIsland,
    _registry: registry,
  };

  const autoMount = () => {
    if ((window as any).__islandRuntimeMounted) return;
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
