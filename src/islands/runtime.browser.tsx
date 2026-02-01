import { h, render } from 'preact';



import VisualAnnotationIsland from './VisualAnnotationIsland';
import FeedbackControlsIsland from './FeedbackControlsIsland';
import ManualEditorIsland from './ManualEditorIsland';
import SmartMetadataIsland from './SmartMetadataIsland';
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
import ExportPanelIsland from './ExportPanelIsland';
import ViewModeToggleIsland from './ViewModeToggleIsland';
import TagsManagerIsland from './TagsManagerIsland';
import AIAnalysisIsland from './AIAnalysisIsland';
import ChatWorkspaceIsland from './ChatWorkspaceIsland';
import HistoryManagerIsland from './HistoryManagerIsland';
import ManualWorkspaceIsland from './ManualWorkspaceIsland';
import DocumentContentIsland from './DocumentContentIsland';
import UnifiedWorkspaceIsland from './UnifiedWorkspaceIsland';
import DocumentContextBarIsland from './DocumentContextBarIsland';
import ContextSidebarIsland from './ContextSidebarIsland';
import type { HistoryTabsProps } from './HistoryTabsIsland';
import type { OverlayViewerProps } from './OverlayViewerIsland';
import type { ContextSidebarProps } from './ContextSidebarIsland';

// The registry is intentionally permissive because islands accept many different prop shapes.
// Using `any` here is a pragmatic choice to allow heterogeneous island component types.
 
// Explicit island props map — list every island here so registrations are explicit and discoverable.
// Use `unknown` as a conservative default; gradually replace entries with precise types.
type IslandPropsMap = {
  'visual-annotation-island': unknown;
  'feedback-controls-island': unknown;
  'manual-editor-island': unknown;
  'history-tabs-island': HistoryTabsProps;
  'overlay-viewer-island': OverlayViewerProps;
  'visual-overlays-island': unknown;
  'playground-island': unknown;
  'shadcn-compat': unknown;
  'overview-dashboard-island': unknown;
  'settings-sidebar-island': unknown;
  'connection-settings-island': unknown;
  'ai-provider-island': unknown;
  'expert-models-island': unknown;
  'restart-banner-island': unknown;
  'developer-settings-island': unknown;
  'presets-manager-island': unknown;
  'export-panel-island': unknown;
  'view-mode-toggle-island': unknown;
  'tags-manager-island': unknown;
  'ai-analysis-island': unknown;
  'chat-workspace-island': unknown;
  'history-manager-island': unknown;
  'manual-workspace-island': unknown;
  'document-content-island': unknown;
  'smart-metadata-island': unknown;
  'unified-workspace-island': unknown;
  'document-context-bar-island': unknown;
  'context-sidebar-island': ContextSidebarProps;
};

import type { ComponentType } from 'preact';

// Runtime component shape (using ComponentType for clearer props typing)
// Use ComponentType<unknown> as a conservative default for heterogeneous islands.
// We also tighten registerIsland below to enforce per-island prop types.

type IslandComponent = ComponentType<unknown>;

type IslandRegistry = Record<string, IslandComponent>;
const registry: IslandRegistry = {};

// Typed registration helper: registers an island and enforces the props type at compile time
export function registerIsland<K extends keyof IslandPropsMap>(
  name: K,
  component: ComponentType<IslandPropsMap[K]>,
) {
  registry[name as string] = component as ComponentType<unknown>;
}

// Register known islands explicitly (use the helper to make registrations discoverable)
registerIsland('visual-annotation-island', VisualAnnotationIsland);
registerIsland('feedback-controls-island', FeedbackControlsIsland);
registerIsland('manual-editor-island', ManualEditorIsland);
registerIsland('history-tabs-island', HistoryTabsIsland);
registerIsland('overlay-viewer-island', OverlayViewerIsland);
registerIsland('visual-overlays-island', VisualOverlaysIsland);
registerIsland('playground-island', PlaygroundIsland);
registerIsland('shadcn-compat', ShadcnCompat);
registerIsland('overview-dashboard-island', OverviewDashboardIsland);
registerIsland('settings-sidebar-island', SettingsSidebarIsland);
registerIsland('connection-settings-island', ConnectionSettingsIsland);
registerIsland('ai-provider-island', AIProviderIsland);
registerIsland('expert-models-island', ExpertModelsIsland);
registerIsland('restart-banner-island', RestartBannerIsland);
registerIsland('developer-settings-island', DeveloperSettingsIsland);
registerIsland('presets-manager-island', PresetsManagerIsland);
registerIsland('export-panel-island', ExportPanelIsland);
registerIsland('view-mode-toggle-island', ViewModeToggleIsland);
registerIsland('tags-manager-island', TagsManagerIsland);
registerIsland('ai-analysis-island', AIAnalysisIsland);
registerIsland('chat-workspace-island', ChatWorkspaceIsland);
registerIsland('history-manager-island', HistoryManagerIsland);
registerIsland('manual-workspace-island', ManualWorkspaceIsland);
registerIsland('document-content-island', DocumentContentIsland);
registerIsland('smart-metadata-island', SmartMetadataIsland);
registerIsland('unified-workspace-island', UnifiedWorkspaceIsland);
registerIsland('document-context-bar-island', DocumentContextBarIsland);
registerIsland('context-sidebar-island', ContextSidebarIsland);

function parseProps(el: Element): Record<string, unknown> | null {
  const raw = el.getAttribute('data-props') || '{}';
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err: unknown) {
    console.warn('island-runtime: failed to parse props', err);
    return null;
  }
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
  const w = window as unknown as Record<string, unknown>;
  w.mountIslands = mountIslands;
  w.islandRuntime = {
    mountIslands,
    registerIsland,
    _registry: registry,
  } as unknown;

  const autoMount = () => {
    if (w.__islandRuntimeMounted) return;
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
