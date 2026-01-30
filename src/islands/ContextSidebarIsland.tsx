import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import ManualEditorIsland from './ManualEditorIsland';
import DocumentContentIsland from './DocumentContentIsland';
import ChatWorkspaceIsland from './ChatWorkspaceIsland';

type TabKey = 'metadata' | 'content' | 'chat' | 'debug';

const STORAGE_KEY = 'paperless:context-sidebar.activeTab';

export default function ContextSidebarIsland(props: any) {
  const initial = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem(STORAGE_KEY)) || props.activeTab || 'metadata';
  const [activeTab, setActiveTab] = useState<TabKey>(initial as TabKey);

  // Allow tests to override admin state via global for deterministic E2E checks
  const isAdmin = Boolean(props.isAdmin || (typeof window !== 'undefined' && (window as any).__TEST_IS_ADMIN === true));

  useEffect(() => {
    try {
      if (window && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setActiveTab(stored as TabKey);
      }
    } catch (e) {
      // localStorage may be disabled in some environments
    }
  }, []);

  useEffect(() => {
    try {
      if (window && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, activeTab);
      }
    } catch (e) { /* ignore */ }
  }, [activeTab]);

  useEffect(() => {
    try { (window as any).__context_sidebar_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  const tabs: Array<{ key: TabKey; label: string; icon: string; testid: string }> = [
    { key: 'metadata', label: 'Metadata', icon: 'fa-list', testid: 'tab-metadata' },
    { key: 'content', label: 'Content', icon: 'fa-file-text', testid: 'tab-content' },
    { key: 'chat', label: 'Chat', icon: 'fa-comments', testid: 'tab-chat' },
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
            role="tab"
            aria-pressed={activeTab === t.key}
            data-testid={t.testid}
            className={`flex-1 py-3 text-sm font-['Space_Grotesk'] font-medium ${activeTab === t.key ? 'border-b-2 border-copper text-copper' : 'text-[#888]'}`}
            onClick={() => setActiveTab(t.key)}
          >
            <i className={`fas ${t.icon} mr-2`}></i>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 overflow-auto flex-1">
        {activeTab === 'metadata' && (
          <div data-testid="tab-panel-metadata">
            <ManualEditorIsland
              documentId={props.document?.id}
              metadata={props.document}
              content={props.document?.content}
              fields={props.visual?.fields}
            />
          </div>
        )}

        {activeTab === 'content' && (
          <div data-testid="tab-panel-content">
            <DocumentContentIsland documentId={props.document?.id} content={props.document?.content || ''} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div data-testid="tab-panel-chat">
            <ChatWorkspaceIsland documents={props.availableDocuments || []} openDocumentId={props.document?.id} {...props.chat} />
          </div>
        )}

        {activeTab === 'debug' && isAdmin && (
          <div data-testid="tab-panel-debug">
            <pre className="text-xs whitespace-pre-wrap text-gray-700" data-testid="debug-content">{JSON.stringify({ document: props.document, chat: props.chat, visual: props.visual }, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
