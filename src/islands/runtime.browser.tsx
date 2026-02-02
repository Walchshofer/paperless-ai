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
import DashboardChartsIsland from './DashboardChartsIsland';
import type { DashboardMetrics } from './DashboardChartsIsland';
import DocumentContextBarIsland from './DocumentContextBarIsland';
import type { DocumentContextBarProps } from './DocumentContextBarIsland';
import ContextSidebarIsland from './ContextSidebarIsland';
import type { HistoryTabsProps } from './HistoryTabsIsland';
import type { OverlayViewerProps } from './OverlayViewerIsland';
import type { ContextSidebarProps } from './ContextSidebarIsland';
import type { VisualAnnotationContract } from '../ui/contracts/VisualAnnotation.contract';
import type { FeedbackControlsContract } from '../ui/contracts/FeedbackControls.contract';
import type { ManualEditorContract } from '../ui/contracts/ManualEditor.contract';
import type { Images, OverlaysByImage } from '../ui/contracts/VisualOverlays.contract';
import type { PlaygroundContract } from '../ui/contracts/Playground.contract';
import type { OverviewDashboard } from '../ui/contracts/Settings.Overview.contract';
import type { SettingsSidebar } from '../ui/contracts/Settings.Sidebar.contract';
import type { ConnectionSettings } from '../ui/contracts/Settings.Connection.contract';
import type { AIProviderSettings } from '../ui/contracts/Settings.AIProvider.contract';
import type { ExpertModelsSettings } from '../ui/contracts/Settings.ExpertModels.contract';
import type { RestartBannerSettings } from '../ui/contracts/Settings.RestartBanner.contract';
import type { DeveloperSettings } from '../ui/contracts/Settings.Developer.contract';
import type { PresetsManagerSettings } from '../ui/contracts/Settings.Presets.contract';
import type { ExportPanelContract } from '../ui/contracts/ExportPanel.contract';
import type { ViewModeToggleContract } from '../ui/contracts/ViewModeToggle.contract';
import type { TagsManagerContract } from '../ui/contracts/TagsManager.contract';
import type { AIAnalysisContract } from '../ui/contracts/AIAnalysis.contract';
import type { ChatWorkspaceContract } from '../ui/contracts/ChatWorkspace.contract';
import type { HistoryManagerContract } from '../ui/contracts/HistoryManager.contract';
import type { ManualWorkspaceContract } from '../ui/contracts/ManualWorkspace.contract';
import type { DocumentContentContract } from '../ui/contracts/DocumentContent.contract';
import type { UnifiedWorkspaceContract } from '../ui/contracts/UnifiedWorkspace.contract';
import type { SmartMetadataContract } from '../ui/contracts/SmartMetadata.contract';

// The registry is intentionally permissive because islands accept many different prop shapes.
// Using `any` here is a pragmatic choice to allow heterogeneous island component types.
 
// Explicit island props map — list every island here so registrations are explicit and discoverable.
// Use `unknown` as a conservative default; gradually replace entries with precise types.
type IslandPropsMap = {
  'visual-annotation-island': Partial<VisualAnnotationContract>;
  'feedback-controls-island': Partial<FeedbackControlsContract>;
  'manual-editor-island': Partial<ManualEditorContract>;
  'history-tabs-island': HistoryTabsProps;
  'overlay-viewer-island': OverlayViewerProps;
  'visual-overlays-island': { documentId?: number | null; images?: Images; overlaysByImage?: OverlaysByImage };
  'playground-island': Partial<PlaygroundContract>;
  'shadcn-compat': {};
  'overview-dashboard-island': Partial<OverviewDashboard>;
  'settings-sidebar-island': Partial<SettingsSidebar>;
  'connection-settings-island': Partial<ConnectionSettings>;
  'ai-provider-island': Partial<AIProviderSettings>;
  'expert-models-island': Partial<ExpertModelsSettings>;
  'restart-banner-island': Partial<RestartBannerSettings>;
  'developer-settings-island': Partial<DeveloperSettings>;
  'presets-manager-island': Partial<PresetsManagerSettings>;
  'export-panel-island': Partial<ExportPanelContract>;
  'view-mode-toggle-island': Partial<ViewModeToggleContract>;
  'tags-manager-island': Partial<TagsManagerContract>;
  'ai-analysis-island': Partial<AIAnalysisContract>;
  'chat-workspace-island': Partial<ChatWorkspaceContract>;
  'history-manager-island': Partial<HistoryManagerContract>;
  'manual-workspace-island': Partial<ManualWorkspaceContract>;
  'document-content-island': Partial<DocumentContentContract>;
  'smart-metadata-island': Partial<SmartMetadataContract> & { documentId?: number | null; saveDelayMs?: number };
  'unified-workspace-island': Partial<UnifiedWorkspaceContract>;
  'dashboard-charts-island': { initialData?: DashboardMetrics | null | undefined };
  'document-context-bar-island': DocumentContextBarProps;
  'context-sidebar-island': ContextSidebarProps;
};

// Runtime component shape (using a lightweight functional type for islands)
// Use a generic functional signature so we can enforce per-island props at compile time without importing Preact internals.

type IslandComponent<P = unknown> = (props: P) => unknown;

type IslandRegistry = Record<string, IslandComponent>;
const registry: IslandRegistry = {};

// Typed registration helper: registers an island and enforces the props type at compile time
export function registerIsland<K extends keyof IslandPropsMap>(
  name: K,
  component: IslandComponent<IslandPropsMap[K]>,
) {
  registry[name as string] = component as IslandComponent<unknown>;
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
registerIsland('dashboard-charts-island', DashboardChartsIsland);
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
