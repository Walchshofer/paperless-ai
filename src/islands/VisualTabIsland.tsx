import { h } from 'preact';
import { useEffect, useState, useCallback, useMemo, useRef } from 'preact/hooks';

/**
 * VisualTabIsland - Visual overlay management and visual search interface
 *
 * Features:
 * - Missing fields section: Lists fields without overlay mappings
 * - Existing overlays section: Lists all document overlays with view/delete
 * - Visual search section: Initiates visual search mode
 *
 * Architecture Reference: ticket:c937ea01 (Visual Tab for Overlay Labeling)
 * Design System: Copper (#b87333) for AI features, warm beige (#fdfaf6) foundation
 */

interface VisualField {
  id: string;
  label: string;
  isMapped?: boolean;
  overlayId?: string;
  pageNumber?: number;
  confidence?: number;
}

interface VisualOverlay {
  id: string;
  label: string;
  pageNumber: number;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

interface VisualTabProps {
  documentId?: number | null;
  fields?: VisualField[];
  overlays?: VisualOverlay[];
}

type ChatRole = 'user' | 'assistant' | 'system';
type ChatSource = 'hybrid' | 'visual' | 'text' | 'text-fallback';

interface OverlayAttachment {
  kind: 'overlay';
  id: string;
  label: string;
  pageNumber: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

interface ImageAttachment {
  kind: 'image';
  id: string;
  name: string;
  base64: string;
  previewDataUrl: string;
}

interface VisualSearchResult {
  id: string;
  docId: number | null;
  title: string;
  pageNumber: number;
  confidence: number;
  source: ChatSource;
  snippet?: string;
  bbox?: { x: number; y: number; width: number; height: number };
}

interface VisualChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  source?: ChatSource;
  confidence?: number;
  attachments?: Array<{ kind: 'overlay' | 'image'; label: string }>;
  results?: VisualSearchResult[];
}

class FetchError extends Error {
  status: number;
  responseData: unknown;

  constructor(message: string, status: number, responseData: unknown) {
    super(message);
    this.status = status;
    this.responseData = responseData;
  }
}

const CHAT_SESSION_PREFIX = 'paperless:visual-chat:';
const SEARCH_TIMEOUT_MS = 5000;
const REINGEST_TIMEOUT_MS = 10000;
const MAX_IMAGE_ATTACHMENTS = 3;
const MAX_RESULTS = 6;

const makeMessageId = (prefix = 'msg') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const clamp01 = (value: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const getChatSessionKey = (documentId: number) => {
  return `${CHAT_SESSION_PREFIX}${documentId}`;
};

const formatPercent = (value: number) => {
  return Math.round(clamp01(value) * 100);
};

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

const parseDataUrlBase64 = (dataUrl: string) => {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
};

const normalizeBox = (box: unknown) => {
  if (!box || typeof box !== 'object') {
    return undefined;
  }

  if (Array.isArray(box) && box.length === 4) {
    const [xmin, ymin, xmax, ymax] = box.map(Number);
    if ([xmin, ymin, xmax, ymax].every(Number.isFinite)) {
      return {
        x: clamp01(xmin > 1 ? xmin / 1000 : xmin),
        y: clamp01(ymin > 1 ? ymin / 1000 : ymin),
        width: clamp01((xmax - xmin) / (xmax > 1 ? 1000 : 1)),
        height: clamp01((ymax - ymin) / (ymax > 1 ? 1000 : 1))
      };
    }
  }

  const source = box as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const x = Number(source.x);
  const y = Number(source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if ([x, y, width, height].every(Number.isFinite)) {
    return {
      x: clamp01(x),
      y: clamp01(y),
      width: clamp01(width),
      height: clamp01(height)
    };
  }
  return undefined;
};

const normalizeConfidence = (raw: unknown, fallback: number) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return clamp01(fallback);
  }
  if (parsed <= 1) {
    return clamp01(parsed);
  }
  // Sidecar scores can be >1 (MaxSim). Compress into a confidence range.
  return clamp01(1 - Math.exp(-parsed / 6));
};

const mergeSources = (current: ChatSource, incoming: ChatSource) => {
  if (current === incoming) return current;
  if (current === 'hybrid' || incoming === 'hybrid') return 'hybrid';
  if (
    (current === 'text' && incoming === 'visual') ||
    (current === 'visual' && incoming === 'text')
  ) {
    return 'hybrid';
  }
  if (
    (current === 'text-fallback' && incoming === 'visual') ||
    (current === 'visual' && incoming === 'text-fallback')
  ) {
    return 'hybrid';
  }
  return incoming;
};

const sourceLabel = (source: ChatSource) => {
  if (source === 'text-fallback') return 'Text Fallback';
  if (source === 'visual') return 'Visual';
  if (source === 'text') return 'Text';
  return 'Hybrid';
};

const parseResultSource = (raw: unknown): ChatSource => {
  const value = String(raw || '').toLowerCase();
  if (value === 'visual') return 'visual';
  if (value === 'text') return 'text';
  if (value === 'text-fallback') return 'text-fallback';
  return 'hybrid';
};

async function postJsonWithTimeout<T>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = SEARCH_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const rawText = await response.text();
    let responseData: unknown = {};
    try {
      responseData = rawText ? JSON.parse(rawText) : {};
    } catch (_error: unknown) {
      responseData = { rawText };
    }

