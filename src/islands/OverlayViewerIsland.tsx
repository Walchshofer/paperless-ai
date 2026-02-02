import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import type { OverlayViewerContract, OverlayItem } from '../ui/contracts/OverlayViewer.contract';
import { clampTranslate as utilsClampTranslate } from './overlay-utils';

let styles: Record<string, string> = {};
try {

  styles = require('./OverlayViewerIsland.module.css') as Record<string, string>;
} catch (_e: unknown) {
  // Fallback for SSR/tests
}

// Types for document change events
interface DocumentChangeDetail {
  documentId?: number | null;
  page?: number | null;
  originalUrl?: string | null;
  original_url?: string | null;
  pageCount?: number | null;
}

// Types for visual search results
interface VisualSearchResult {
  document_id: number;
  page: number;
  score: number;
  title?: string;
  thumbnail?: string;
}



// Types for legend items
interface LegendItem {
  key: string;
  label: string;
  color: string;
  isMandatory?: boolean;
}

// Types for normalized box input
interface BoxInput {
  x?: number;
  y?: number;


  width?: number;
  height?: number;
}

/**
 * OverlayViewerIsland - Document viewer with Red Pen selection and Visual Search
 *
 * Features:
 * - Document page preview
 * - Red Pen drawing mode for region selection
 * - Multi-box support with resize/remove
 * - Dispatches visual-search-requested events
 * - Visual Search Results Panel (Split View)
 * - Zoom/Pan controls
 * - Export Region support
 *
 * Architecture Reference: ticket:009.1, Stream 2.1, Stream 2.2, Stream 2.5
 */

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayViewerProps extends Partial<OverlayViewerContract> {
  onRegionSelected?: (imageBase64: string, bbox: BoundingBox) => void;
  overlayMode?: 'none' | 'document';
  showLegend?: boolean;
  allowSelection?: boolean;
  mode?: 'view' | 'draw' | 'locate' | 'visual-search';
  suggestions?: OverlayItem[];
}

// Minimum selection size (in pixels) to trigger search
const MIN_SELECTION_SIZE = 20;
// Minimum selection size (as fraction of container) to be valid
const MIN_SIZE_FRACTION = 0.01;

