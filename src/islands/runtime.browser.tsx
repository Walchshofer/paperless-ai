import { h, render } from 'preact';
import VisualAnnotationIsland from './VisualAnnotationIsland';
import FeedbackControlsIsland from './FeedbackControlsIsland';
import ManualEditorIsland from './ManualEditorIsland';
import HistoryTabsIsland from './HistoryTabsIsland';
import OverlayViewerIsland from './OverlayViewerIsland';
import VisualOverlaysIsland from './VisualOverlaysIsland';
import PlaygroundIsland from './PlaygroundIsland';
import ShadcnCompat from './shadcn-compat';
import OverviewDashboardIsland from './OverviewDashboardIsland';
import SettingsSidebarIsland from './SettingsSidebarIsland';
import ConnectionSettingsIsland from './ConnectionSettingsIsland';
import AIProviderIsland from './AIProviderIsland';
import ExpertModelsIsland from './ExpertModelsIsland';
import RestartBannerIsland from './RestartBannerIsland';
import DeveloperSettingsIsland from './DeveloperSettingsIsland';
import PresetsManagerIsland from './PresetsManagerIsland';
import ViewModeToggleIsland from './ViewModeToggleIsland';
import TagsManagerIsland from './TagsManagerIsland';
import AIAnalysisIsland from './AIAnalysisIsland';
import ChatWorkspaceIsland from './ChatWorkspaceIsland';
import HistoryManagerIsland from './HistoryManagerIsland';
import ManualWorkspaceIsland from './ManualWorkspaceIsland';
import DocumentContentIsland from './DocumentContentIsland';
$1
import UnifiedWorkspaceIsland from './UnifiedWorkspaceIsland';
import DocumentContextBarIsland from './DocumentContextBarIsland';
import ContextSidebarIsland from './ContextSidebarIsland';

type IslandComponent = (props: any) => JSX.Element;

type IslandRegistry = Record<string, IslandComponent>;

const registry: IslandRegistry = {
  'visual-annotation-island': VisualAnnotationIsland,
  'feedback-controls-island': FeedbackControlsIsland,
  'manual-editor-island': ManualEditorIsland,
  'history-tabs-island': HistoryTabsIsland,
  'overlay-viewer-island': OverlayViewerIsland,
  'visual-overlays-island': VisualOverlaysIsland,
  'playground-island': PlaygroundIsland,
  'shadcn-compat': ShadcnCompat,
  'overview-dashboard-island': OverviewDashboardIsland,
  'settings-sidebar-island': SettingsSidebarIsland,
  'connection-settings-island': ConnectionSettingsIsland,
  'ai-provider-island': AIProviderIsland,
  'expert-models-island': ExpertModelsIsland,
  'restart-banner-island': RestartBannerIsland,
  'developer-settings-island': DeveloperSettingsIsland,
  'presets-manager-island': PresetsManagerIsland,
  'view-mode-toggle-island': ViewModeToggleIsland,
  'tags-manager-island': TagsManagerIsland,
  'ai-analysis-island': AIAnalysisIsland,
  'chat-workspace-island': ChatWorkspaceIsland,
  'history-manager-island': HistoryManagerIsland,
  'manual-workspace-island': ManualWorkspaceIsland,
  'document-content-island': DocumentContentIsland,
  $1
  'unified-workspace-island': UnifiedWorkspaceIsland,
  'document-context-bar-island': DocumentContextBarIsland,
  'context-sidebar-island': ContextSidebarIsland,
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