    if (!response.ok) {
      throw new FetchError(
        `Request failed (${response.status})`,
        response.status,
        responseData
      );
    }

    return responseData as T;
  } finally {
    clearTimeout(timer);
  }
}

// Declare window augmentation for test markers
declare global {
  interface Window {
    __visual_tab_mounted?: boolean;
  }
}

export default function VisualTabIsland(props: VisualTabProps) {
  const [currentDocumentId, setCurrentDocumentId] = useState(props.documentId ?? null);
  const [fields, setFields] = useState(props.fields || [] as VisualField[]);
  const [overlays, setOverlays] = useState(props.overlays || [] as VisualOverlay[]);

  // Update local state when props change
  useEffect(() => {
    if (props.documentId !== undefined) setCurrentDocumentId(props.documentId);
    if (props.fields !== undefined) setFields(props.fields);
    if (props.overlays !== undefined) setOverlays(props.overlays);
  }, [props.documentId, props.fields, props.overlays]);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState(null as string | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [deleteInProgress, setDeleteInProgress] = useState(null as string | null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([] as VisualChatMessage[]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState(null as string | null);
  const [visualReingestBusy, setVisualReingestBusy] = useState(false);
  const [overlayAttachments, setOverlayAttachments] = useState([] as OverlayAttachment[]);
  const [imageAttachments, setImageAttachments] = useState([] as ImageAttachment[]);
  const [isDragOver, setIsDragOver] = useState(false);
  const chatHistoryRef = useRef(null as HTMLDivElement | null);
  const fileInputRef = useRef(null as HTMLInputElement | null);

  // Mark mounted for tests
  useEffect(() => {
    try {
      window.__visual_tab_mounted = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[VisualTabIsland] Failed to set mount flag:', msg);
    }
    return () => {
      try {
        window.__visual_tab_mounted = false;
      } catch (_e: unknown) {
        // ignore cleanup errors
      }
    };
  }, []);

  const missingFields = useMemo(
    () => fields.filter((f: VisualField) => !f.isMapped),
    [fields]
  );
  const mappedFields = useMemo(
    () => fields.filter((f: VisualField) => f.isMapped),
    [fields]
  );

  const toOverlayAttachment = useCallback((overlay: VisualOverlay): OverlayAttachment => {
    return {
      kind: 'overlay',
      id: String(overlay.id),
      label: overlay.label,
      pageNumber: overlay.pageNumber,
      bbox: normalizeBox(overlay.bbox)
    };
  }, []);

  const addOverlayAttachment = useCallback((overlay: VisualOverlay) => {
    const attachment = toOverlayAttachment(overlay);
    setOverlayAttachments((prev: OverlayAttachment[]) => {
      if (prev.some((item: OverlayAttachment) => item.id === attachment.id)) {
        return prev;
      }
      return [...prev, attachment];
    });
  }, [toOverlayAttachment]);

  // Listen for document changes from the main workspace document dropdown
  useEffect(() => {
    const handleDocumentSwitched = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { documentId } = detail;
      
      if (documentId != null && documentId !== currentDocumentId) {
        setCurrentDocumentId(documentId);
        setFields([]);
        setOverlays([]);
        setIsDrawMode(false);
        setActiveFieldId(null);
        setChatInput('');
        setOverlayAttachments([]);
        setImageAttachments([]);
        setChatStatus(null);
        console.log(`[VisualTab] Document switched to ${documentId}`);
      }
    };

    window.addEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
  }, [currentDocumentId]);

  // Fetch fields and overlays when document changes
  useEffect(() => {
    if (!currentDocumentId) {
      setFields([]);
      setOverlays([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch missing fields
        const fieldsRes = await fetch(`/api/visual-overlays/missing-fields/${currentDocumentId}`);
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json();
          setFields(fieldsData.fields || []);
        } else {
          console.warn('[VisualTabIsland] Failed to fetch fields:', fieldsRes.status);
        }

        // Fetch existing overlays
        const overlaysRes = await fetch(`/api/visual-overlays/document/${currentDocumentId}`);
        if (overlaysRes.ok) {
          const overlaysData = await overlaysRes.json();
          setOverlays(overlaysData.overlays || []);
        } else {
          console.warn('[VisualTabIsland] Failed to fetch overlays:', overlaysRes.status);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[VisualTabIsland] Failed to fetch data:', msg);
        setError('Failed to load visual data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [currentDocumentId]);

  // Restore document-scoped visual chat history from sessionStorage.
  useEffect(() => {
    if (!currentDocumentId) {
      setChatHistory([]);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(getChatSessionKey(currentDocumentId));
      if (!raw) {
        setChatHistory([]);
        return;
      }
      const parsed = JSON.parse(raw) as { messages?: VisualChatMessage[] };
      setChatHistory(Array.isArray(parsed.messages) ? parsed.messages : []);
    } catch (storageError: unknown) {
      const msg = storageError instanceof Error
        ? storageError.message
        : String(storageError);
      console.warn('[VisualTabIsland] Failed to restore chat session:', msg);
      setChatHistory([]);
    }
  }, [currentDocumentId]);

  useEffect(() => {
    if (!currentDocumentId) return;
    try {
      window.sessionStorage.setItem(
        getChatSessionKey(currentDocumentId),
        JSON.stringify({ messages: chatHistory })
      );
    } catch (storageError: unknown) {
      const msg = storageError instanceof Error
        ? storageError.message
        : String(storageError);
      console.warn('[VisualTabIsland] Failed to persist chat session:', msg);
    }
  }, [currentDocumentId, chatHistory]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory, chatBusy]);

  // Handle label field click - activates draw mode on document viewer
  const handleLabelField = useCallback((fieldId: string) => {
    setActiveFieldId(fieldId);
    setIsDrawMode(true);

    // Dispatch event to activate draw mode on OverlayViewerIsland
    window.dispatchEvent(new CustomEvent('overlay:activate-draw-mode', {
      detail: { fieldId, purpose: 'label-field' }
    }));
  }, []);

  // Handle view overlay click - highlights overlay on document
  const handleViewOverlay = useCallback((overlay: VisualOverlay) => {
    window.dispatchEvent(new CustomEvent('overlay:highlight-region', {
      detail: {
        bbox: overlay.bbox,
        page: overlay.pageNumber
      }
    }));
  }, []);

  // Handle delete overlay click
  const handleDeleteOverlay = useCallback(async (overlayId: string) => {
    if (!confirm('Delete this overlay?')) return;

    setDeleteInProgress(overlayId);

    try {
      const response = await fetch(`/api/visual-overlays/${overlayId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setOverlays((prev: VisualOverlay[]) => prev.filter((o: VisualOverlay) => o.id !== overlayId));
        // Refresh fields to update mapping status
        if (currentDocumentId) {
          const fieldsRes = await fetch(`/api/visual-overlays/missing-fields/${currentDocumentId}`);
          if (fieldsRes.ok) {
            const fieldsData = await fieldsRes.json();
            setFields(fieldsData.fields || []);
          }
        }
      } else {
        const text = await response.text();
        console.error('[VisualTabIsland] Delete failed:', text);
        alert('Failed to delete overlay');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[VisualTabIsland] Failed to delete overlay:', msg);
      alert('Failed to delete overlay');
    } finally {
      setDeleteInProgress(null);
    }
  }, [currentDocumentId]);

  // Handle visual search - activates draw mode for region selection
  const handleVisualSearch = useCallback(() => {
    setActiveFieldId(null);
    setIsDrawMode(true);

    window.dispatchEvent(new CustomEvent('overlay:activate-draw-mode', {
      detail: { purpose: 'visual-search' }
    }));
  }, []);

  // Listen for draw completion events
  useEffect(() => {
    const handleDrawComplete = async (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { bbox, page, purpose, fieldId, imageBase64 } = detail;

      if (purpose === 'label-field' && fieldId && currentDocumentId) {
        // Save overlay for field
        try {
          const response = await fetch('/api/visual-overlays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: currentDocumentId,
              fieldId,
              bbox,
              pageNumber: page
            })
          });

          if (response.ok) {
            // Refresh overlays and fields
            const overlaysRes = await fetch(`/api/visual-overlays/document/${currentDocumentId}`);
            if (overlaysRes.ok) {
              const overlaysData = await overlaysRes.json();
              setOverlays(overlaysData.overlays || []);
            }

            const fieldsRes = await fetch(`/api/visual-overlays/missing-fields/${currentDocumentId}`);
            if (fieldsRes.ok) {
              const fieldsData = await fieldsRes.json();
              setFields(fieldsData.fields || []);
            }
          } else {
            console.error('[VisualTabIsland] Failed to save overlay');
            alert('Failed to save overlay');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[VisualTabIsland] Failed to save overlay:', msg);
          alert('Failed to save overlay');
        }
      } else if (purpose === 'visual-search') {
        // Trigger visual search event with image data
        window.dispatchEvent(new CustomEvent('visual-search-requested', {
          detail: { bbox, page, documentId: currentDocumentId, imageBase64 }
        }));
      }

      setIsDrawMode(false);
      setActiveFieldId(null);
    };

    window.addEventListener('overlay:draw-complete', handleDrawComplete as EventListener);
    return () => window.removeEventListener('overlay:draw-complete', handleDrawComplete as EventListener);
  }, [currentDocumentId]);

  // Cancel draw mode handler
  useEffect(() => {
    const handleCancelDraw = () => {
      setIsDrawMode(false);
      setActiveFieldId(null);
    };

    window.addEventListener('overlay:draw-cancelled', handleCancelDraw);
    return () => window.removeEventListener('overlay:draw-cancelled', handleCancelDraw);
  }, []);

  // Sync draw mode state from toolbar changes
  useEffect(() => {
    const handleDrawModeChanged = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { drawMode } = detail;
      
      // Only sync if draw mode is being deactivated from toolbar
      // If activating, keep our activeFieldId context
      if (drawMode === false) {
        setIsDrawMode(false);
        setActiveFieldId(null);
      } else if (drawMode === true && !activeFieldId) {
        // Toolbar activated draw mode without a field context
        setIsDrawMode(true);
      }
    };

    window.addEventListener('overlay:draw-mode-changed', handleDrawModeChanged as EventListener);
    return () => window.removeEventListener('overlay:draw-mode-changed', handleDrawModeChanged as EventListener);
  }, [activeFieldId]);

  const normalizeResult = useCallback(
    (raw: Record<string, unknown>, fallbackSource: ChatSource) => {
      const docIdRaw = raw.docId ?? raw.doc_id ?? raw.documentId;
      const parsedDocId = Number(docIdRaw);
      const docId = Number.isFinite(parsedDocId) ? parsedDocId : null;
      const pageNumberRaw =
        raw.pageNum ??
        raw.page_num ??
        raw.page ??
        (raw.metadata as { page_number?: unknown } | undefined)?.page_number;
      const parsedPageNumber = Number(pageNumberRaw);
      const pageNumber = Number.isFinite(parsedPageNumber) && parsedPageNumber > 0
        ? parsedPageNumber
        : 1;
      const source = parseResultSource(raw.source || fallbackSource);
      const title = String(raw.title || `Document #${docId ?? '?'}`);
      const confidence = normalizeConfidence(
        raw.confidence ?? raw.visualScore ?? raw.textScore ?? raw.fusedScore ?? raw.score,
        0.5
      );

      const overlaysRaw = Array.isArray(raw.overlays)
        ? raw.overlays as Array<Record<string, unknown>>
        : [];
      const firstOverlay = overlaysRaw[0] || null;
      const overlayData = (firstOverlay?.overlayData || {}) as Record<string, unknown>;
      const overlayBox =
        normalizeBox(raw.bbox) ||
        normalizeBox(raw.box) ||
        normalizeBox(overlayData.boundingBox) ||
        normalizeBox(overlayData.bbox) ||
        normalizeBox(overlayData.box) ||
        normalizeBox(firstOverlay?.bbox) ||
        normalizeBox(firstOverlay?.box);

      const resultId = `${docId ?? 'unknown'}-${pageNumber}-${Math.round(confidence * 1000)}`;
      const snippet = String(raw.snippet || raw.content || '');

      return {
        id: resultId,
        docId,
        title,
        pageNumber,
        confidence,
        source,
        snippet: snippet || undefined,
        bbox: overlayBox
      } as VisualSearchResult;
    },
    []
  );

  const combineResults = useCallback((groups: VisualSearchResult[][]) => {
    const merged = new Map<string, VisualSearchResult>();

    groups.flat().forEach((result: VisualSearchResult) => {
      const key = `${result.docId ?? 'unknown'}:${result.pageNumber}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, result);
        return;
      }

      merged.set(key, {
        ...existing,
        confidence: Math.max(existing.confidence, result.confidence),
        source: mergeSources(existing.source, result.source),
        snippet: existing.snippet || result.snippet,
        bbox: existing.bbox || result.bbox
      });
    });

    return Array.from(merged.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_RESULTS);
  }, []);

  const executeHybridSearch = useCallback(async (query: string) => {
    const overlayContext = overlayAttachments
      .map((attachment: OverlayAttachment) => `${attachment.label} (page ${attachment.pageNumber})`)
      .join(', ');
    const effectiveQuery = overlayContext
      ? `${query}\n\nOverlay context: ${overlayContext}`
      : query;

    let gpuPreparing = false;
    let baseResults = [] as VisualSearchResult[];
    let baseSource = 'hybrid' as ChatSource;

    try {
      const response = await postJsonWithTimeout<{
        results?: Array<Record<string, unknown>>;
      }>('/api/visual-rag/search', {
        query: effectiveQuery,
        mode: 'hybrid',
        k: 8,
        includeOverlays: true
      });
      baseResults = (response.results || []).map((raw: Record<string, unknown>) =>
        normalizeResult(raw, 'hybrid')
      );
    } catch (searchError: unknown) {
      const isSidecar503 = searchError instanceof FetchError &&
        searchError.status === 503;
      if (!isSidecar503) {
        throw searchError;
      }

      gpuPreparing = true;
      baseSource = 'text-fallback';
      const fallbackResponse = await postJsonWithTimeout<{
        results?: Array<Record<string, unknown>>;
      }>('/api/visual-rag/search', {
        query: effectiveQuery,
        mode: 'text',
        k: 8,
        includeOverlays: true
      });
      baseResults = (fallbackResponse.results || []).map((raw: Record<string, unknown>) =>
        normalizeResult(raw, 'text-fallback')
      );
    }

    const imageResults = [] as VisualSearchResult[];
    for (const image of imageAttachments) {
      try {
        const response = await postJsonWithTimeout<{
          results?: Array<Record<string, unknown>>;
        }>('/api/visual-rag/search/visual', {
          image: image.base64,
          collection: 'visual_pages',
          k: 5
        });
        const normalized = (response.results || []).map((raw: Record<string, unknown>) =>
          normalizeResult(raw, 'visual')
        );
        imageResults.push(...normalized);
      } catch (visualError: unknown) {
        const msg = visualError instanceof Error
          ? visualError.message
          : String(visualError);
        console.warn('[VisualTabIsland] Image search failed:', msg);
      }
    }

    const combinedResults = combineResults([baseResults, imageResults]);
    return {
      query: effectiveQuery,
      gpuPreparing,
      results: combinedResults,
      source: combinedResults.length > 0
        ? combinedResults[0].source
        : baseSource
    };
  }, [combineResults, imageAttachments, normalizeResult, overlayAttachments]);

  const handleShowInDocument = useCallback((result: VisualSearchResult) => {
    if (!result.docId) return;

    if (result.docId !== currentDocumentId) {
      window.dispatchEvent(new CustomEvent('overlay:document-changed', {
        detail: {
          documentId: result.docId,
          page: result.pageNumber,
          originalUrl: null
        }
      }));
      window.dispatchEvent(new CustomEvent('workspace:document-switched', {
        detail: {
          documentId: result.docId,
          document: {
            id: result.docId,
            title: result.title,
            pageCount: result.pageNumber
          }
        }
      }));
      setCurrentDocumentId(result.docId);
    }

    if (result.bbox) {
      window.dispatchEvent(new CustomEvent('overlay:highlight-region', {
        detail: {
          bbox: result.bbox,
          page: result.pageNumber
        }
      }));
    }
  }, [currentDocumentId]);

  const handleSendSearch = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatBusy || !currentDocumentId) return;

    const attachmentSummary = [
      ...overlayAttachments.map((item: OverlayAttachment) => ({
        kind: item.kind as 'overlay',
        label: `${item.label} (p${item.pageNumber})`
      })),
      ...imageAttachments.map((item: ImageAttachment) => ({
        kind: item.kind as 'image',
        label: item.name
      }))
    ];

    const userMessage = {
      id: makeMessageId('user'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      attachments: attachmentSummary
    } as VisualChatMessage;

    setChatHistory((prev: VisualChatMessage[]) => [...prev, userMessage]);
    setChatInput('');
    setChatBusy(true);
    setChatStatus(null);

    try {
      const response = await executeHybridSearch(text);
      const results = response.results;
      const topConfidence = results.length
        ? results.slice(0, 3).reduce((acc, item) => acc + item.confidence, 0) /
          Math.min(results.length, 3)
        : undefined;

      const assistantMessage = {
        id: makeMessageId('assistant'),
        role: 'assistant',
        content: results.length > 0
          ? `Found ${results.length} matching result${results.length === 1 ? '' : 's'}.`
          : 'No matching results found for that request.',
        createdAt: Date.now(),
        source: response.source,
        confidence: topConfidence,
        results
      } as VisualChatMessage;

      setChatHistory((prev: VisualChatMessage[]) => [...prev, assistantMessage]);

      if (response.gpuPreparing) {
        const statusMessage = {
          id: makeMessageId('system'),
          role: 'system',
          content: 'GPU preparing: visual sidecar unavailable, using text fallback.',
          createdAt: Date.now(),
          source: 'text-fallback'
        } as VisualChatMessage;
        setChatHistory((prev: VisualChatMessage[]) => [...prev, statusMessage]);
        setChatStatus('GPU Preparing: using text fallback while visual sidecar initializes.');
      }
    } catch (searchError: unknown) {
      const msg = searchError instanceof Error ? searchError.message : String(searchError);
      setChatStatus(`Search failed: ${msg}`);
      const errorMessage = {
        id: makeMessageId('system'),
        role: 'system',
        content: `Search failed: ${msg}`,
        createdAt: Date.now(),
        source: 'text-fallback'
      } as VisualChatMessage;
      setChatHistory((prev: VisualChatMessage[]) => [...prev, errorMessage]);
    } finally {
      setChatBusy(false);
      setOverlayAttachments([]);
      setImageAttachments([]);
    }
  }, [
    chatBusy,
    chatInput,
    currentDocumentId,
    executeHybridSearch,
    imageAttachments,
    overlayAttachments
  ]);

  const handleClearChat = useCallback(() => {
    setChatHistory([]);
    setChatInput('');
    setChatStatus(null);
    setOverlayAttachments([]);
    setImageAttachments([]);
  }, []);

  const handleReingestVisual = useCallback(async () => {
    if (!currentDocumentId || visualReingestBusy) return;
    const confirmed = window.confirm(
      'This will re-analyze the document visually. Continue?'
    );
    if (!confirmed) return;

    setVisualReingestBusy(true);
    setChatStatus(`Reingesting visual index for document #${currentDocumentId}...`);
    try {
      const response = await postJsonWithTimeout<{
        overlayCount?: number;
        pagesProcessed?: number;
      }>(
        `/api/visual-rag/reingest/${currentDocumentId}`,
        { force: true },
        REINGEST_TIMEOUT_MS
      );
      const overlays = Number(response.overlayCount || 0);
      const pages = Number(response.pagesProcessed || 0);
      setChatStatus(
        `Visual reingest complete for document #${currentDocumentId}` +
          ` (${overlays} overlays, ${pages} pages).`
      );
    } catch (reingestError: unknown) {
      const msg = reingestError instanceof Error
        ? reingestError.message
        : String(reingestError);
      setChatStatus(`Visual reingest failed: ${msg}`);
    } finally {
      setVisualReingestBusy(false);
    }
  }, [currentDocumentId, visualReingestBusy]);

  const addImageAttachments = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files).slice(0, MAX_IMAGE_ATTACHMENTS);
    const prepared = [] as ImageAttachment[];
    for (const file of selectedFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        prepared.push({
          kind: 'image',
          id: makeMessageId('img'),
          name: file.name,
          base64: parseDataUrlBase64(dataUrl),
          previewDataUrl: dataUrl
        });
      } catch (readError: unknown) {
        const msg = readError instanceof Error ? readError.message : String(readError);
        console.warn('[VisualTabIsland] Failed to attach image:', msg);
      }
    }

    if (prepared.length > 0) {
      setImageAttachments((prev: ImageAttachment[]) => {
        const next = [...prev, ...prepared];
        return next.slice(0, MAX_IMAGE_ATTACHMENTS);
      });
    }
  }, []);

  // No document selected state
  if (!currentDocumentId) {
    return (
      <div className="visual-tab-panel p-4" data-testid="visual-tab-panel">
        <div className="text-center text-[#888] py-8">
          <i className="fas fa-eye text-4xl mb-4 block opacity-50" aria-hidden="true"></i>
          <p>Select a document to view visual overlays</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="visual-tab-panel p-4" data-testid="visual-tab-panel">
        <div className="text-center py-8" role="status" aria-live="polite">
          <i className="fas fa-spinner fa-spin text-2xl text-[#b87333]" aria-hidden="true"></i>
          <p className="mt-2 text-[#888]">Loading visual data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="visual-tab-panel p-4" data-testid="visual-tab-panel">
        <div className="text-center text-red-600 py-8" role="alert">
          <i className="fas fa-exclamation-triangle text-2xl mb-2" aria-hidden="true"></i>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Draw mode indicator
  if (isDrawMode) {
    return (
      <div className="visual-tab-panel p-4" data-testid="visual-tab-panel">
        <div 
          className="bg-[#b87333] text-white p-4 rounded-lg text-center"
          role="status"
          aria-live="assertive"
        >
          <i className="fas fa-pencil-alt text-2xl mb-2" aria-hidden="true"></i>
          <p className="font-medium">Draw Mode Active</p>
          <p className="text-sm mt-1 opacity-90">
            {activeFieldId 
              ? `Draw a box on the document for "${fields.find((f: VisualField) => f.id === activeFieldId)?.label || activeFieldId}"`
              : 'Draw a box on the document to search for similar regions'}
          </p>
          <button
            onClick={() => {
              setIsDrawMode(false);
              setActiveFieldId(null);
              window.dispatchEvent(new CustomEvent('overlay:draw-cancelled'));
            }}
            className="mt-3 px-4 py-2 bg-white/20 rounded-md text-sm hover:bg-white/30 transition-colors"
            data-testid="cancel-draw-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="visual-tab-panel" data-testid="visual-tab-panel">
      <div className="mb-6 rounded-lg border border-[#e5e0d8] bg-white">
        <div className="flex items-center justify-between border-b border-[#f0ece5] px-3 py-2">
          <h3 className="text-sm font-semibold text-[#2c2c2c] font-['Space_Grotesk']">
            Visual Chat
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-[#e5e0d8] px-2 py-1 text-xs text-[#666] hover:bg-[#f5f0e8] disabled:opacity-60"
              data-testid="visual-chat-reingest-btn"
              disabled={visualReingestBusy}
              onClick={() => void handleReingestVisual()}
            >
              {visualReingestBusy ? 'Reingesting...' : 'Reingest Visual'}
            </button>
            <button
              type="button"
              className="rounded-md border border-[#e5e0d8] px-2 py-1 text-xs text-[#666] hover:bg-[#f5f0e8]"
              data-testid="visual-chat-clear-btn"
              onClick={handleClearChat}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="p-3">
          <div
            ref={chatHistoryRef}
            className="max-h-64 space-y-2 overflow-y-auto rounded-md bg-[#fdfaf6] p-2"
            data-testid="visual-chat-history"
          >
            {chatHistory.length === 0 && (
              <div className="rounded-md border border-dashed border-[#e5e0d8] bg-white p-3 text-xs text-[#666]">
                Ask a natural-language visual query. Attach overlays or upload
                images to enrich hybrid search.
              </div>
            )}
            {chatHistory.map((message: VisualChatMessage) => (
              <div
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'ml-6 rounded-lg bg-[#b87333] px-3 py-2 text-sm text-white'
                    : message.role === 'system'
                    ? 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900'
                    : 'mr-6 rounded-lg border border-[#e5e0d8] bg-white px-3 py-2 text-sm text-[#2c2c2c]'
                }
                data-testid={`visual-chat-message-${message.role}`}
              >
                <p>{message.content}</p>

                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.attachments.map((attachment, idx) => (
                      <span
                        key={`${message.id}-attachment-${idx}`}
                        className="rounded-full border border-white/40 px-2 py-0.5 text-[11px]"
                      >
                        {attachment.kind === 'overlay' ? '📍' : '🖼️'} {attachment.label}
                      </span>
                    ))}
                  </div>
                )}

                {message.role === 'assistant' && (
                  <div className="mt-2 text-xs text-[#666]">
                    <span>
                      Source: {sourceLabel(message.source || 'hybrid')}
                    </span>
                    {message.confidence !== undefined && (
                      <span className="ml-2">
                        Confidence: {formatPercent(message.confidence)}%
                      </span>
                    )}
                  </div>
                )}

                {message.results && message.results.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.results.map((result: VisualSearchResult) => (
                      <div
                        key={`${message.id}-${result.id}`}
                        className="rounded-md border border-[#eee6dc] bg-[#fffdfa] p-2"
                        data-testid={`visual-chat-result-${result.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[#2c2c2c]">
                              {result.title}
                            </div>
                            <div className="text-[11px] text-[#777]">
                              Page {result.pageNumber} • {sourceLabel(result.source)}
                            </div>
                          </div>
                          <span className="text-[11px] text-[#555]">
                            {formatPercent(result.confidence)}%
                          </span>
                        </div>
                        {result.snippet && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-[#666]">
                            {result.snippet}
                          </p>
                        )}
                        <button
                          type="button"
                          className="mt-2 rounded-md border border-[#e5e0d8] px-2 py-1 text-xs text-[#2c2c2c] hover:bg-[#f5f0e8]"
                          data-testid={`visual-chat-show-document-${result.id}`}
                          onClick={() => handleShowInDocument(result)}
                        >
                          Show in Document
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {(overlayAttachments.length > 0 || imageAttachments.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="visual-chat-attachments">
              {overlayAttachments.map((attachment: OverlayAttachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  className="rounded-full border border-[#d9cdbf] bg-[#fdfaf6] px-2 py-1 text-[11px] text-[#5b4a36]"
                  data-testid={`visual-chat-overlay-attachment-${attachment.id}`}
                  onClick={() => {
                    setOverlayAttachments((prev: OverlayAttachment[]) =>
                      prev.filter((item: OverlayAttachment) => item.id !== attachment.id)
                    );
                  }}
                >
                  📍 {attachment.label} ×
                </button>
              ))}
              {imageAttachments.map((attachment: ImageAttachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  className="rounded-full border border-[#d9cdbf] bg-[#fdfaf6] px-2 py-1 text-[11px] text-[#5b4a36]"
                  data-testid={`visual-chat-image-attachment-${attachment.id}`}
                  onClick={() => {
                    setImageAttachments((prev: ImageAttachment[]) =>
                      prev.filter((item: ImageAttachment) => item.id !== attachment.id)
                    );
                  }}
                >
                  🖼️ {attachment.name} ×
                </button>
              ))}
            </div>
          )}

          <div
            className={`mt-2 rounded-md border p-2 ${
              isDragOver
                ? 'border-[#b87333] bg-[#fdf2e8]'
                : 'border-[#e5e0d8] bg-[#fdfaf6]'
            }`}
            data-testid="visual-chat-dropzone"
            onDragOver={(event: DragEvent) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event: DragEvent) => {
              event.preventDefault();
              setIsDragOver(false);
              void addImageAttachments(event.dataTransfer?.files || null);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onInput={(event: Event) => {
                  setChatInput((event.target as HTMLTextAreaElement).value);
                }}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendSearch();
                  }
                }}
                rows={2}
                className="min-h-[56px] flex-1 rounded-md border border-[#e5e0d8] bg-white px-3 py-2 text-sm text-[#2c2c2c] focus:border-[#b87333] focus:outline-none"
                placeholder="Ask a visual question..."
                data-testid="visual-chat-input"
              />
              <button
                type="button"
                className="rounded-md border border-[#e5e0d8] bg-white px-3 py-2 text-xs text-[#444] hover:bg-[#f5f0e8]"
                data-testid="visual-chat-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                className="rounded-md bg-[#b87333] px-3 py-2 text-xs font-medium text-white hover:bg-[#a06028] disabled:opacity-60"
                data-testid="visual-chat-search-btn"
                disabled={!chatInput.trim() || chatBusy}
                onClick={() => void handleSendSearch()}
              >
                {chatBusy ? 'Searching...' : 'Search'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              data-testid="visual-chat-file-input"
              onChange={(event: Event) => {
                const input = event.target as HTMLInputElement;
                void addImageAttachments(input.files);
                input.value = '';
              }}
            />

            {chatStatus && (
              <p className="mt-2 text-xs text-[#8a5a2f]" data-testid="visual-chat-status">
                {chatStatus}
              </p>
            )}
            <p className="mt-1 text-[11px] text-[#777]">
              Drag and drop image files here, or use Upload. Click overlays below
              to attach them to your query.
            </p>
          </div>
        </div>
      </div>

      {/* Missing Fields Section */}
      {missingFields.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-[#2c2c2c] font-['Space_Grotesk']">
            Missing Field Overlays ({missingFields.length})
          </h3>
          <div className="space-y-2">
            {missingFields.map((field: VisualField) => (
              <div
                key={field.id}
                className="p-3 bg-[#fdfaf6] border border-[#e5e0d8] rounded-lg flex justify-between items-center"
                data-testid={`missing-field-${field.id}`}
              >
                <div>
                  <div className="text-sm font-medium text-[#2c2c2c]">{field.label}</div>
                  <div className="text-xs text-red-600 mt-1">
                    <i className="fas fa-exclamation-circle mr-1" aria-hidden="true"></i>
                    No overlay mapped
                  </div>
                </div>
                <button
                  onClick={() => handleLabelField(field.id)}
                  className="px-3 py-1.5 bg-[#b87333] text-white rounded-md text-xs font-medium hover:bg-[#a06028] transition-colors"
                  data-testid={`label-btn-${field.id}`}
                  aria-label={`Label ${field.label} field`}
                >
                  <i className="fas fa-pencil-alt mr-1" aria-hidden="true"></i>
                  Label
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-[#f5f0e8] rounded-md text-xs text-[#666]">
            <i className="fas fa-lightbulb mr-1 text-[#b87333]" aria-hidden="true"></i>
            Click &quot;Label&quot; to draw a box on the document where this field appears.
          </div>
        </div>
      )}

      {/* Mapped Fields (for reference) */}
      {mappedFields.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-[#2c2c2c] font-['Space_Grotesk']">
            Mapped Fields ({mappedFields.length})
          </h3>
          <div className="space-y-2">
            {mappedFields.map((field: VisualField) => (
              <div
                key={field.id}
                className="p-3 bg-white border border-[#e5e0d8] rounded-lg flex justify-between items-center"
                data-testid={`mapped-field-${field.id}`}
              >
                <div>
                  <div className="text-sm font-medium text-[#2c2c2c]">{field.label}</div>
                  <div className="text-xs text-green-600 mt-1">
                    <i className="fas fa-check-circle mr-1" aria-hidden="true"></i>
                    Mapped to overlay
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      const overlay = overlays.find((o: VisualOverlay) => o.id === field.overlayId);
                      if (overlay) handleViewOverlay(overlay);
                    }}
                    className="px-3 py-1.5 bg-white border border-[#e5e0d8] rounded-md text-xs font-medium hover:bg-[#f5f0e8] transition-colors"
                    data-testid={`view-mapped-${field.id}`}
                    aria-label={`View ${field.label} overlay`}
                  >
                    <i className="fas fa-eye mr-1" aria-hidden="true"></i>
                    View
                  </button>
                  <button
                    onClick={() => {
                      const overlay = overlays.find((o: VisualOverlay) => o.id === field.overlayId);
                      if (overlay) {
                        addOverlayAttachment(overlay);
                      }
                    }}
                    className="ml-2 px-3 py-1.5 bg-white border border-[#e5e0d8] rounded-md text-xs font-medium hover:bg-[#f5f0e8] transition-colors"
                    data-testid={`attach-mapped-${field.id}`}
                    aria-label={`Attach ${field.label} overlay`}
                  >
                    <i className="fas fa-paperclip mr-1" aria-hidden="true"></i>
                    Attach
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Overlays Section */}
      {overlays.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-[#2c2c2c] font-['Space_Grotesk']">
            Document Overlays ({overlays.length})
          </h3>
          <div className="space-y-2">
            {overlays.map((overlay: VisualOverlay) => (
              <div
                key={overlay.id}
                className="p-3 bg-white border border-[#e5e0d8] rounded-lg"
                data-testid={`overlay-${overlay.id}`}
                onClick={(event: MouseEvent) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button')) return;
                  addOverlayAttachment(overlay);
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2c2c2c] truncate">{overlay.label}</div>
                    <div className="text-xs text-[#888] mt-1">
                      Page {overlay.pageNumber} • Confidence: {Math.round(overlay.confidence * 100)}%
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2 flex-shrink-0">
                    <button
                      onClick={() => addOverlayAttachment(overlay)}
                      className="px-2 py-1 bg-white text-[#2c2c2c] border border-[#e5e0d8] rounded text-xs hover:bg-[#f5f0e8] transition-colors"
                      data-testid={`attach-overlay-${overlay.id}`}
                      aria-label={`Attach ${overlay.label} overlay`}
                    >
                      <i className="fas fa-paperclip" aria-hidden="true"></i>
                    </button>
                    <button
                      onClick={() => handleViewOverlay(overlay)}
                      className="px-2 py-1 bg-[#f5f0e8] text-[#2c2c2c] border border-[#e5e0d8] rounded text-xs hover:bg-[#ebe5db] transition-colors"
                      data-testid={`view-overlay-${overlay.id}`}
                      aria-label={`View ${overlay.label} overlay`}
                    >
                      <i className="fas fa-eye" aria-hidden="true"></i>
                    </button>
                    <button
                      onClick={() => handleDeleteOverlay(overlay.id)}
                      disabled={deleteInProgress === overlay.id}
                      className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50 transition-colors"
                      data-testid={`delete-overlay-${overlay.id}`}
                      aria-label={`Delete ${overlay.label} overlay`}
                    >
                      {deleteInProgress === overlay.id ? (
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                      ) : (
                        <i className="fas fa-trash" aria-hidden="true"></i>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no fields or overlays */}
      {missingFields.length === 0 && mappedFields.length === 0 && overlays.length === 0 && (
        <div className="text-center text-[#888] py-6 mb-6">
          <i className="fas fa-shapes text-3xl mb-3 block opacity-50" aria-hidden="true"></i>
          <p className="text-sm">No overlay data available for this document.</p>
          <p className="text-xs mt-1">Use Visual Search to find and label regions.</p>
        </div>
      )}

      {/* Visual Search Section */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-[#2c2c2c] font-['Space_Grotesk']">
          Visual Search
        </h3>
        <button
          onClick={handleVisualSearch}
          className="w-full px-4 py-3 bg-[#b87333] text-white rounded-lg font-medium hover:bg-[#a06028] transition-colors flex items-center justify-center gap-2"
          data-testid="visual-search-btn"
        >
          <i className="fas fa-search" aria-hidden="true"></i>
          Start Visual Search
        </button>
        <div className="mt-3 p-3 bg-[#f5f0e8] rounded-md text-xs text-[#666]">
          <i className="fas fa-lightbulb mr-1 text-[#b87333]" aria-hidden="true"></i>
          Draw a box on the document to find similar visual regions across all documents.
        </div>
      </div>
    </div>
  );
}
