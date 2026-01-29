import { h } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';

interface DocumentSummary {
  id: number;
  title?: string;
  original_filename?: string;
}

interface DocumentContextBarProps {
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
    return props.availableDocuments.filter(doc => 
      (doc.title || '').toLowerCase().includes(term) || 
      (doc.original_filename || '').toLowerCase().includes(term) ||
      String(doc.id).includes(term)
    );
  }, [props.availableDocuments, searchTerm]);

  const currentIndex = useMemo(() => {
    if (!props.documentId) return -1;
    return props.availableDocuments.findIndex(doc => doc.id === props.documentId);
  }, [props.availableDocuments, props.documentId]);

  const handleNavigate = useCallback((id: number) => {
    window.location.href = `/document/${id}`;
  }, []);

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
                    onInput={(e: any) => setSearchOpen(e.target.value)}
                    autoFocus
                    data-testid="document-search-input"
                  />
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto p-1">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map(doc => (
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
            className="px-4 py-1.5 text-sm font-medium text-[#555] hover:bg-[#f5f0e8] rounded-lg transition-colors flex items-center gap-2 border border-[#e5e0d8]"
            data-testid="reprocess-btn"
          >
            <i class="fas fa-redo-alt text-xs"></i>
            Reprocess
          </button>
          <button 
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#b87333] hover:bg-[#a06028] rounded-lg shadow-sm transition-colors flex items-center gap-2 border border-[#905020]"
            data-testid="save-all-btn"
          >
            <i class="fas fa-save text-xs"></i>
            Save Changes
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
    </div>
  );
}