export default function OverlayViewerIsland(props: OverlayViewerProps) {
  const {
    documentId: initialDocumentId,
    page: initialPage = 1,
    originalUrl: initialOriginalUrl = null,
    onRegionSelected,
    overlayMode = 'none',
    showLegend = false,
    allowSelection = true,
    mode = 'visual-search',
    suggestions = [],
  } = props;

  const containerRef = useRef(null as HTMLDivElement | null);
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  const imageRef = useRef(null as HTMLImageElement | null);

  // Allow dynamic updates from page-level events
  const [docId, setDocId] = useState(initialDocumentId ?? null);
  const [page, setPage] = useState(initialPage);
  const [originalUrl, setOriginalUrl] = useState(initialOriginalUrl ?? null);
  const [pageCount, setPageCount] = useState(props?.pageCount ?? null);

  // Listen for page/document change events from the page and update in-place
  useEffect(() => {
    const handler = (e: Event) => {
      const d: DocumentChangeDetail = (e as CustomEvent<DocumentChangeDetail>)?.detail || {};
      if (d.documentId !== undefined && d.documentId !== null) setDocId(d.documentId);
      if (d.page !== undefined && d.page !== null) setPage(Number(d.page));
      // Accept either camelCase `originalUrl` or snake_case `original_url` from different emitters
      if (Object.prototype.hasOwnProperty.call(d, 'originalUrl')) setOriginalUrl(d.originalUrl ?? null);
      else if (Object.prototype.hasOwnProperty.call(d, 'original_url')) setOriginalUrl(d.original_url ?? null);
      if (Object.prototype.hasOwnProperty.call(d, 'pageCount')) setPageCount(d.pageCount === null ? null : Number(d.pageCount));
    };

    window.addEventListener('overlay:document-changed', handler as EventListener);
    return () => {
      window.removeEventListener('overlay:document-changed', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (initialDocumentId !== undefined && initialDocumentId !== null) {
      setDocId(initialDocumentId);
    }
  }, [initialDocumentId]);





  const normalizeOverlayBox = useCallback((box: BoxInput | null | undefined) => {
    if (!box) return null;
    const x = Number(box.x ?? 0);
    const y = Number(box.y ?? 0);
    const width = Number(box.width ?? 0);
    const height = Number(box.height ?? 0);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

    const maxVal = Math.max(x + width, y + height);
    const scale = maxVal <= 1 ? 1 : 1000;

    return {
      left: (x / scale) * 100,
      top: (y / scale) * 100,
      width: (width / scale) * 100,
      height: (height / scale) * 100,
    };
  }, []);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const drawModeRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const [boxes, setBoxes] = useState([] as BoundingBox[]);
  const [currentBox, setCurrentBox] = useState(null as BoundingBox | null);
  const currentBoxRef = useRef(null as BoundingBox | null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(null as string | null);
  const [warning, setWarning] = useState(null as string | null);
  // Image loading state: 'loading' | 'loaded' | 'error'
  const [imageLoadState, setImageLoadState] = useState('loading' as 'loading' | 'loaded' | 'error');
  // Tracks which URL source is currently being tried: 'normalized' | 'original'
  const [imageSource, setImageSource] = useState('normalized' as 'normalized' | 'original');
  // Retry counter to force re-attempts
  const [retryCount, setRetryCount] = useState(0);
  const [legend, setLegend] = useState([] as LegendItem[]);
  const [overlayItems, setOverlayItems] = useState([] as OverlayItem[]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState(null as string | null);
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [overlayDomain, setOverlayDomain] = useState('general');
  const selectionEnabled = allowSelection !== false;

  // Zoom & Pan state
  const viewportRef = useRef(null as HTMLDivElement | null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const translateRef = useRef({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const panActiveRef = useRef(false);
  const lastPanPointRef = useRef(null as { x: number; y: number } | null);

  // Imperative refs for ARIA attributes to satisfy axe static analysis
  const drawModeButtonRef = useRef(null as HTMLButtonElement | null);
  const panModeButtonRef = useRef(null as HTMLButtonElement | null);

  // Visual Search / Split View state
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([] as VisualSearchResult[]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null as string | null);
  const [splitPos, setSplitPos] = useState(60); // Percentage width of document viewer
  const [isResizing, setIsResizing] = useState(false);
  const [highlightedRegion, setHighlightedRegion] = useState(null as BoundingBox | null);

  // Draw context for Visual Tab integration (label-field or visual-search)
  const [drawContext, setDrawContext] = useState(null as { fieldId?: string; purpose?: string } | null);
  const drawContextRef = useRef(null as { fieldId?: string; purpose?: string } | null);
  
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;
  const SCALE_STEP = 0.1;

  // Helper to set scale with clamping
  const applyScale = useCallback((next: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    scaleRef.current = clamped;
    setScale(clamped);
  }, []);

  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    const container = containerRef.current;
    if (!container) return { x: tx, y: ty };

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const img = imageRef.current;
    const natW = img && img.naturalWidth ? img.naturalWidth : null;
    const natH = img && img.naturalHeight ? img.naturalHeight : null;

    try {
            const clamped = utilsClampTranslate(tx, ty, s, cw, ch, natW, natH, 'contain');
      return { x: clamped.x, y: clamped.y };
    } catch (_e: unknown) {
      const minX = Math.min(0, cw - cw * s);
      const maxX = 0;
      const minY = Math.min(0, ch - ch * s);
      const maxY = 0;

      const cx = Math.min(maxX, Math.max(minX, tx));
      const cy = Math.min(maxY, Math.max(minY, ty));

      return { x: cx, y: cy };
    }
  }, []);

  const applyTranslate = useCallback((x: number, y: number) => {
    const clamped = clampTranslate(x, y, scaleRef.current || 1);
    translateRef.current = { x: clamped.x, y: clamped.y };
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  }, [clampTranslate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ bbox?: { x: number; y: number; width: number; height: number }; page?: number }>)?.detail || {};
      const { bbox, page: targetPage } = detail;
      if (targetPage && targetPage !== page) setPage(targetPage);
      if (bbox) {
        setHighlightedRegion({ ...bbox, id: 'highlight' });

        // Zoom to region logic
        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          
          const w = bbox.width;
          const h = bbox.height;
          // desired coverage: 0.6 (60% of viewport)
          const desiredCoverage = 0.6;
          // Avoid division by zero
          const scaleX = w > 0 ? desiredCoverage / w : 1;
          const scaleY = h > 0 ? desiredCoverage / h : 1;
          const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));
          
          const cx = bbox.x + bbox.width / 2;
          const cy = bbox.y + bbox.height / 2;
          
          const tx = (cw / 2) - (cx * cw * newScale);
          const ty = (ch / 2) - (cy * ch * newScale);
          
          applyScale(newScale);
          applyTranslate(tx, ty);
        }

        setTimeout(() => setHighlightedRegion(null), 5000);
      }
    };
    window.addEventListener('overlay:highlight-region', handler as EventListener);
    return () => window.removeEventListener('overlay:highlight-region', handler as EventListener);
  }, [page, applyScale, applyTranslate]);

  // Listen for draw mode activation from Visual Tab
  useEffect(() => {
    const handleActivateDrawMode = (e: Event) => {
      const detail = (e as CustomEvent<{ fieldId?: string; purpose?: string }>)?.detail || {};
      const { fieldId, purpose } = detail;

      // Store context for when draw completes
      const ctx = { fieldId, purpose };
      setDrawContext(ctx);
      drawContextRef.current = ctx;

      // Activate draw mode
      drawModeRef.current = true;
      setIsDrawMode(true);

      // Disable pan mode if active
      setPanMode(false);
    };

    const handleCancelDraw = () => {
      // Clear draw context and deactivate draw mode
      setDrawContext(null);
      drawContextRef.current = null;
      drawModeRef.current = false;
      setIsDrawMode(false);
      isDrawingRef.current = false;
      currentBoxRef.current = null;
      setIsDrawing(false);
      setCurrentBox(null);
    };

    window.addEventListener('overlay:activate-draw-mode', handleActivateDrawMode as EventListener);
    window.addEventListener('overlay:draw-cancelled', handleCancelDraw);
    return () => {
      window.removeEventListener('overlay:activate-draw-mode', handleActivateDrawMode as EventListener);
      window.removeEventListener('overlay:draw-cancelled', handleCancelDraw);
    };
  }, []);

  const resetView = useCallback(() => {
    applyScale(1);
    applyTranslate(0, 0);
  }, [applyScale, applyTranslate]);

  const zoomIn = useCallback(() => applyScale(scaleRef.current + SCALE_STEP), [applyScale]);
  const zoomOut = useCallback(() => applyScale(scaleRef.current - SCALE_STEP), [applyScale]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!viewportRef.current || !containerRef.current) return;
    const delta = -e.deltaY;
    const factor = e.ctrlKey || e.metaKey ? 0.0015 : 0.0025;
    const s = scaleRef.current || 1;
    const nextS = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (1 + delta * factor)));
    if (Math.abs(nextS - s) < 1e-5) return;

    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const sx = nextS / s;
    const currentTx = translateRef.current.x || 0;
    const currentTy = translateRef.current.y || 0;
    const nextTx = currentTx * sx + rawX * (1 - sx);
    const nextTy = currentTy * sx + rawY * (1 - sx);

    applyScale(nextS);
    applyTranslate(nextTx, nextTy);

    e.preventDefault();
  }, [applyScale, applyTranslate]);

  const togglePanMode = useCallback(() => {
    const next = !panMode;
    setPanMode(next);
    if (next) {
      drawModeRef.current = false;
      setIsDrawMode(false);
    }
  }, [panMode]);

  // Compute the normalized URL (preferred source for Visual RAG)
  const normalizedUrl = useMemo(() => {
    if (!docId) return null;
    return `/api/visual-rag/normalized/${docId}?page=${page}`;
  }, [docId, page]);

  // Compute the original URL (fallback source from Paperless)
  const originalUrlWithPage = useMemo(() => {
    if (!originalUrl) return null;
    return `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}page=${page}`;
  }, [originalUrl, page]);

  // Priority: normalized URL first, fallback to original URL based on imageSource state
  const imageUrl = useMemo(() => {
    if (!docId) return null;
    
    // Priority 1: Try normalized URL (preferred for Visual RAG)
    if (imageSource === 'normalized' && normalizedUrl) {
      return normalizedUrl;
    }
    
    // Priority 2: Fallback to original URL (Paperless download)
    if (imageSource === 'original' && originalUrlWithPage) {
      return originalUrlWithPage;
    }
    
    // If we're in original mode but have no originalUrl, use normalized anyway
    if (normalizedUrl) {
      return normalizedUrl;
    }
    
    return null;
  }, [docId, imageSource, normalizedUrl, originalUrlWithPage]);

  // Reset to normalized source when document or page changes
  useEffect(() => {
    setImageSource('normalized');
    setImageLoadState('loading');
    setRetryCount(0);
  }, [docId, page]);

  // Image loading effect with fallback mechanism
  useEffect(() => {
    if (!imageUrl) {
      setImageLoadState('error');
      setImageError('No image URL available');
      setImageLoaded(false);
      return;
    }
    
    setImageLoaded(false);
    setImageError(null);
    setImageLoadState('loading');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      if (imageRef.current) {
        imageRef.current.src = img.src;
        try {
          const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
          if (area > 20000000) {
            setWarning('Large document image detected. Rendering may be slow.');
          }
        } catch (err: unknown) {
          // Do not silently swallow — log for observability and continue
          const msg = err instanceof Error ? err.message : String(err);
          // Warn instead of throwing to avoid breaking image load
          console.warn('[OverlayViewerIsland] Failed to compute image area for warning detection:', msg);
        }
      }
      setImageLoaded(true);
      setImageLoadState('loaded');
      setImageError(null);
      console.info(`[OverlayViewerIsland] Image loaded from ${imageSource} source: ${imageUrl}`);
    };
    
    img.onerror = () => {
      console.warn(`[OverlayViewerIsland] Failed to load image from ${imageSource} source: ${imageUrl}`);
      
      // If normalized URL failed and we have an original URL, try that next
      if (imageSource === 'normalized' && originalUrlWithPage) {
        console.info('[OverlayViewerIsland] Falling back to original URL');
        setImageSource('original');
        // Don't set error state yet - let the fallback attempt
        return;
      }
      
      // All sources exhausted - show error
      setImageError(`Failed to load document image from ${imageSource === 'normalized' ? 'visual-rag' : 'paperless'}`);
      setImageLoadState('error');
      setImageLoaded(false);
    };
    
    img.src = imageUrl;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, imageSource, originalUrlWithPage, retryCount]);

  // Retry handler - resets to normalized and increments retry count
  const handleRetry = useCallback(() => {
    setImageSource('normalized');
    setRetryCount((c: number) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadOverlays = async () => {
      if (overlayMode !== 'document' || !docId) {
        setOverlayItems([]);
        setOverlayError(null);
        setOverlayLoading(false);
        return;
      }
      setOverlayLoading(true);
      setOverlayError(null);
      try {
        const response = await fetch(`/api/visual-rag/overlays/${docId}?page=${page}`);
        if (!response.ok) throw new Error('Failed to load overlays');
        const data = await response.json();
        const overlays = (Array.isArray(data.overlays) ? data.overlays : []) as OverlayItem[];
        if (!cancelled) {
          setOverlayItems(overlays);
          const domain = overlays[0]?.domain || 'general';
          setOverlayDomain(String(domain).toLowerCase());
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setOverlayError(errorMessage || 'Overlay load failed');
          setOverlayItems([]);
        }
      } finally {
        if (!cancelled) setOverlayLoading(false);
      }
    };
    void loadOverlays();
    resetView();
    return () => { cancelled = true; };
  }, [overlayMode, docId, page, resetView]);

  useEffect(() => {
    let cancelled = false;
    const loadUserAnnotations = async () => {
      if (!docId) return;
      try {
        const resp = await fetch(`/manual/annotations/${docId}?page=${page}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const anns = Array.isArray(data.annotations) ? data.annotations : [];
        document.dispatchEvent(new CustomEvent('annotations:loaded', { detail: { annotations: anns } }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Failed to load user annotations', msg);
      }
    };
    void loadUserAnnotations();

    const saveListener = async (e: Event) => {
      const payload = (e as CustomEvent)?.detail;
      if (!payload || !payload.documentId || !Array.isArray(payload.annotations)) return;
      try {
        const resp = await fetch('/manual/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const txt = await resp.text();
          console.error('Failed to persist annotations', txt);
          return;
        }
        const result = await resp.json();
        if (cancelled) return;
        const created = Array.isArray(result.created) ? result.created : [];
        document.dispatchEvent(new CustomEvent('annotations:loaded', { detail: { annotations: created } }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Annotation save failed', msg);
      }
    };
    document.addEventListener('payload:ready', saveListener as EventListener);
    return () => {
      cancelled = true;
      document.removeEventListener('payload:ready', saveListener as EventListener);
    };
  }, [docId, page]);

  useEffect(() => {
    let cancelled = false;
    const loadLegend = async () => {
      if (!showLegend) return;
      try {
        const resp = await fetch(`/api/visual-rag/legend/${overlayDomain}`);
        if (!resp.ok) throw new Error('Legend not available');
        const data = await resp.json();
        if (!cancelled) setLegend(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          // Log the legend fetch failure for debugging and metrics
          console.warn('[OverlayViewerIsland] Failed to load legend:', msg);
          setLegend([]);
        }
      }
    };
    void loadLegend();
    return () => { cancelled = true; };
  }, [overlayDomain, showLegend]);

  // Handle Visual Search requests
  useEffect(() => {
    const handler = async (e: Event) => {
      const customEvent = e as CustomEvent<{ imageBase64?: string; collection?: string } | undefined>;
      const { imageBase64, collection } = customEvent?.detail || {};
      
      setResultsLoading(true);
      setResultsError(null);
      setShowResults(true); // Open panel
      setResults([]);

      try {
        const response = await fetch('/api/visual-rag/search/visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64, collection, k: 10 })
        });
        
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Search failed: ${response.status} ${text}`);
        }
        
        const data = await response.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setResultsError(msg || 'Visual search failed');
      } finally {
        setResultsLoading(false);
      }
    };

    window.addEventListener('visual-search-requested', handler as EventListener);
    return () => window.removeEventListener('visual-search-requested', handler as EventListener);
  }, []);

  const getRelativePosition = useCallback(
    (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      const tx = translateRef.current.x || 0;
      const ty = translateRef.current.y || 0;
      const s = scaleRef.current || 1;
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return { x: (rawX - tx) / s, y: (rawY - ty) / s };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!selectionEnabled || !drawModeRef.current) return;
      e.preventDefault();
      const pos = getRelativePosition(e);
      const nextBox = { id: `box-${Date.now()}`, x: pos.x, y: pos.y, width: 0, height: 0 };
      isDrawingRef.current = true;
      currentBoxRef.current = nextBox;
      setIsDrawing(true);
      setCurrentBox(nextBox);
      setWarning(null);
    },
    [getRelativePosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current || !currentBoxRef.current) return;
      e.preventDefault();
      const pos = getRelativePosition(e);
      const nextBox = {
        ...currentBoxRef.current,
        width: pos.x - currentBoxRef.current.x,
        height: pos.y - currentBoxRef.current.y
      };
      currentBoxRef.current = nextBox;
      setCurrentBox(nextBox);
    },
    [getRelativePosition]
  );

  const captureRegion = useCallback(
    async (box: BoundingBox, eventName: string) => {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;
      if (!imageLoaded && !imageError) {
          return;
      }

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const naturalWidth = img.naturalWidth || container.clientWidth;
        const naturalHeight = img.naturalHeight || container.clientHeight;
        const scaleX = naturalWidth / container.clientWidth;
        const scaleY = naturalHeight / container.clientHeight;
        const srcX = box.x * scaleX;
        const srcY = box.y * scaleY;
        const srcWidth = box.width * scaleX;
        const srcHeight = box.height * scaleY;
        canvas.width = srcWidth;
        canvas.height = srcHeight;

        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, srcWidth, srcHeight);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        // Include draw context from Visual Tab (fieldId, purpose)
        const context = drawContextRef.current || {};
        
        const event = new CustomEvent(eventName, {
          detail: {
            imageBase64: base64,
            collection: 'visual_pages',
            documentId: docId,
            page,
            bbox: {
              x: box.x / container.clientWidth,
              y: box.y / container.clientHeight,
              width: box.width / container.clientWidth,
              height: box.height / container.clientHeight
            },
            // Include draw context for Visual Tab integration
            fieldId: context.fieldId,
            purpose: context.purpose
          }
        });
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(event);
        }
        if (eventName === 'visual-search-requested' && onRegionSelected) {
          onRegionSelected(base64, box);
        }

        // Clear draw context after dispatching
        if (eventName === 'overlay:draw-complete') {
          setDrawContext(null);
          drawContextRef.current = null;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Failed to capture region:', errorMessage);
        setWarning('Failed to capture selection. Please try again.');
      }
    },
    [docId, page, imageLoaded, imageError, onRegionSelected]
  );

  const handleMouseUp = useCallback((e?: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current || !currentBoxRef.current) return;
    if (e) {
      const pos = getRelativePosition(e);
      currentBoxRef.current = {
        ...currentBoxRef.current,
        width: pos.x - currentBoxRef.current.x,
        height: pos.y - currentBoxRef.current.y
      };
      setCurrentBox(currentBoxRef.current);
    }
    const activeBox = currentBoxRef.current;
    isDrawingRef.current = false;
    setIsDrawing(false);
    const container = containerRef.current;
    if (!container) return;
    const normalizedBox: BoundingBox = {
      ...activeBox,
      x: activeBox.width < 0 ? activeBox.x + activeBox.width : activeBox.x,
      y: activeBox.height < 0 ? activeBox.y + activeBox.height : activeBox.y,
      width: Math.abs(activeBox.width),
      height: Math.abs(activeBox.height)
    };
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (normalizedBox.width < MIN_SELECTION_SIZE || normalizedBox.height < MIN_SELECTION_SIZE) {
      setWarning('Selection too small. Please draw a larger box.');
      currentBoxRef.current = null;
      setCurrentBox(null);
      return;
    }
    const widthFraction = normalizedBox.width / containerWidth;
    const heightFraction = normalizedBox.height / containerHeight;
    if (widthFraction < MIN_SIZE_FRACTION || heightFraction < MIN_SIZE_FRACTION) {
      setWarning('Selection too small to yield meaningful results.');
      currentBoxRef.current = null;
      setCurrentBox(null);
      return;
    }
    setBoxes((prev: BoundingBox[]) => [...prev, normalizedBox]);
    currentBoxRef.current = null;
    setCurrentBox(null);
    
    if (mode === 'draw') {
      captureRegion(normalizedBox, 'overlay:draw-complete');
    } else {
      captureRegion(normalizedBox, 'visual-search-requested');
    }
  }, [captureRegion, getRelativePosition, mode]);

  const removeBox = useCallback((boxId: string) => {
    setBoxes((prev: BoundingBox[]) => prev.filter((b: BoundingBox) => b.id !== boxId));
  }, []);

  const clearAllBoxes = useCallback(() => {
    setBoxes([]);
    setWarning(null);
  }, []);

  const toggleDrawMode = useCallback(() => {
    if (!selectionEnabled) return;
    const next = !drawModeRef.current;
    drawModeRef.current = next;
    setIsDrawMode(next);
    if (!next) {
      isDrawingRef.current = false;
      currentBoxRef.current = null;
      setIsDrawing(false);
      setCurrentBox(null);
    }
  }, []);

  useEffect(() => {
    drawModeRef.current = isDrawMode;
  }, [isDrawMode]);

  // Reflect button pressed state as literal strings for axe accessibility
  useEffect(() => {
    if (drawModeButtonRef.current) {
      drawModeButtonRef.current.setAttribute('aria-pressed', isDrawMode ? 'true' : 'false');
    }
    if (panModeButtonRef.current) {
      panModeButtonRef.current.setAttribute('aria-pressed', panMode ? 'true' : 'false');
    }
  }, [isDrawMode, panMode]);

  const changePage = useCallback((delta: number) => {
    const next = Math.max(1, page + delta);
    if (pageCount && next > pageCount) return;
    setPage(next);
    const ev = new CustomEvent('overlay:document-changed', {
      detail: { documentId: docId, page: next, originalUrl, pageCount }
    });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(ev);
    }
  }, [page, pageCount, docId, originalUrl]);

  useEffect(() => {
    const handleGlobalUp = (event: Event) => {
      if (isDrawingRef.current) handleMouseUp(event as MouseEvent);
      if (isResizing) setIsResizing(false);
    };
    const handleGlobalMove = (e: MouseEvent) => {
      if (isResizing) {
        const container = containerRef.current?.parentElement?.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const percent = ((e.clientX - rect.left) / rect.width) * 100;
          setSplitPos(Math.min(80, Math.max(20, percent)));
        }
      }
    };

    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
    };
  }, [handleMouseUp, isResizing]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel as EventListener);
  }, [handleWheel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target) {
        const t = (e.target as HTMLElement);
        const tag = (t.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      }
      if (e.key === '+' || e.key === '=') { zoomIn(); e.preventDefault(); }
      else if (e.key === '-') { zoomOut(); e.preventDefault(); }
      else if (e.key === '0' || e.key.toLowerCase() === 'r') { resetView(); e.preventDefault(); }
      else if (e.code === 'Space') { togglePanMode(); e.preventDefault(); }
      else if (e.key.startsWith('Arrow') && panMode) {
        const step = 20;
        if (e.key === 'ArrowLeft') applyTranslate(translateRef.current.x + step, translateRef.current.y);
        if (e.key === 'ArrowRight') applyTranslate(translateRef.current.x - step, translateRef.current.y);
        if (e.key === 'ArrowUp') applyTranslate(translateRef.current.x, translateRef.current.y + step);
        if (e.key === 'ArrowDown') applyTranslate(translateRef.current.x, translateRef.current.y - step);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, resetView, togglePanMode, panMode, applyTranslate]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (panMode) {
      panActiveRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current?.setPointerCapture) containerRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (!selectionEnabled || !drawModeRef.current) return;
    pointerActiveRef.current = true;
    if (containerRef.current?.setPointerCapture) containerRef.current.setPointerCapture(e.pointerId);
    handleMouseDown(e as PointerEvent);
  }, [handleMouseDown, panMode]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (panActiveRef.current && lastPanPointRef.current) {
      const last = lastPanPointRef.current;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const nextX = (translateRef.current.x || 0) + dx;
      const nextY = (translateRef.current.y || 0) + dy;
      applyTranslate(nextX, nextY);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    handleMouseMove(e as PointerEvent);
  }, [handleMouseMove, applyTranslate]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (panActiveRef.current) {
      panActiveRef.current = false;
      lastPanPointRef.current = null;
      if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    handleMouseUp(e as PointerEvent);
    pointerActiveRef.current = false;
    if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e.pointerId);
  }, [handleMouseUp]);

  const handlePointerCancel = useCallback((e: PointerEvent) => {
    pointerActiveRef.current = false;
    panActiveRef.current = false;
    lastPanPointRef.current = null;
    if (containerRef.current?.releasePointerCapture) containerRef.current.releasePointerCapture(e.pointerId);
  }, []);

  const handleMouseDownFallback = useCallback((e: MouseEvent | TouchEvent) => { if (!pointerActiveRef.current) handleMouseDown(e); }, [handleMouseDown]);
  const handleMouseMoveFallback = useCallback((e: MouseEvent | TouchEvent) => { if (!pointerActiveRef.current) handleMouseMove(e); }, [handleMouseMove]);
  const handleMouseUpFallback = useCallback((e?: MouseEvent | TouchEvent) => { if (!pointerActiveRef.current) handleMouseUp(e); }, [handleMouseUp]);

  const visibleOverlays = useMemo(() => {
    if (!overlayItems || overlayItems.length === 0) return [];
    if (!mandatoryOnly) return overlayItems;
    return overlayItems.filter((o: OverlayItem) => o.isMandatory);
  }, [overlayItems, mandatoryOnly]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(220, 20, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(220, 20, 60, 0.1)';
    boxes.forEach((box: BoundingBox) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });
    if (currentBox && isDrawing) {
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)';
      ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
    }
  }, [boxes, currentBox, isDrawing]);

  return (
    <div
      data-testid="overlay-viewer-root"
      data-hydrated="true"
      data-has-boxes={boxes.length}
      data-has-warning={warning ? 'true' : 'false'}
      data-original-url={originalUrl || ''}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-white z-10">
        {selectionEnabled && (
          <button
            data-testid="red-pen-toggle"
            onClick={toggleDrawMode}
            ref={drawModeButtonRef}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDrawMode
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className={`fas fa-pen mr-1.5 ${isDrawMode ? 'animate-pulse' : ''}`}></i>
            {isDrawMode ? 'Drawing Mode' : 'Draw Mode'}
          </button>
        )} 

        {selectionEnabled && boxes.length > 0 && (
          <button
            data-testid="clear-boxes"
            onClick={clearAllBoxes}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600"
          >
            <i className="fas fa-trash-alt mr-1"></i>
            Clear ({boxes.length})
          </button>
        )}

        {overlayMode === 'document' && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {overlayLoading && <span>Loading overlays...</span>}
            {!overlayLoading && (
              <span data-testid="overlay-count">
                Overlays: {overlayItems.length}
              </span>
            )}
            {overlayError && <span className="text-red-600">{overlayError}</span>}
            {overlayItems.length > 0 && (
              <label className="flex items-center gap-1 ml-2">
                <input
                  type="checkbox"
                  checked={mandatoryOnly}
                  onChange={(e: Event) => setMandatoryOnly((e.target as HTMLInputElement).checked)}
                />
                Mandatory only
              </label>
            )}
          </div>
        )}

        {showLegend && legend.length > 0 && (
          <div data-testid="overlay-legend" className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {legend.map((item: { key: string; label: string; color: string; isMandatory?: boolean }) => (
              <div key={item.key} className="flex items-center gap-1">
                <span className={`${styles.legendDot} [--dot-color:${item.color}]`} aria-hidden="true"></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-2">
          <button aria-label="Zoom out" data-testid="overlay-zoom-out" onClick={zoomOut} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">-</button>
          <span data-testid="overlay-zoom-percentage" className="text-xs text-gray-500 w-8 text-center">{Math.round(scale * 100)}%</span>
          <button aria-label="Zoom in" data-testid="overlay-zoom-in" onClick={zoomIn} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">+</button>
          <button aria-label="Reset zoom" data-testid="overlay-zoom-reset" onClick={resetView} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Reset</button>
          <button data-testid="overlay-pan-toggle" onClick={togglePanMode} ref={panModeButtonRef} className={`px-2 py-1 rounded hover:bg-gray-200 ${panMode ? 'bg-gray-300' : 'bg-gray-100'}`}>Pan</button>
        </div>
        
        {showResults && (
           <button onClick={() => setShowResults(false)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2 hover:bg-blue-200">
              <i className="fas fa-columns mr-1"></i> Hide Results
           </button>
        )}
        {!showResults && results.length > 0 && (
           <button onClick={() => setShowResults(true)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2 hover:bg-blue-200">
              <i className="fas fa-columns mr-1"></i> Show Results
           </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            data-testid="overlay-prev-page"
            onClick={() => changePage(-1)}
            aria-label="Previous page"
            disabled={page <= 1}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <span data-testid="overlay-page-indicator" className="text-xs text-gray-500">
            Page {page}{pageCount ? ` of ${pageCount}` : ''}
          </span>

          <button
            data-testid="overlay-next-page"
            onClick={() => changePage(1)}
            aria-label="Next page"
            disabled={pageCount ? page >= pageCount : false}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {warning && (
        <div
          className="mx-2 my-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700"
          data-testid="selection-warning"
        >
          <i className="fas fa-exclamation-triangle mr-1"></i>
          {warning}
        </div>
      )}

      {/* Split View Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Document Viewer */}
        <div
            className={`${styles.documentPane} ${showResults ? `[--pane-width:${splitPos}%]` : `[--pane-width:100%]`}`}
        >
          <div
            ref={containerRef}
            data-testid="overlay-container"
            className={`relative flex-1 overflow-hidden ${panMode ? (panActiveRef.current ? 'cursor-grabbing' : 'cursor-grab') : (isDrawMode ? 'cursor-crosshair' : 'cursor-default')} ${isDrawMode ? 'touch-none' : 'touch-auto'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => { if (isDrawingRef.current) handleMouseUp(); }}
            onMouseDown={handleMouseDownFallback as (e: MouseEvent) => void}
            onMouseMove={handleMouseMoveFallback as (e: MouseEvent) => void}
            onMouseUp={handleMouseUpFallback as (e: MouseEvent) => void}
            onMouseLeave={() => { if (pointerActiveRef.current) return; if (isDrawingRef.current) handleMouseUp(); }}
            onTouchStart={handleMouseDownFallback as (e: TouchEvent) => void}
            onTouchMove={handleMouseMoveFallback as (e: TouchEvent) => void}
            onTouchEnd={handleMouseUpFallback as (e: TouchEvent) => void}
          >
            <div
              ref={viewportRef}
              data-testid="overlay-viewport"
              className={`${styles.viewport} [--viewport-transform:translate(${translateX}px, ${translateY}px) scale(${scale})]`}
            >
              {imageUrl && !imageError ? (
                <img
                  ref={imageRef}
                  alt={`Document ${docId} page ${page}`}
                  className={`w-full h-full object-contain pointer-events-none select-none ${imageLoaded ? 'block' : 'hidden'}`}
                  data-testid="overlay-document-image"
                  draggable={false}
                  crossOrigin="anonymous"
                  onDragStart={(e: Event) => e.preventDefault()}
                />
              ) : null}

              {imageUrl && !imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center" data-testid="overlay-loading">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-copper mx-auto mb-2"></div>
                    <p className="text-sm text-[#555] font-['Space_Grotesk']">Loading document...</p>
                  </div>
                </div>
              )}

              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center" data-testid="image-error">
                  <div className="text-center max-w-md px-4">
                    <i className="fas fa-exclamation-triangle text-3xl text-red-500 mb-4"></i>
                    <p className="font-['Space_Grotesk'] text-[#555] mb-2">Failed to load document</p>
                    <p className="text-sm text-[#888] mb-4">{imageError}</p>
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-copper text-white rounded-md hover:bg-copper/80 transition-colors font-['Space_Grotesk']"
                      data-testid="image-retry-button"
                      type="button"
                    >
                      <i className="fas fa-sync-alt mr-2"></i>
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-gray-500">No document selected</p>
                </div>
              )}

              {suggestions.map((item, idx) => {
                const box = normalizeOverlayBox(item.boundingBox);
                if (!box) return null;
                return (
                  <div
                    key={`ghost-${idx}`}
                    data-testid="overlay-ghost-box"
                    data-label={item.label}
                    className={`${styles.overlayBox} [--box-left:${box.left}%] [--box-top:${box.top}%] [--box-width:${box.width}%] [--box-height:${box.height}%] border-dashed border-2 border-gray-400 bg-gray-100/20`}
                    title={item.label || 'Suggestion'}
                  >
                    {item.label && <span className="absolute -top-5 left-0 text-xs bg-gray-200 text-gray-700 px-1 rounded">{item.label}</span>}
                  </div>
                );
              })}

              {overlayMode === 'document' && visibleOverlays.map((overlay: OverlayItem, idx: number) => {
                const box = normalizeOverlayBox(overlay.boundingBox);
                if (!box) return null;
                const color = overlay.color || '#2563eb';
                return (
                  <div
                    key={overlay.id || `${overlay.label}-${idx}`}
                    data-testid="overlay-box"
                    className={`${styles.overlayBox} [--box-left:${box.left}%] [--box-top:${box.top}%] [--box-width:${box.width}%] [--box-height:${box.height}%] [--box-color:${color}] [--box-bg:${color}22]`}
                  >
                    <span className={`${styles.overlayLabel} [--box-color:${color}]`}>
                      {overlay.label || 'Overlay'}
                    </span>
                  </div>
                );
              })}

              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" data-testid="annotation-canvas" />
              
              {highlightedRegion && (
                <div
                  data-testid="overlay-highlight-region"
                  className={`${styles.highlightRegion} animate-pulse [--region-left:${highlightedRegion.x * 100}%] [--region-top:${highlightedRegion.y * 100}%] [--region-width:${highlightedRegion.width * 100}%] [--region-height:${highlightedRegion.height * 100}%]`}
                />
              )}
            </div>

            {boxes.map((box: BoundingBox, idx: number) => (
              <div key={box.id} className={`${styles.selectionBoxContainer} [--sel-left:${box.x}px] [--sel-top:${box.y - 24}px]`}>
                <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">Region {idx + 1}</span>
                <button
                  onClick={() => removeBox(box.id)}
                  className="w-5 h-5 bg-white border border-gray-300 rounded-l-none border-l-0 text-xs text-gray-600 hover:text-red-600 hover:border-red-300"
                  title="Remove this selection"
                >
                  <i className="fas fa-times"></i>
                </button>
                <button
                  onClick={() => captureRegion(box, 'export:region-requested')}
                  className="w-5 h-5 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 ml-1"
                  title="Export this region"
                >
                  <i className="fas fa-download"></i>
                </button>
                <button
                  onClick={() => {
                    captureRegion(box, 'manual:send-to-chat');
                    // We need to capture first, then the event handler will handle navigation.
                    // Actually captureRegion dispatches the event. We need to handle the event globally or inline here.
                    // The ticket suggests: dispatch event, then navigate.
                    // But captureRegion is async and dispatches 'manual:send-to-chat' with base64.
                    // We should add a listener for this specific 'manual:send-to-chat' in the island or just handle it here?
                    // captureRegion dispatches the event passed as arg.
                    // So we need a global listener to handle the navigation if we rely on captureRegion.
                    // OR we modify captureRegion to return the data and we navigate here.
                    // But captureRegion is void.
                    // Let's rely on a global listener in ManualWorkspaceIsland or just add a one-off listener here.
                    const onSend = (e: Event) => {
                      const { imageBase64, bbox, page, documentId } = (e as CustomEvent).detail || {};
                      const context = { type: 'visual', data: { imageBase64, bbox, page }, documentId };
                      window.location.href = `/chat?context=${encodeURIComponent(JSON.stringify(context))}`;
                    };
                    window.addEventListener('manual:send-to-chat', onSend, { once: true });
                  }}
                  className="w-5 h-5 bg-white border border-gray-300 rounded-r border-l-0 text-xs text-gray-600 hover:text-green-600 hover:border-green-300"
                  title="Send to Chat"
                >
                  <i className="fas fa-comment-dots"></i>
                </button>
              </div>
            ))}

            {isDrawMode && boxes.length === 0 && (
              <div
                className="absolute bottom-2 left-2 right-2 p-2 text-center text-xs text-gray-500 bg-blue-50 rounded pointer-events-none"
                data-testid="selection-instructions"
              >
                <i className="fas fa-info-circle mr-1"></i>
                Click and drag to select a region for visual search
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        {showResults && (
           <div
              className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center z-20"
              onMouseDown={() => setIsResizing(true)}
           >
              <div className="h-8 w-1 bg-gray-400 rounded-full"></div>
           </div>
        )}

        {/* Right Pane: Visual Search Results */}
        {showResults && (
           <div
              className={`${styles.resultsPanel} [--panel-width:${100 - splitPos}%]`}
              data-testid="visual-search-results-panel"
           >
              <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="text-sm font-semibold text-gray-700">Visual Search Results</h3>
                 <button onClick={() => setShowResults(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close results">
                    <i className="fas fa-times"></i>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                 {resultsLoading && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                       <p className="text-xs">Searching visual index...</p>
                    </div>
                 )}
                 
                 {resultsError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-100">
                       <i className="fas fa-exclamation-circle mr-2"></i>
                       {resultsError}
                    </div>
                 )}
                 
                 {!resultsLoading && !resultsError && results.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                       <i className="fas fa-search mb-2 text-2xl opacity-20"></i>
                       <p>No visually similar pages found.</p>
                       <p className="text-xs mt-1">Try selecting a distinct region.</p>
                    </div>
                 )}
                 
                 {results.map((result: VisualSearchResult, idx: number) => (
                    <div
                       key={idx}
                       className="group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer bg-white"
                       onClick={() => {
                          if (String(result.document_id) === String(docId)) {
                             setPage(Number(result.page));
                             const ev = new CustomEvent('overlay:document-changed', {
                                detail: { documentId: docId, page: Number(result.page), originalUrl, pageCount }
                             });
                             window.dispatchEvent(ev);
                          } else {
                             window.open(`/manual?open=${result.document_id}&page=${result.page}`, '_blank');
                          }
                       }}
                    >
                       <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden border-b border-gray-100">
                          {result.thumbnail ? (
                             <img src={`data:image/jpeg;base64,${result.thumbnail}`} alt="Result" className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <i className="fas fa-file-image text-3xl"></i>
                             </div>
                          )}
                          <div className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                             Score: {(result.score * 100).toFixed(1)}%
                          </div>
                       </div>
                       <div className="p-2">
                          <div className="font-medium text-xs text-gray-800 truncate" title={result.title || `Document ${result.document_id}`}>
                             {result.title || `Document ${result.document_id}`}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                             <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                Page {result.page}
                             </span>
                             {String(result.document_id) !== String(docId) && (
                                <i className="fas fa-external-link-alt text-[10px] text-gray-400"></i>
                             )}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}