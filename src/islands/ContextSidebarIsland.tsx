import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import SmartMetadataIsland from './SmartMetadataIsland';
import DocumentContentIsland from './DocumentContentIsland';
import ChatWorkspaceIsland from './ChatWorkspaceIsland';
import VisualTabIsland from './VisualTabIsland';

type TabKey = 'metadata' | 'content' | 'chat' | 'visual' | 'debug';

const STORAGE_KEY = 'paperless:context-sidebar.activeTab';

// Declare window augmentation for test-only markers
declare global {
  interface Window {
    __TEST_IS_ADMIN?: boolean;
    __context_sidebar_mounted?: boolean;
  }
}

// SmartField-compatible interface for custom fields passed to SmartMetadataIsland
interface SmartFieldLike {
  id: string | number;
  label?: string;
  value?: string | number | boolean | string[];
  overlayId?: string | null;
  pageNumber?: number | null;
  paperlessMapping?: string | null;
  paperlessField?: string | null;
  mappingConfidence?: number | null;
  matchType?: 'exact' | 'fuzzy' | 'none' | null;
  confidence?: number;
  isMandatory?: boolean;
}

interface TagItem {
  id: number;
  name: string;
  color?: string | null;
}

interface DocumentInfo {
  id?: number;
  title?: string;
  correspondent?: string;
  content?: string;
  documentDomain?: string;
  tagItems?: TagItem[];
  availableTags?: TagItem[];
  fieldProfile?: {
    domain?: string;
    displayName?: string;
    icon?: string;
    requiredFields?: SmartFieldLike[];
    optionalFields?: SmartFieldLike[];
  };
  customFields?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface VisualInfo {
  fields?: Array<{
    id: string;
    label: string;
    isMapped?: boolean;
    overlayId?: string;
    pageNumber?: number;
    confidence?: number;
    paperlessMapping?: string | null;
    paperlessField?: string | null;
    mappingConfidence?: number | null;
    matchType?: 'exact' | 'fuzzy' | 'none' | null;
    value?: string | number | boolean | string[] | null;
  }>;
  overlays?: Array<{
    id: string;
    label: string;
    pageNumber: number;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
}

interface ChatInfo {
  [key: string]: unknown;
}

export interface ContextSidebarProps {
  activeTab?: TabKey;
  isAdmin?: boolean;
  document?: DocumentInfo;
  visual?: VisualInfo;
  chat?: ChatInfo;
  availableDocuments?: Array<{ id: number; title: string }>;
}

export default function ContextSidebarIsland(props: ContextSidebarProps) {
  const initial = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem(STORAGE_KEY)) || props.activeTab || 'metadata';
  const [activeTab, setActiveTab] = useState(initial as TabKey);

  // Refs for tab buttons so we can set string attributes for ARIA at runtime (axe-friendly)
  const tabRefs = useRef({} as Record<TabKey, HTMLButtonElement | null>);

  // Sync selected state to DOM attributes (string) for accessibility
  useEffect(() => {
    tabs.forEach((t) => {
      const el = tabRefs.current[t.key];
      if (el) {
        el.setAttribute('aria-selected', String(activeTab === t.key));
        el.setAttribute('tabindex', activeTab === t.key ? '0' : '-1');
      }
    });
  }, [activeTab]);

  // Allow tests to override admin state via global for deterministic E2E checks
  const isAdmin = Boolean(props.isAdmin || (typeof window !== 'undefined' && window.__TEST_IS_ADMIN === true));

  useEffect(() => {
    try {
      if (window && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setActiveTab(stored as TabKey);
      }
    } catch (err: unknown) {
      // localStorage may be disabled in some environments (e.g., browser privacy mode)
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[ContextSidebarIsland] Unable to read from localStorage:', msg);
    }
  }, []);

  useEffect(() => {
    try {
      if (window && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, activeTab);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[ContextSidebarIsland] Unable to write to localStorage:', msg);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      window.__context_sidebar_mounted = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[ContextSidebarIsland] Failed to set __context_sidebar_mounted flag:', msg);
    }
  }, []);

  // Tab tooltips for accessibility and UX clarity
  const tabTooltips: Record<TabKey, string> = {
    metadata: 'AI-assisted metadata editing with smart suggestions',
    content: 'View Tesseract OCR extracted text (read-only)',
    chat: 'Chat with AI about documents using RAG or document-specific context',
    visual: 'Label fields and perform visual search',
    debug: 'Developer debugging information'
  };

