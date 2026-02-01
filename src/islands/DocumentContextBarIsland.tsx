import { h } from 'preact';
import { useState, useMemo, useCallback, useEffect, useRef } from 'preact/hooks';

interface DocumentSummary {
  id: number;
  title?: string;
  original_filename?: string;
}

export interface DocumentContextBarProps {
  documentId: number | null;
  title: string | null;
  availableDocuments: DocumentSummary[];
  status?: 'saved' | 'unsaved' | 'processing' | 'error';
}

export default function DocumentContextBarIsland(props: DocumentContextBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchOpen] = useState('');

  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return props.availableDocuments;
    const term = searchTerm.toLowerCase();
    return props.availableDocuments.filter((doc: DocumentSummary) => 
      (doc.title || '').toLowerCase().includes(term) || 
      (doc.original_filename || '').toLowerCase().includes(term) ||
      String(doc.id).includes(term)
    );
  }, [props.availableDocuments, searchTerm]);

  const currentIndex = useMemo(() => {
    if (!props.documentId) return -1;
    return props.availableDocuments.findIndex(doc => doc.id === props.documentId);
  }, [props.availableDocuments, props.documentId]);

  // Use navigation helper for detecting dirty state only; modal UI handles confirmation.
  const { isDocumentDirty: _isDocumentDirty } = require('../lib/navigation-guard');
  const isDocumentDirty = useCallback((docId?: number | null) => {
    return _isDocumentDirty(docId ?? props.documentId ?? null);
  }, [props.documentId]);

  interface NavModal { show: boolean; targetId: number | null; saving: boolean }
  const [navModal, setNavModal] = useState({ show: false, targetId: null as number | null, saving: false } as NavModal);
  // useRef generic typing can be finicky across TS configs; cast instead
  const navSaveRef = useRef(null as unknown as HTMLButtonElement | null);

  const handleNavigate = useCallback((id: number) => {
    const dirty = isDocumentDirty(props.documentId);
    if (dirty) {
      setNavModal({ show: true, targetId: id, saving: false });
      return;
    }
    try { window.location.href = `/document/${id}`; } catch (err) { /* ignore in tests */ }
  }, [isDocumentDirty, props.documentId]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      handleNavigate(props.availableDocuments[currentIndex - 1].id);
    }
  }, [currentIndex, props.availableDocuments, handleNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < props.availableDocuments.length - 1) {
      handleNavigate(props.availableDocuments[currentIndex + 1].id);
    }
  }, [currentIndex, props.availableDocuments, handleNavigate]);

  useEffect(() => {
    if (navModal.show && navSaveRef.current) {
      // Focus the primary action for keyboard users when modal opens
      try { navSaveRef.current.focus(); } catch (err) { /* ignore */ }
    }
  }, [navModal.show]);

  const handleModalCancel = useCallback(() => {
    setNavModal({ show: false, targetId: null, saving: false });
  }, []);

  const handleModalDiscard = useCallback(() => {
    const id = navModal.targetId;
    setNavModal({ show: false, targetId: null, saving: false });
    if (id) try { window.location.href = `/document/${id}`; } catch (err) { /* ignore */ }
  }, [navModal.targetId]);

  const handleModalSave = useCallback(() => {
    setNavModal((s: NavModal) => ({ ...s, saving: true }));
    try {
      window.dispatchEvent(new CustomEvent('workspace:save-request', { detail: { documentId: props.documentId } }));
    } catch (err) { /* ignore */ }

    const onSaveComplete = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const savedDocId = detail.documentId ?? props.documentId;
      if (String(savedDocId) === String(props.documentId)) {
        const id = navModal.targetId;
        setNavModal({ show: false, targetId: null, saving: false });
        try { if (id) window.location.href = `/document/${id}`; } catch (err) { /* ignore */ }
        window.removeEventListener('workspace:save-complete', onSaveComplete as EventListener);
        window.removeEventListener('workspace:save-failed', onSaveFailed as EventListener);
      }
    };

    const onSaveFailed = (_e: Event) => {
      // stop saving state and surface an error state (modal remains closed)
      setNavModal({ show: false, targetId: null, saving: false });
      window.removeEventListener('workspace:save-complete', onSaveComplete as EventListener);
      window.removeEventListener('workspace:save-failed', onSaveFailed as EventListener);
    };

    window.addEventListener('workspace:save-complete', onSaveComplete as EventListener);
    window.addEventListener('workspace:save-failed', onSaveFailed as EventListener);

    // Timeout fallback: if save doesn't complete in 30s, stop showing saving state
    setTimeout(() => {
      setNavModal((s: NavModal) => (s.saving ? { ...s, saving: false } : s));
    }, 30000);
  }, [navModal.targetId, props.documentId]);

  // State for standalone save/reprocess operations
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Handle standalone Save button click (not part of navigation flow)
  const handleSave = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      window.dispatchEvent(new CustomEvent('workspace:save-request', { detail: { documentId: props.documentId } }));
    } catch (err) { /* ignore */ }

    const onSaveComplete = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const savedDocId = detail.documentId ?? props.documentId;
      if (String(savedDocId) === String(props.documentId)) {
        setIsSaving(false);
        // Update status badge to saved
        const root = document.querySelector('[data-testid="document-context-bar-root"]');
        if (root) root.setAttribute('data-status', 'saved');
        window.removeEventListener('workspace:save-complete', onSaveComplete as EventListener);
        window.removeEventListener('workspace:save-failed', onSaveFailed as EventListener);
      }
    };

    const onSaveFailed = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const failedDocId = detail.documentId ?? props.documentId;
      if (String(failedDocId) === String(props.documentId)) {
        setIsSaving(false);
        // Update status badge to error
        const root = document.querySelector('[data-testid="document-context-bar-root"]');
        if (root) root.setAttribute('data-status', 'error');
        window.removeEventListener('workspace:save-complete', onSaveComplete as EventListener);
        window.removeEventListener('workspace:save-failed', onSaveFailed as EventListener);
      }
    };

    window.addEventListener('workspace:save-complete', onSaveComplete as EventListener);
    window.addEventListener('workspace:save-failed', onSaveFailed as EventListener);

    // Timeout fallback: if save doesn't complete in 30s, stop showing saving state
    setTimeout(() => {
      setIsSaving((current) => {
        if (current) {
          window.removeEventListener('workspace:save-complete', onSaveComplete as EventListener);
          window.removeEventListener('workspace:save-failed', onSaveFailed as EventListener);
        }
        return false;
      });
    }, 30000);
  }, [props.documentId, isSaving]);

  // Handle Reprocess button click
  const handleReprocess = useCallback(() => {
    if (isReprocessing) return;
    setIsReprocessing(true);

    try {
      window.dispatchEvent(new CustomEvent('workspace:reprocess-request', { detail: { documentId: props.documentId } }));
    } catch (err) { /* ignore */ }

    const onReprocessComplete = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const processedDocId = detail.documentId ?? props.documentId;
      if (String(processedDocId) === String(props.documentId)) {
        setIsReprocessing(false);
        window.removeEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
        window.removeEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);
      }
    };

    const onReprocessFailed = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const failedDocId = detail.documentId ?? props.documentId;
      if (String(failedDocId) === String(props.documentId)) {
        setIsReprocessing(false);
        window.removeEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
        window.removeEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);
      }
    };

    window.addEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
    window.addEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);

    // Timeout fallback: if reprocess doesn't complete in 60s, stop showing processing state
    setTimeout(() => {
      setIsReprocessing((current) => {
        if (current) {
          window.removeEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
          window.removeEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);
        }
        return false;
      });
    }, 60000);
  }, [props.documentId, isReprocessing]);

  // Listen for workspace-wide events to update a visual unsaved indicator
  useEffect(() => {
    const onDirty = (e: Event) => {
      const d = (e as CustomEvent)?.detail || {};
      if (d && (d.documentId === props.documentId || props.documentId == null)) {
        const root = document.querySelector('[data-testid="document-context-bar-root"]');
        if (root) root.setAttribute('data-status', 'unsaved');
      }
    };
    const onSaved = (_e: Event) => {
      const root = document.querySelector('[data-testid="document-context-bar-root"]');
      if (root) root.setAttribute('data-status', 'saved');
    };

    window.addEventListener('workspace:dirty', onDirty as EventListener);
    window.addEventListener('workspace:save-complete', onSaved as EventListener);
    window.addEventListener('sync:success', onSaved as EventListener);

    return () => {
      window.removeEventListener('workspace:dirty', onDirty as EventListener);
      window.removeEventListener('workspace:save-complete', onSaved as EventListener);
      window.removeEventListener('sync:success', onSaved as EventListener);
    };
  }, [props.documentId]);

  const getStatusBadge = () => {
    switch (props.status) {
      case 'processing':
        return <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100" data-testid="status-processing"><i class="fas fa-circle-notch fa-spin"></i> Processing</span>;
      case 'unsaved':
        return <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100" data-testid="status-unsaved"><i class="fas fa-circle text-[8px]"></i> Unsaved Changes</span>;
      case 'error':
        return <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100" data-testid="status-error"><i class="fas fa-exclamation-circle"></i> Error</span>;
      case 'saved':
      default:
        return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100" data-testid="status-saved"><i class="fas fa-check-circle"></i> Saved</span>;
    }
  };

  return (
    <div className="flex items-center gap-4 w-full max-w-4xl" data-testid="document-context-bar-root">
      {/* Navigation & Selector Group */}
      <div className="flex items-center bg-[#fdfaf6] border border-[#e5e0d8] rounded-lg p-1">
        <button 
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="p-2 text-[#555] hover:text-[#b87333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="nav-prev-btn"
          title="Previous Document"
        >
          <i class="fas fa-chevron-left"></i>
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-1.5 hover:bg-white rounded-md transition-colors min-w-[200px] justify-between group"
            data-testid="document-selector-trigger"
          >
            <span className="font-['Space_Grotesk'] font-medium truncate max-w-[240px]">
              {props.title || 'Select Document'}
            </span>
            <i class={`fas fa-chevron-down text-xs transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-[320px] bg-white border border-[#e5e0d8] rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" data-testid="document-selector-dropdown">
              <div className="p-3 border-b border-[#f5f0e8] bg-[#fdfaf6]">
                <div className="relative">
                  <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa] text-xs"></i>
                  <input 
                    type="text" 
                    placeholder="Search documents..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-[#e5e0d8] rounded-lg text-sm focus:outline-none focus:border-[#b87333] transition-colors"
                    value={searchTerm}
                    onInput={(e: Event) => setSearchOpen((e.target as HTMLInputElement).value)}
                    autoFocus
                    data-testid="document-search-input"
                  />
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto p-1">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc: DocumentSummary) => (
                    <button
                      key={doc.id}
                      onClick={() => handleNavigate(doc.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg flex flex-col gap-0.5 hover:bg-[#fdfaf6] transition-colors group ${doc.id === props.documentId ? 'bg-[#fdfaf6]' : ''}`}
                      data-testid={`document-option-${doc.id}`}
                    >
                      <span className={`text-sm font-medium truncate ${doc.id === props.documentId ? 'text-[#b87333]' : 'text-[#2c2c2c]'}`}>
                        {doc.title || doc.original_filename}
                      </span>
                      <span className="text-[10px] text-[#888] font-mono">#{doc.id}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-[#888] text-sm">
                    No documents found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleNext}
          disabled={currentIndex < 0 || currentIndex >= props.availableDocuments.length - 1}
          className="p-2 text-[#555] hover:text-[#b87333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="nav-next-btn"
          title="Next Document"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      {/* Status & Actions Group */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden sm:block">
          {getStatusBadge()}
        </div>

        <div className="h-6 w-[1px] bg-[#e5e0d8] mx-1 hidden sm:block"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="px-4 py-1.5 text-sm font-medium text-[#555] hover:bg-[#f5f0e8] rounded-lg transition-colors flex items-center gap-2 border border-[#e5e0d8] disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="reprocess-btn"
          >
            <i class={`fas ${isReprocessing ? 'fa-circle-notch fa-spin' : 'fa-redo-alt'} text-xs`}></i>
            {isReprocessing ? 'Reprocessing...' : 'Reprocess'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#b87333] hover:bg-[#a06028] rounded-lg shadow-sm transition-colors flex items-center gap-2 border border-[#905020] disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="save-all-btn"
          >
            <i class={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-save'} text-xs`}></i>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Backdrop for closing dropdown */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setIsDropdownOpen(false)}
        ></div>
      )}

      {/* Navigation confirmation modal (in-page, accessible) */}
      {navModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-hidden="false">
          <div className="absolute inset-0 bg-black opacity-50" aria-hidden="true"></div>
          <div role="dialog" aria-modal="true" aria-labelledby="nav-confirm-title" className="relative z-10 bg-white rounded-lg shadow-xl max-w-lg w-full p-6" data-testid="nav-confirm-modal">
            <h2 id="nav-confirm-title" className="text-lg font-semibold">You have unsaved changes</h2>
            <p className="mt-2 text-sm text-gray-600">Save your changes to keep them, or discard them to continue navigating. You can also cancel to stay on this page.</p>

            <div className="mt-6 flex items-center gap-3 justify-end">
              <button
                data-testid="nav-confirm-cancel"
                className="px-4 py-2 rounded-md border border-gray-200 bg-white text-sm"
                onClick={handleModalCancel}
                aria-label="Cancel and stay on this page"
              >
                Cancel
              </button>

              <button
                data-testid="nav-confirm-discard"
                className="px-4 py-2 rounded-md border border-red-200 bg-white text-sm text-red-700"
                onClick={handleModalDiscard}
                aria-label="Discard changes and navigate"
              >
                Discard Changes and Leave
              </button>

              <button
                data-testid="nav-confirm-save"
                ref={navSaveRef}
                className="px-4 py-2 rounded-md bg-[#b87333] text-white text-sm"
                onClick={handleModalSave}
                aria-label="Save changes and navigate"
                disabled={navModal.saving}
              >
                {navModal.saving ? 'Saving…' : 'Save and Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
