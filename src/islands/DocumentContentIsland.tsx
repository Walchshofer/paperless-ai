import { h, Fragment } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { DocumentContentContract } from '../ui/contracts/DocumentContent.contract';

type Match = {
  index: number;
  start: number;
  end: number;
};

export default function DocumentContentIsland(props: DocumentContentContract) {
  const [documentId, setDocumentId] = useState(null as number | null);
  const [ocrMode, setOcrMode] = useState('original' as 'original' | 'high-res');
  const [content, setContent] = useState('' as string);
  const [visOcrPages, setVisOcrPages] = useState(props.visOcrPages || []);
  const [visOcrSource, setVisOcrSource] = useState(props.visOcrSource || null);
  const [visOcrQuality, setVisOcrQuality] = useState(props.visOcrQuality || null);
  
  // Editing and Feedback state
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null as 'success' | 'error' | null);
  const [feedbackGiven, setFeedbackGiven] = useState(null as 'accurate' | 'correction' | null);
  
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [autoGenerateBanner, setAutoGenerateBanner] = useState<'idle' | 'running' | 'done'>('idle');

  const [searchQuery, setSearchQuery] = useState('' as string);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  // Memoize the effective content based on the selected mode
  const effectiveContent = useMemo(() => {
    if (ocrMode === 'high-res' && visOcrPages.length > 0) {
      return visOcrPages
        .map(p => `--- Page ${p.pageNumber} ---\n${p.text || '[No text extracted for this page]'}`)
        .join('\n\n');
    }
    return content;
  }, [ocrMode, content, visOcrPages]);

  // Hydrate initial values from props to avoid passing type assertions into the hook call
  useEffect(() => {
    if (props.documentId !== undefined && props.documentId !== null) {
      setDocumentId(props.documentId);
    }
    if (props.content !== undefined) {
      setContent(props.content);
    }
    if (props.visOcrPages !== undefined) {
      setVisOcrPages(props.visOcrPages || []);
    }
    if (props.visOcrSource !== undefined) {
      setVisOcrSource(props.visOcrSource || null);
    }
    if (props.visOcrQuality !== undefined) {
      setVisOcrQuality(props.visOcrQuality || null);
    }
    if (props.initialQuery !== undefined) {
      setSearchQuery(props.initialQuery);
    }
  }, [props.documentId, props.content, props.initialQuery, props.visOcrPages, props.visOcrSource, props.visOcrQuality]);
  const [matches, setMatches] = useState([] as Match[]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [regexError, setRegexError] = useState(null as string | null);

  const contentRef = useRef(null as HTMLDivElement | null);

  // Text selection export state
  const [selectedText, setSelectedText] = useState('');
  const [showExportToolbar, setShowExportToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 0) {
        setSelectedText(text);
        
        // Get selection position for toolbar
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect) {
          setToolbarPos({
            top: rect.top - 50,
            left: rect.left + rect.width / 2 - 60
          });
          setShowExportToolbar(true);
        }
      } else {
        setShowExportToolbar(false);
        setSelectedText('');
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('mouseup', handleMouseUp);
      return () => contentElement.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  // Export text handler
  const handleExportText = (format: 'txt' | 'pdf') => {
    if (!selectedText || !documentId) return;
    
    // Dispatch export event
    const event = new CustomEvent('export:text-requested', {
      detail: {
        documentId,
        text: selectedText,
        format
      }
    });
    
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(event);
    }
    
    // Clear selection
    setShowExportToolbar(false);
    setSelectedText('');
  };

  // Listen for document selection events from ManualWorkspaceIsland
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.documentId !== undefined) setDocumentId(detail.documentId);
      if (detail.content !== undefined) setContent(detail.content);
      if (detail.visOcrPages !== undefined) setVisOcrPages(detail.visOcrPages || []);
      if (detail.visOcrSource !== undefined) setVisOcrSource(detail.visOcrSource || null);
      if (detail.visOcrQuality !== undefined) setVisOcrQuality(detail.visOcrQuality || null);
      
      if (detail.content !== undefined || detail.visOcrPages !== undefined) {
        // Reset search on new document
        setSearchQuery('');
        setMatches([]);
        setCurrentMatchIndex(-1);
        setOcrMode('original');
        setIsEditing(false);
        setFeedbackGiven(null);
      }
    };
    window.addEventListener('document:selected', handler as EventListener);
    return () => window.removeEventListener('document:selected', handler as EventListener);
  }, []);

  // Listen for document changes from the main workspace document dropdown
  useEffect(() => {
    const handleDocumentSwitched = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { documentId: newDocId, document } = detail;
      
      if (newDocId != null && newDocId !== documentId) {
        setDocumentId(newDocId);
        setContent(document?.content || '');
        setVisOcrPages(document?.visOcrPages || []);
        setVisOcrSource(document?.visOcrSource || null);
        setVisOcrQuality(document?.visOcrQuality || null);
        // Reset search on new document
        setSearchQuery('');
        setMatches([]);
        setCurrentMatchIndex(-1);
        setOcrMode('original');
        setIsEditing(false);
        setFeedbackGiven(null);
        console.log(`[DocumentContent] Document switched to ${newDocId}`);
      }
    };

    window.addEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
  }, [documentId]);

  // Search Logic with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery) {
        setMatches([]);
        setCurrentMatchIndex(-1);
        setRegexError(null);
        return;
      }

      try {
        const flags = caseSensitive ? 'g' : 'gi';
        let regex: RegExp;
        
        if (useRegex) {
          regex = new RegExp(searchQuery, flags);
        } else {
          // Escape special regex chars for literal search
          const escaped = searchQuery.replace(/[.*+?^${}()|[\\]/g, '\\$&');
          regex = new RegExp(escaped, flags);
        }

        const newMatches: Match[] = [];
        let match;
        // Limit matches for performance?
        let count = 0;
        const maxMatches = 1000; 

        while ((match = regex.exec(effectiveContent)) !== null && count < maxMatches) {
          newMatches.push({
            index: count,
            start: match.index,
            end: match.index + match[0].length
          });
          count++;
        }

        setMatches(newMatches);
        setRegexError(null);
        if (newMatches.length > 0) {
          setCurrentMatchIndex(0);
        } else {
          setCurrentMatchIndex(-1);
        }
      } catch (err: unknown) {
        const msg = (err && typeof err === 'object' && 'message' in err) ? (err as { message: unknown }).message : String(err);
        setRegexError(typeof msg === 'string' ? msg : String(msg));
        setMatches([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [effectiveContent, searchQuery, caseSensitive, useRegex]);

  // Scroll to match
  useEffect(() => {
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const matchId = `match-${currentMatchIndex}`;
      const el = document.getElementById(matchId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matches]);

  const navigate = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev: number) => {
      const next = prev + dir;
      if (next >= matches.length) return 0;
      if (next < 0) return matches.length - 1;
      return next;
    });
  };

  const handleStartEditing = () => {
    setEditedContent(effectiveContent);
    setIsEditing(true);
    setSaveStatus(null);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  const handleSave = async () => {
    if (!documentId) return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // 1. Update backend (metadata/expert knowledge)
      const response = await fetch(`/api/visual-overlays/expert-knowledge/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enhancedOcrText: editedContent,
          originalOcrText: effectiveContent,
          feedback: {
            rating: 3, // neutral initial rating for edits
            comments: 'User edited text in OCR tab'
          }
        })
      });

      if (!response.ok) throw new Error('Failed to save changes');

      // 2. Update local state
      if (ocrMode === 'high-res') {
        // For simplicity, we store the edited content as a single page or update enhancedOcrText
        // The next refresh will fetch the unified enhancedOcrText
        // Here we just update the UI state to reflect the change
        setVisOcrPages([{ pageNumber: 1, text: editedContent, success: true }]);
      } else {
        setContent(editedContent);
      }

      setSaveStatus('success');
      setFeedbackGiven('correction');
      setTimeout(() => {
        setIsEditing(false);
        setSaveStatus(null);
      }, 1500);

    } catch (err) {
      console.error('[DocumentContent] Save failed:', err);
      setSaveStatus('error');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoteAccurate = async () => {
    if (!documentId) return;
    try {
      const response = await fetch('/api/feedback/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: documentId,
          event_type: 'ocr_rating',
          field_name: 'enhanced_ocr_text',
          original_value: effectiveContent,
          corrected_value: 'accurate',
          context: { source: 'user_vote', ocr_mode: ocrMode }
        })
      });

      if (response.ok) {
        setFeedbackGiven('accurate');
      }
    } catch (err) {
      console.error('[DocumentContent] Feedback failed:', err);
    }
  };

  // Coordinated Save Participation
  useEffect(() => {
    const participantId = 'ocr-content';

    const onSaveRequest = (e: Event) => {
      const detail = (e as CustomEvent<{ saveId?: string; documentId?: number | null }>)?.detail || {};
      const { saveId, documentId: reqDocId } = detail;
      if (reqDocId !== null && String(reqDocId) !== String(documentId)) return;

      const willSave = isEditing && editedContent !== effectiveContent;

      window.dispatchEvent(new CustomEvent('workspace:save-ack', { 
        detail: { saveId, participantId, willSave } 
      }));

      if (!willSave) return;

      const onSaveBegin = async (beginEvent: Event) => {
        const beginDetail = (beginEvent as CustomEvent<{ saveId?: string }>)?.detail || {};
        if (beginDetail.saveId !== saveId) return;

        try {
          await handleSave(); // Trigger existing save logic
          // handleSave already dispatches progress via its own effects if needed, 
          // but we must notify the coordinator specifically.
          window.dispatchEvent(new CustomEvent('workspace:save-partial-complete', {
            detail: { saveId, participantId, success: true }
          }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          window.dispatchEvent(new CustomEvent('workspace:save-partial-complete', {
            detail: { saveId, participantId, success: false, message: msg }
          }));
        } finally {
          window.removeEventListener('workspace:save-begin', onSaveBegin as EventListener);
        }
      };

      window.addEventListener('workspace:save-begin', onSaveBegin as EventListener);
    };

    window.addEventListener('workspace:save-request', onSaveRequest as EventListener);
    return () => window.removeEventListener('workspace:save-request', onSaveRequest as EventListener);
  }, [documentId, isEditing, editedContent, effectiveContent, handleSave]);

  const handleRegenerate = async (silent = false) => {
    if (!documentId || isRegenerating) return;

    setIsRegenerating(true);
    if (!silent) {
      setOcrMode('high-res');
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        setVisOcrPages(data.pages || []);
        setVisOcrSource(data.source);
        setVisOcrQuality(data.quality);
        setFeedbackGiven(null);
        setMatches([]);
        setCurrentMatchIndex(-1);

        // Notify other islands that vis-ocr data is available
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vis-ocr:updated', {
            detail: {
              pages: data.pages || [],
              source: data.source || 'vis_ocr',
              quality: data.quality || null
            }
          }));
        }

        // Persist guard so auto-generation does not fire again for this document
        if (typeof window !== 'undefined' && documentId != null) {
          localStorage.setItem(`vis_ocr_generated_${documentId}`, '1');
        }

        if (silent) {
          setAutoGenerateBanner('done');
          setTimeout(() => setAutoGenerateBanner('idle'), 4000);
        }
      } else {
        throw new Error(data.error || 'Regeneration failed');
      }
    } catch (err) {
      console.error('[DocumentContent] Regeneration failed:', err);
      // Fallback: alert or show error in UI
      if (silent) {
        setAutoGenerateBanner('idle');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  // Auto-generate high-res OCR on first visit (once per document, guarded by localStorage)
  useEffect(() => {
    if (!documentId) return;
    const guardKey = `vis_ocr_generated_${documentId}`;
    if (localStorage.getItem(guardKey)) return;

    // If the server already provided vis-ocr pages, mark as done and skip
    if (visOcrPages && visOcrPages.length > 0) {
      localStorage.setItem(guardKey, '1');
      return;
    }

    // Set guard immediately to prevent double-firing (e.g. StrictMode or re-renders)
    localStorage.setItem(guardKey, '1');
    setAutoGenerateBanner('running');
    handleRegenerate(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Listen for external requests to trigger regeneration (non-silent)
  useEffect(() => {
    const handleRequestGenerate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.documentId != null && String(detail.documentId) !== String(documentId)) return;
      handleRegenerate(false);
    };
    window.addEventListener('vis-ocr:request-generate', handleRequestGenerate as EventListener);
    return () => window.removeEventListener('vis-ocr:request-generate', handleRequestGenerate as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Render content with highlights
  const renderedContent = useMemo(() => {
    if (!effectiveContent) return <div className="text-gray-400 italic p-4">No content available.</div>;
    if (matches.length === 0) return <div className="font-mono text-sm whitespace-pre-wrap">{effectiveContent}</div>;

    const parts = [];
    let lastIndex = 0;

    matches.forEach((m: Match, i: number) => {
      // Text before match
      if (m.start > lastIndex) {
        parts.push(effectiveContent.substring(lastIndex, m.start));
      }
      
      // Match highlight
      const isCurrent = i === currentMatchIndex;
      parts.push(
        <mark
          id={`match-${i}`}
          key={`match-${i}`}
          className={`${isCurrent ? 'bg-yellow-400 ring-2 ring-yellow-600' : 'bg-yellow-200'}`}
        >
          {effectiveContent.substring(m.start, m.end)}
        </mark>
      );
      
      lastIndex = m.end;
    });

    // Remaining text
    if (lastIndex < effectiveContent.length) {
      parts.push(effectiveContent.substring(lastIndex));
    }

    return <div className="font-mono text-sm whitespace-pre-wrap">{parts}</div>;
  }, [effectiveContent, matches, currentMatchIndex]);

  return (
    <div data-testid="document-content-island-root" className="h-full flex flex-col">
      {/* Mode Toggle and Info Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => { setOcrMode('original'); setMatches([]); setCurrentMatchIndex(-1); }}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${ocrMode === 'original' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="ocr-mode-original"
            >
              Tesseract OCR
            </button>
            <button
              onClick={() => { setOcrMode('high-res'); setMatches([]); setCurrentMatchIndex(-1); }}
              disabled={visOcrPages.length === 0}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${ocrMode === 'high-res' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} ${visOcrPages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid="ocr-mode-high-res"
              title={visOcrPages.length === 0 ? 'High-res AI extraction not available for this document' : 'Switch to purified AI extraction'}
            >
              High Res AI OCR
            </button>
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <button
                onClick={handleStartEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200"
                data-testid="ocr-start-edit"
              >
                <i className="fas fa-edit"></i>
                Edit
              </button>
              
              {ocrMode === 'high-res' && !feedbackGiven && (
                <button
                  onClick={handleVoteAccurate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                  data-testid="ocr-vote-accurate"
                  title="Mark as Accurate"
                >
                  <i className="fas fa-thumbs-up"></i>
                  Accurate
                </button>
              )}

              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-indigo-200 ${isRegenerating ? 'opacity-70 cursor-wait' : ''}`}
                data-testid="ocr-regenerate"
                title="Regenerate high-resolution AI extraction"
              >
                <i className={`fas fa-sync ${isRegenerating ? 'fa-spin' : ''}`}></i>
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>

              {feedbackGiven === 'accurate' && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 animate-pulse">
                  <i className="fas fa-check-circle"></i>
                  Verified Accurate
                </span>
              )}
            </div>
          )}

          {isEditing && (
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-all shadow-sm ${saveStatus === 'success' ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'} ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                data-testid="ocr-save-edit"
              >
                {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : (saveStatus === 'success' ? <i className="fas fa-check"></i> : <i className="fas fa-save"></i>)}
                {saveStatus === 'success' ? 'Saved' : (isSaving ? 'Saving...' : 'Save Changes')}
              </button>
              <button
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="ocr-cancel-edit"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        {ocrMode === 'high-res' && !isEditing && (
          <div className="flex items-center gap-3" data-testid="ocr-ai-info-bar">
            <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-100" data-testid="ocr-ai-source-badge">
              <span className="text-[10px] font-black uppercase text-indigo-400">Source</span>
              <span className="text-[10px] font-bold text-indigo-700">{visOcrSource || 'Neural Engine'}</span>
            </div>
            {visOcrQuality !== null && (
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded border border-emerald-100" data-testid="ocr-ai-quality-badge">
                <span className="text-[10px] font-black uppercase text-emerald-400">Quality</span>
                <span className="text-[10px] font-bold text-emerald-700">{Math.round(visOcrQuality * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Toolbar */}
      {!isEditing && <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-2 items-center text-sm sticky top-0 z-10">
        <div className="relative flex-1 min-w-[200px]">
          <input 
            type="text"
            data-testid="search-input"
            value={searchQuery}
            onInput={(e: Event) => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Search in document..."
            className={`w-full pl-8 pr-4 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${regexError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-0.5">
          <button
            onClick={() => navigate(-1)}
            disabled={matches.length === 0}
            className="p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50"
            title="Previous match"
            data-testid="search-prev"
          >
            <i className="fas fa-chevron-up"></i>
          </button>
          <span className="text-xs text-gray-500 min-w-[60px] text-center" data-testid="search-count">
            {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
          </span>
          <button
            onClick={() => navigate(1)}
            disabled={matches.length === 0}
            className="p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50"
            title="Next match"
            data-testid="search-next"
          >
            <i className="fas fa-chevron-down"></i>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-2 py-1 border rounded text-xs ${caseSensitive ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
            title="Match Case"
            data-testid="search-case-sensitive"
          >
            Aa
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`px-2 py-1 border rounded text-xs ${useRegex ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
            title="Use Regular Expression"
            data-testid="search-regex"
          >
            .*
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('export:text-requested', { detail: { text: effectiveContent } }));
              }
            }}
            className="px-2 py-1 border rounded text-xs bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            title="Export Document Text"
            data-testid="export-text"
          >
            <i className="fas fa-download"></i>
          </button>
          <button
            onClick={() => {
              const context = { type: 'text', data: { text: effectiveContent.substring(0, 5000) }, documentId }; // Limit text size
              window.location.href = `/workspace/doc/${documentId}?tab=chat&context=${encodeURIComponent(JSON.stringify(context))}`;
            }}
            className="px-2 py-1 border rounded text-xs bg-white border-gray-300 hover:bg-gray-50 text-green-600"
            title="Send to Chat"
            data-testid="send-to-chat"
          >
            <i className="fas fa-comment-dots"></i>
          </button>
        </div>
      </div>}

      {regexError && (
        <div className="bg-red-50 text-red-700 text-xs px-3 py-1 border-b border-red-100">
          Invalid Regex: {regexError}
        </div>
      )}

      {/* Content Area */}
      <div
        ref={contentRef}
        data-testid="document-content-area"
        className="flex-1 overflow-auto bg-white flex flex-col min-h-0"
      >
        {autoGenerateBanner === 'running' && (
          <div data-testid="auto-ocr-banner" className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] text-indigo-700 font-bold">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Generating high-res visual analysis for the first time...</span>
          </div>
        )}
        {autoGenerateBanner === 'done' && (
          <div data-testid="auto-ocr-banner-done" className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-bold">
            <i className="fas fa-check-circle"></i>
            <span>High-res visual analysis complete — see Visual Insights in the sidebar</span>
            <button onClick={() => setAutoGenerateBanner('idle')} className="ml-auto text-emerald-500 hover:text-emerald-700">x</button>
          </div>
        )}

        {isRegenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" data-testid="ocr-regenerating-state">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
              <i className="fas fa-brain text-5xl text-indigo-600 relative z-10"></i>
            </div>
            <h3 className="font-['Fraunces'] text-lg font-bold text-slate-800 mb-2">Engaging Neural Engine</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Re-analyzing document at 300 DPI for high-precision text extraction...</p>
            <div className="mt-8 w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </div>
        ) : isEditing ? (
          <div className="flex-1 flex flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Editing {ocrMode === 'high-res' ? 'Expert' : 'Tesseract'} Extraction</span>
              <span className="text-[10px] font-mono text-slate-400">{editedContent.length} characters</span>
            </div>
            <textarea
              value={editedContent}
              onInput={(e) => {
                const val = (e.target as HTMLTextAreaElement).value;
                setEditedContent(val);
                // Mark workspace as dirty
                if (val !== effectiveContent) {
                  try {
                    if (typeof window !== 'undefined') {
                      (window as any).__workspaceState = (window as any).__workspaceState || {};
                      const key = String(documentId);
                      (window as any).__workspaceState[key] = (window as any).__workspaceState[key] || {};
                      (window as any).__workspaceState[key].isDirty = true;
                    }
                  } catch (err) { /* ignore */ }
                  window.dispatchEvent(new CustomEvent('workspace:dirty', { detail: { documentId } }));
                }
              }}
              className="flex-1 w-full p-4 font-mono text-sm border-2 border-indigo-100 rounded-xl focus:border-indigo-300 focus:ring-0 resize-none outline-none bg-slate-50/30"
              data-testid="ocr-edit-textarea"
              placeholder="Correct the extracted text here..."
            ></textarea>
          </div>
        ) : (
          <div className="p-4 flex-1">
            {renderedContent}
          </div>
        )}
      </div>

      {/* Export Toolbar (floating) */}
      {showExportToolbar && (
        <div
          data-testid="text-export-toolbar"
          className="fixed bg-white border-2 border-[#b87333] rounded-lg shadow-lg p-2 flex gap-2 z-50"
          style={{
            top: `${toolbarPos.top}px`,
            left: `${toolbarPos.left}px`,
          }}
        >
          <button
            data-testid="export-text-txt-btn"
            onClick={() => handleExportText('txt')}
            className="px-3 py-1.5 text-sm bg-[#b87333] text-white rounded hover:bg-[#a56729] transition-colors"
            title="Export as TXT"
          >
            <i className="fas fa-file-alt mr-1"></i>
            TXT
          </button>
          <button
            data-testid="export-text-pdf-btn"
            onClick={() => handleExportText('pdf')}
            className="px-3 py-1.5 text-sm bg-[#b87333] text-white rounded hover:bg-[#a56729] transition-colors"
            title="Export as PDF"
          >
            <i className="fas fa-file-pdf mr-1"></i>
            PDF
          </button>
          <button
            data-testid="export-text-cancel-btn"
            onClick={() => {
              setShowExportToolbar(false);
              setSelectedText('');
            }}
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
    </div>
  );
}