  const tabs: Array<{ key: TabKey; label: string; icon: string; testid: string }> = [
    { key: 'metadata', label: 'Smart Metadata', icon: 'fa-wand-magic-sparkles', testid: 'tab-metadata' },
    { key: 'content', label: 'OCR Text', icon: 'fa-file-lines', testid: 'tab-content' },
    { key: 'chat', label: 'Chat', icon: 'fa-comments', testid: 'tab-chat' },
    { key: 'visual', label: 'Visual', icon: 'fa-draw-polygon', testid: 'tab-visual' },
  ];

  if (isAdmin) {
    tabs.push({ key: 'debug', label: 'Debug', icon: 'fa-bug', testid: 'tab-debug' });
  }

  return (
    <div data-testid="context-sidebar-root" data-hydrated="true" className="h-full flex flex-col">
      <div role="tablist" aria-label="Context Sidebar Tabs" className="flex border-b border-[#e5e0d8] bg-[#fdfaf6]">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            aria-controls={`panel-${t.key}`}
            title={tabTooltips[t.key]}
            data-testid={t.testid}
            ref={(el: HTMLButtonElement | null) => { tabRefs.current[t.key] = el; }}
            className={`flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium ${activeTab === t.key ? 'border-b-2 border-copper text-copper' : 'text-[#888]'}`}
            onClick={() => setActiveTab(t.key)}
            onKeyDown={(e) => {
               if (e.key === 'ArrowRight') {
                 const idx = tabs.findIndex(x => x.key === t.key);
                 const next = tabs[(idx + 1) % tabs.length];
                 setActiveTab(next.key);
                 tabRefs.current[next.key]?.focus();
               } else if (e.key === 'ArrowLeft') {
                 const idx = tabs.findIndex(x => x.key === t.key);
                 const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                 setActiveTab(prev.key);
                 tabRefs.current[prev.key]?.focus();
               }
            }}
          >
            <i className={`fas ${t.icon} mr-2`}></i>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 overflow-auto flex-1">
        {activeTab === 'metadata' && (
          <div role="tabpanel" id="panel-metadata" aria-labelledby="tab-metadata" data-testid="tab-panel-metadata">
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg" data-testid="panel-header-metadata">
              <p className="text-sm text-purple-800">
                <i className="fas fa-wand-magic-sparkles mr-2"></i>
                AI-powered metadata extraction and suggestions
              </p>
            </div>
            <SmartMetadataIsland
              documentId={props.document?.id}
              metadata={props.document}
              selectedTags={props.document?.tagItems}
              availableTags={props.document?.availableTags}
              customFields={props.document?.customFields}
              visualFields={props.visual?.fields}
              fieldProfile={props.document?.fieldProfile}
              documentDomain={props.document?.documentDomain}
            />
          </div>
        )}

        {activeTab === 'content' && (
          <div role="tabpanel" id="panel-content" aria-labelledby="tab-content" data-testid="tab-panel-content">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg" data-testid="panel-header-content">
              <p className="text-sm text-blue-800">
                <i className="fas fa-file-lines mr-2"></i>
                Tesseract OCR extracted text (read-only)
              </p>
            </div>
            <DocumentContentIsland documentId={props.document?.id} content={props.document?.content || ''} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" data-testid="tab-panel-chat">
            <ChatWorkspaceIsland documents={props.availableDocuments || []} openDocumentId={props.document?.id} {...props.chat} />
          </div>
        )}

        {activeTab === 'visual' && (
          <div role="tabpanel" id="panel-visual" aria-labelledby="tab-visual" data-testid="tab-panel-visual">
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg" data-testid="panel-header-visual">
              <p className="text-sm text-amber-800">
                <i className="fas fa-draw-polygon mr-2"></i>
                Visual field overlay labeling and search
              </p>
            </div>
            <VisualTabIsland
              documentId={props.document?.id}
              fields={props.visual?.fields}
              overlays={props.visual?.overlays}
            />
          </div>
        )}

        {activeTab === 'debug' && isAdmin && (
          <div role="tabpanel" id="panel-debug" aria-labelledby="tab-debug" data-testid="tab-panel-debug">
            <pre className="text-xs whitespace-pre-wrap text-gray-700" data-testid="debug-content">{JSON.stringify({ document: props.document, chat: props.chat, visual: props.visual }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
