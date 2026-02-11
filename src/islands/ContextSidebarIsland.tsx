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

  // Local state for document data to support inline switching
  const [currentDocument, setCurrentDocument] = useState(props.document);
  const [currentVisual, setCurrentVisual] = useState(props.visual);
  const [currentChat, setCurrentChat] = useState(props.chat);

  // Update local state when props change (initial load)
  useEffect(() => {
    setCurrentDocument(props.document);
    setCurrentVisual(props.visual);
    setCurrentChat(props.chat);
  }, [props.document, props.visual, props.chat]);

  // Listen for document switch events from DocumentContextBarIsland
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const docData = detail.document;
      if (!docData) return;

      console.info('[ContextSidebarIsland] Handling workspace:document-switched for doc:', docData.id);

      // Map API response to DocumentInfo interface
      const updatedDoc: DocumentInfo = {
        id: docData.id,
        title: docData.title,
        correspondent: docData.correspondent,
        content: docData.content || '',
        documentDomain: docData.documentDomain,
        tagItems: docData.tagItems,
        availableTags: docData.availableTags,
        fieldProfile: docData.fieldProfile,
        customFields: docData.customFields || [],
      };

      setCurrentDocument(updatedDoc);
      
      // Update visual info if provided in the switch event
      if (detail.visual) {
        setCurrentVisual(detail.visual);
      } else {
        // Reset or fetch visual data for the new document if not in detail
        // For now, if not provided, we might want to clear or keep as is.
        // Usually DocumentContextBarIsland only sends 'document' in detail.
        // We might need to fetch visual data separately if it's not in docData.
        setCurrentVisual({ fields: [], overlays: [] });
      }

      if (detail.chat) {
        setCurrentChat(detail.chat);
      }
    };

    window.addEventListener('workspace:document-switched', handler as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handler as EventListener);
  }, []);

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
    <div data-testid="context-sidebar-root" data-hydrated="true" className="h-full flex flex-col bg-white dark:bg-slate-950">
      {/* Precision Tab Interface */}
      <div role="tablist" aria-label="Context Sidebar Tabs" className="flex bg-slate-50 dark:bg-slate-900/50 p-1.5 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            aria-controls={`panel-${t.key}`}
            title={tabTooltips[t.key]}
            data-testid={t.testid}
            ref={(el: HTMLButtonElement | null) => { tabRefs.current[t.key] = el; }}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200 group ${
              activeTab === t.key 
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/30'
            }`}
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
            <i className={`fas ${t.icon} text-xs mb-1 transition-transform group-hover:scale-110`}></i>
            <span className="text-[9px] font-black uppercase tracking-widest">{t.label.split(' ')[0]}</span>
            {activeTab === t.key && (
              <div className="mt-1.5 w-4 h-0.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 overflow-auto flex-1 custom-scrollbar">
        {activeTab === 'metadata' && (
          <div role="tabpanel" id="panel-metadata" aria-labelledby="tab-metadata" data-testid="tab-panel-metadata">
            <div className="mb-6 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/30 bg-cyan-50/30 dark:bg-cyan-900/10 flex items-center gap-3" data-testid="panel-header-metadata">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-200 dark:border-cyan-800">
                <i className="fas fa-wand-magic-sparkles text-xs text-cyan-600 dark:text-cyan-400"></i>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Intelligent Extraction</h4>
                <p className="text-[9px] font-bold text-cyan-600/70 dark:text-cyan-400/70 uppercase">AI-assisted metadata synchronization active</p>
              </div>
            </div>
            <SmartMetadataIsland
              documentId={currentDocument?.id}
              metadata={currentDocument}
              selectedTags={currentDocument?.tagItems}
              availableTags={currentDocument?.availableTags}
              customFields={currentDocument?.customFields}
              visualFields={currentVisual?.fields}
              fieldProfile={currentDocument?.fieldProfile}
              documentDomain={currentDocument?.documentDomain}
            />
          </div>
        )}

        {activeTab === 'content' && (
          <div role="tabpanel" id="panel-content" aria-labelledby="tab-content" data-testid="tab-panel-content">
            <div className="mb-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center gap-3" data-testid="panel-header-content">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                <i className="fas fa-file-lines text-xs text-indigo-600 dark:text-indigo-400"></i>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">OCR Transcript</h4>
                <p className="text-[9px] font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase">Immutable Tesseract extraction layer</p>
              </div>
            </div>
            <DocumentContentIsland documentId={currentDocument?.id} content={currentDocument?.content || ''} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" data-testid="tab-panel-chat" className="h-full">
            <ChatWorkspaceIsland documents={props.availableDocuments || []} openDocumentId={currentDocument?.id} {...currentChat} />
          </div>
        )}

        {activeTab === 'visual' && (
          <div role="tabpanel" id="panel-visual" aria-labelledby="tab-visual" data-testid="tab-panel-visual">
            <div className="mb-6 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10 flex items-center gap-3" data-testid="panel-header-visual">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                <i className="fas fa-draw-polygon text-xs text-amber-600 dark:text-amber-400"></i>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Spatial Labeling</h4>
                <p className="text-[9px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase">Visual overlay and field mapping interface</p>
              </div>
            </div>
            <VisualTabIsland
              documentId={currentDocument?.id}
              fields={currentVisual?.fields}
              overlays={currentVisual?.overlays}
            />
          </div>
        )}

        {activeTab === 'debug' && isAdmin && (
          <div role="tabpanel" id="panel-debug" aria-labelledby="tab-debug" data-testid="tab-panel-debug">
             <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <i className="fas fa-bug text-xs text-slate-600 dark:text-slate-400"></i>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">System Telemetry</h4>
                <p className="text-[9px] font-bold text-slate-600/70 dark:text-slate-400/70 uppercase">Raw state visualization for diagnostics</p>
              </div>
            </div>
            <pre className="text-[10px] font-mono whitespace-pre-wrap text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800" data-testid="debug-content">
              {JSON.stringify({ document: currentDocument, chat: currentChat, visual: currentVisual }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
