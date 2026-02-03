import { h } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type ManualWorkspaceContract } from '../ui/contracts/ManualWorkspace.contract';

type ViewMode = 'text' | 'visual';
type StatusTone = 'info' | 'success' | 'error';

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

function dispatchEventSafe(name: string, detail?: unknown) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  const EventConstructor =
    (typeof window !== 'undefined' && window.CustomEvent)
      ? window.CustomEvent
      : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail } as CustomEventInit<unknown>));
}

function formatDocumentLabel(doc: { id: number; title?: string; original_filename?: string }) {
  return doc.title || doc.original_filename || `Document ${doc.id}`;
}

export default function ManualWorkspaceIsland(
  props: Partial<ManualWorkspaceContract>
) {
  const [documents, setDocuments] = useState(props.documents || [] as Array<{ id: number; title?: string; original_filename?: string }>);
  const [documentId, setDocumentId] = useState(props.documentId ?? null as number | null);
  const [content, setContent] = useState(props.content || '');
  const [title, setTitle] = useState(props.title || '');
  const [correspondent, setCorrespondent] = useState(props.correspondent || '');
  const [documentType, setDocumentType] = useState('');
  const [tags, setTags] = useState(props.tags || [] as Array<string | number>);
  const [_originalUrl, setOriginalUrl] = useState(props.originalUrl ?? null as string | null);
  const [pageCount, setPageCount] = useState(props.pageCount ?? null as number | null);
  const [viewMode, setViewMode] = useState('text' as ViewMode);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null as StatusMessage | null);
  const [showFallback, setShowFallback] = useState(false);
  const selectRef = useRef(null as HTMLSelectElement | null);

  // Handle initial highlight and page
  useEffect(() => {
    if (typeof window !== 'undefined' && documentId) {
      const params = new URLSearchParams(window.location.search);
      const highlight = params.get('highlight');
      const pageParam = params.get('page');
      
      if (pageParam || highlight) {
        const targetPage = pageParam ? Number(pageParam) : (props.page || 1);
        
        // Switch to visual mode if highlighting
        if (highlight) {
          setViewMode('visual');
        }

        // Dispatch update to sync OverlayViewer
        // We delay slightly to ensure OverlayViewer is listening
        setTimeout(() => {
          if (highlight) {
            try {
              const bbox = JSON.parse(decodeURIComponent(highlight));
              dispatchEventSafe('overlay:highlight-region', { bbox, page: targetPage });
            } catch (e) {
              console.error('Failed to parse highlight', e);
            }
          }
          
          // Ensure correct page is shown
          if (targetPage > 1) {
             dispatchEventSafe('overlay:document-changed', { documentId, page: targetPage });
          }
        }, 500);
      }
    }
  }, [documentId]);
  // contentRef removed - handled by DocumentContentIsland
  const correspondentInfoRef = useRef(null as HTMLElement | null);
  const correspondentNameRef = useRef(null as HTMLElement | null);
  const titleInfoRef = useRef(null as HTMLElement | null);
  const titleNameRef = useRef(null as HTMLElement | null);
  const textSectionRef = useRef(null as HTMLElement | null);
  const visualSectionRef = useRef(null as HTMLElement | null);

  useEffect(() => {
    selectRef.current = document.getElementById('documentSelect') as HTMLSelectElement | null;
    // contentRef removed
    correspondentInfoRef.current = document.getElementById('correspondentInfo');
    correspondentNameRef.current = document.getElementById('correspondentName');
    titleInfoRef.current = document.getElementById('titleInfo');
    titleNameRef.current = document.getElementById('titleName');
    textSectionRef.current = document.getElementById('textPreviewSection');
    visualSectionRef.current = document.getElementById('visualPreviewSection');
  }, []);

  useEffect(() => {
    if (!selectRef.current) return;
    const select = selectRef.current;
    select.innerHTML = '<option value="">Choose a document...</option>';
    documents.forEach((doc: { id: number; title?: string; original_filename?: string }) => {
      const option = document.createElement('option');
      option.value = String(doc.id);
      option.textContent = formatDocumentLabel(doc);
      select.appendChild(option);
    });
    if (documentId) {
      select.value = String(documentId);
    }
  }, [documents, documentId]);

  // Content update effect removed - handled by event dispatch to DocumentContentIsland

  const updateCorrespondentDisplay = useCallback((value: string | { name?: string } | null) => {
    if (!correspondentInfoRef.current || !correspondentNameRef.current) return;
    if (value) {
      correspondentNameRef.current.textContent = typeof value === 'object' ? (value.name || '') : value;
      correspondentInfoRef.current.classList.remove('hidden');
    } else {
      correspondentInfoRef.current.classList.add('hidden');
    }
  }, []);

  const updateTitleDisplay = useCallback((value: string | { name?: string } | null) => {
    if (!titleInfoRef.current || !titleNameRef.current) return;
    if (value) {
      titleNameRef.current.textContent = typeof value === 'object' ? (value.name || '') : value;
      titleInfoRef.current.classList.remove('hidden');
    } else {
      titleInfoRef.current.classList.add('hidden');
    }
  }, []);

  useEffect(() => {
    updateCorrespondentDisplay(correspondent);
  }, [correspondent, updateCorrespondentDisplay]);

  useEffect(() => {
    updateTitleDisplay(title);
  }, [title, updateTitleDisplay]);

  useEffect(() => {
    if (!textSectionRef.current || !visualSectionRef.current) return;
    if (viewMode === 'visual') {
      textSectionRef.current.classList.add('hidden');
      visualSectionRef.current.classList.remove('hidden');
    } else {
      visualSectionRef.current.classList.add('hidden');
      textSectionRef.current.classList.remove('hidden');
    }
  }, [viewMode]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  interface VisualField {
    label?: string;
    value: string;
    domain?: string;
    confidence?: number;
  }

  interface DocumentMetadata {
    title?: string;
    content?: string;
    correspondent?: string;
    documentType?: string;
    pageCount?: number;
  }

  interface DocumentSelectedDetail {
    documentId: number | null;
    tags?: Array<string | number>;
    content?: string;
    correspondent?: string | null;
    title?: string | null;
    originalUrl?: string | null;
    pageCount?: number;
  }

  interface OverlayDocumentChangedDetail {
    documentId: number | null;
    page: number;
    originalUrl?: string | null;
    pageCount?: number;
  }

  const dispatchDocumentFields = useCallback((fields: VisualField[], docId: number | null) => {
    dispatchEventSafe('manual:fields-updated', { fields, documentId: docId });
  }, []);

  const dispatchDocumentMetadata = useCallback((metadata: DocumentMetadata) => {
    dispatchEventSafe('manual:metadata-updated', metadata);
  }, []);

  const dispatchDocumentSelected = useCallback((detail: DocumentSelectedDetail) => {
    dispatchEventSafe('document:selected', detail);
  }, []);

  const dispatchOverlayDocumentChanged = useCallback((detail: OverlayDocumentChangedDetail) => {
    dispatchEventSafe('overlay:document-changed', detail);
  }, []);

  const resetDocumentState = useCallback(() => {
    setDocumentId(null);
    setContent('');
    setTitle('');
    setCorrespondent('');
    setDocumentType('');
    setTags([]);
    setOriginalUrl(null);
    setPageCount(null);
    setShowFallback(false);
    setViewMode('text');

    dispatchDocumentFields([], null);
    dispatchDocumentMetadata({
      title: '',
      content: '',
      correspondent: '',
      documentType: '',
    });
    dispatchDocumentSelected({ documentId: null, tags: [], content: '' });
    dispatchOverlayDocumentChanged({ documentId: null, page: 1, originalUrl: null });
  }, [
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    dispatchDocumentSelected,
    dispatchOverlayDocumentChanged,
  ]);

  const fetchWithTimeout = useCallback(async (url: string, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const handleDocumentSelection = useCallback(async (nextId: string) => {
    setStatus(null);
    setShowFallback(false);

    if (!nextId) {
      resetDocumentState();
      return;
    }

    const docId = Number(nextId);
    if (!Number.isFinite(docId)) {
      setStatus({ tone: 'error', text: 'Invalid document selection.' });
      return;
    }

    setDocumentId(docId);
    setDocumentType('');
    setIsLoading(true);

    try {
      const response = await fetchWithTimeout(`/workspace/api/doc/${docId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document content');
      }
      const data = await response.json();

      const nextContent = data.content || '';
      const nextTitle = data.title || '';
      const nextCorrespondent = data.correspondent || '';
      const nextDocumentType = data.documentType || '';
      const nextTags = Array.isArray(data.tags) ? data.tags : [];
      const nextOriginalUrl =
        data.normalized_original_url || data.original_url || null;
      const nextPageCount = data.pageCount || 1;

      setContent(nextContent);
      setTitle(nextTitle);
      setCorrespondent(nextCorrespondent);
      setDocumentType(nextDocumentType);
      setTags(nextTags);
      setOriginalUrl(nextOriginalUrl);
      setPageCount(nextPageCount);

      if (data.visualFields && data.visualFields.length > 0) {
        dispatchDocumentFields(data.visualFields, data.id);
      } else if (data.customFields && data.customFields.length > 0) {
        interface CustomFieldData {
          field?: { name?: string } | number | string;
          value?: string;
        }
        const fields = data.customFields.map((cf: CustomFieldData) => ({
          label: (cf.field && typeof cf.field === 'object' && cf.field.name) ? cf.field.name : `Field ${cf.field}`,
          value: cf.value || '',
          domain: 'PAPERLESS',
          confidence: 1.0,
        }));
        dispatchDocumentFields(fields, data.id);
      } else {
        dispatchDocumentFields([], data.id);
      }

      dispatchDocumentMetadata({
        title: nextTitle,
        content: nextContent,
        correspondent: nextCorrespondent,
        documentType: nextDocumentType,
        pageCount: nextPageCount,
      });

      // Dispatch content so DocumentContentIsland can pick it up
      dispatchDocumentSelected({
        documentId: data.id,
        tags: nextTags,
        content: nextContent,
        correspondent: data.correspondent || null,
        title: data.title || null,
        originalUrl: nextOriginalUrl,
        pageCount: nextPageCount,
      });

      dispatchOverlayDocumentChanged({
        documentId: data.id,
        page: 1,
        originalUrl: nextOriginalUrl,
        pageCount: nextPageCount,
      });

      setStatus({ tone: 'success', text: 'Document preview loaded.' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus({
        tone: 'error',
        text: `Error loading document: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    dispatchDocumentSelected,
    dispatchOverlayDocumentChanged,
    fetchWithTimeout,
    resetDocumentState,
  ]);

  const refreshDocuments = useCallback(async () => {
    setStatus(null);
    try {
      const response = await fetchWithTimeout('/workspace/api/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const docs = await response.json();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus({
        tone: 'error',
        text: `Error loading documents: ${errorMessage}`,
      });
    }
  }, [fetchWithTimeout]);

  useEffect(() => {
    if (!documents || documents.length === 0) {
      refreshDocuments();
    }
  }, [documents, refreshDocuments]);

  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;

    const handler = (event: Event) => {
      const target = event.target as HTMLSelectElement;
      handleDocumentSelection(target.value);
    };

    select.addEventListener('change', handler);
    return () => {
      select.removeEventListener('change', handler);
    };
  }, [handleDocumentSelection]);

  useEffect(() => {
    const onViewMode = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      setViewMode(detail.mode === 'visual' ? 'visual' : 'text');
    };

    const onAnalysisStarted = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const analysisType = detail.analysisType || 'ai';
      setStatus({
        tone: 'info',
        text: `Running ${analysisType} analysis...`,
      });
    };

    const onAnalysisCompleted = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const result = detail.result || {};

      const nextTitle = result.title || title;
      const nextCorrespondent = result.correspondent || correspondent;
      const nextDocumentType = result.documentType || documentType;
      const nextPageCount = pageCount || 1;
      const nextDocId = detail.documentId ?? documentId;

      if (result.correspondent) setCorrespondent(result.correspondent);
      if (result.title) setTitle(result.title);
      if (result.documentType) setDocumentType(result.documentType);

      if (Array.isArray(result.fields) && result.fields.length > 0) {
        dispatchDocumentFields(result.fields, nextDocId ?? null);
      }

      dispatchDocumentMetadata({
        title: nextTitle,
        correspondent: nextCorrespondent,
        documentType: nextDocumentType,
        content,
        pageCount: nextPageCount,
      });
    };

    const onFallback = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const fallbackActive = Boolean(
        detail.fallback && detail.fallback.evidence_source === 'text'
      );
      setShowFallback(fallbackActive);
    };

    const onTagsUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (Array.isArray(detail.currentTags)) {
        setTags(detail.currentTags);
      }
    };

    window.addEventListener('viewmode:changed', onViewMode as EventListener);
    window.addEventListener('ai:analysis-started', onAnalysisStarted as EventListener);
    window.addEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
    window.addEventListener('visual:fallback', onFallback as EventListener);
    window.addEventListener('tags:updated', onTagsUpdated as EventListener);
    return () => {
      window.removeEventListener('viewmode:changed', onViewMode as EventListener);
      window.removeEventListener('ai:analysis-started', onAnalysisStarted as EventListener);
      window.removeEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
      window.removeEventListener('visual:fallback', onFallback as EventListener);
      window.removeEventListener('tags:updated', onTagsUpdated as EventListener);
    };
  }, [
    content,
    correspondent,
    dispatchDocumentFields,
    dispatchDocumentMetadata,
    documentId,
    documentType,
    pageCount,
    title,
  ]);

  const railText = useMemo(() => {
    if (!documentId) {
      return 'Select a document to begin a guided review.';
    }
    return `Reviewing ${title || `Document ${documentId}`}`;
  }, [documentId, title]);

  const railStatus = useMemo(() => {
    if (!documentId) {
      return 'Step 1: Choose a document to unlock analysis and tags.';
    }
    if (isLoading) {
      return 'Loading preview...';
    }
    if (viewMode === 'visual') {
      return 'Visual mode active. Inspect overlays or run visual analysis.';
    }
    return 'Text mode active. Run AI analysis or switch to visual.';
  }, [documentId, isLoading, viewMode]);

  return (
    <div data-testid="manual-workspace-root" className="sg-shell">
      <div className="guided-rail" data-testid="guided-rail">
        <div className="guided-rail__label">Guided Review</div>
        <div className="guided-rail__text">{railText}</div>
        <div className="guided-rail__status">{railStatus}</div>
      </div>

      {showFallback && (
        <div
          className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="visual-fallback-banner"
        >
          Visual analysis is unavailable. Showing text-only results. Visual
          evidence required for full validation.
        </div>
      )}

      {status && (
        <div
          className={`sg-card ${status.tone === 'error' ? 'sg-error' : ''}`}
          data-testid="manual-status"
          role="status"
          aria-live="polite"
        >
          {status.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          {documentId ? `Tags: ${tags.length}` : 'No document selected'}
        </div>
        <button
          type="button"
          className="sg-link"
          onClick={refreshDocuments}
          data-testid="refresh-documents"
        >
          Refresh documents
        </button>
      </div>
    </div>
  );
}