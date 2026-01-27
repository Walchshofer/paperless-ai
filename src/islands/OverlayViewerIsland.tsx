import { h, RefObject } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import type { OverlayViewerContract } from '../ui/contracts/OverlayViewer.contract';

/**
 * OverlayViewerIsland - Document viewer with Red Pen selection
 *
 * Features:
 * - Document page preview
 * - Red Pen drawing mode for region selection
 * - Multi-box support with resize/remove
 * - Dispatches visual-search-requested events
 *
 * Architecture Reference: ticket:009.1 (Red Pen Canvas Logic)
 */

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayViewerProps extends Partial<OverlayViewerContract> {
  onRegionSelected?: (imageBase64: string, bbox: BoundingBox) => void;
  overlayMode?: 'none' | 'document';
  showLegend?: boolean;
  allowSelection?: boolean;
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
  } = props;

  const containerRef = useRef(null as HTMLDivElement | null);
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  const imageRef = useRef(null as HTMLImageElement | null);

  // Allow dynamic updates from page-level events
  const [docId, setDocId] = useState(initialDocumentId || null as number | null);
  const [page, setPage] = useState(initialPage);
  const [originalUrl, setOriginalUrl] = useState(initialOriginalUrl || null as string | null);
  const [pageCount, setPageCount] = useState((props && (props as any).pageCount) || null as number | null);

  // Listen for page/document change events from the page and update in-place
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent)?.detail || {};
      if (d.documentId !== undefined && d.documentId !== null) setDocId(d.documentId);
      if (d.page !== undefined && d.page !== null) setPage(Number(d.page));
      // Accept either camelCase `originalUrl` or snake_case `original_url` from different emitters
      if (Object.prototype.hasOwnProperty.call(d, 'originalUrl')) setOriginalUrl(d.originalUrl || null);
      else if (Object.prototype.hasOwnProperty.call(d, 'original_url')) setOriginalUrl(d.original_url || null);
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

  const normalizeOverlayBox = useCallback((box: any) => {
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
  const [legend, setLegend] = useState([] as Array<{ key: string; label: string; color: string; isMandatory?: boolean }>);
  const [overlayItems, setOverlayItems] = useState([] as Array<any>);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [overlayDomain, setOverlayDomain] = useState('general');
  const selectionEnabled = allowSelection !== false;

  // Image URL for the document page — prefer `originalUrl` if provided (paperless direct link), otherwise use internal download route
  const imageUrl = docId
    ? (originalUrl
        ? `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}page=${page}`
        : `/documents/${docId}/download/original/?page=${page}`)
    : null;

  // Load the document image
  useEffect(() => {
    if (!imageUrl) return;

    setImageLoaded(false);
    setImageError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (imageRef.current) {
        imageRef.current.src = img.src;
        // Progressive loading guard for very large images
        try {
          const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
          if (area > 20000000) {
            setWarning('Large document image detected. Rendering may be slow.');
          }
        } catch (e) { /* ignore */ }
      }
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageError('Failed to load document image');
    };
    img.src = imageUrl;
  }, [imageUrl]);

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
        const response = await fetch(
          `/api/visual-rag/overlays/${docId}?page=${page}`
        );
        if (!response.ok) throw new Error('Failed to load overlays');
        const data = await response.json();
        const overlays = Array.isArray(data.overlays) ? data.overlays : [];
        if (!cancelled) {
          setOverlayItems(overlays);
          const domain = overlays[0]?.domain || 'general';
          setOverlayDomain(String(domain).toLowerCase());
        }
      } catch (err: any) {
        if (!cancelled) {
          setOverlayError(err.message || 'Overlay load failed');
          setOverlayItems([]);
        }
      } finally {
        if (!cancelled) setOverlayLoading(false);
      }
    };

    void loadOverlays();
    return () => {
      cancelled = true;
    };
  }, [overlayMode, docId, page]);

  useEffect(() => {
    let cancelled = false;

    const loadLegend = async () => {
      if (!showLegend) return;
      try {
        const resp = await fetch(`/api/visual-rag/legend/${overlayDomain}`);
        if (!resp.ok) throw new Error('Legend not available');
        const data = await resp.json();
        if (!cancelled) setLegend(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setLegend([]);
      }
    };

    void loadLegend();
    return () => { cancelled = true; };
  }, [overlayDomain, showLegend]);

  // Get mouse/touch position relative to container
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
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    },
    []
  );

  // Start drawing a new box
  const handleMouseDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!selectionEnabled || !drawModeRef.current) return;

      e.preventDefault();
      const pos = getRelativePosition(e);

      const nextBox = {
        id: `box-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0
      };

      isDrawingRef.current = true;
      currentBoxRef.current = nextBox;
      setIsDrawing(true);
      setCurrentBox(nextBox);
      setWarning(null);
    },
    [getRelativePosition]
  );

  // Update box size while drawing
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

  // Capture the selected region as base64 and dispatch event
  const captureAndDispatch = useCallback(
    async (box: BoundingBox) => {
      const container = containerRef.current;
      const img = imageRef.current;

      if (!container || !img) return;
      if (!imageLoaded && !imageError) return;

      try {
        // Create a canvas to capture the region
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate scale between displayed image and actual image
        const naturalWidth = img.naturalWidth || container.clientWidth;
        const naturalHeight = img.naturalHeight || container.clientHeight;
        const scaleX = naturalWidth / container.clientWidth;
        const scaleY = naturalHeight / container.clientHeight;

        // Source rectangle (in original image coordinates)
        const srcX = box.x * scaleX;
        const srcY = box.y * scaleY;
        const srcWidth = box.width * scaleX;
        const srcHeight = box.height * scaleY;

        canvas.width = srcWidth;
        canvas.height = srcHeight;

        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          ctx.drawImage(
            img,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            0,
            0,
            srcWidth,
            srcHeight
          );
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Get base64 PNG
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        // Dispatch event for cross-island communication
        const event = new CustomEvent('visual-search-requested', {
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
            }
          }
        });
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(event);
        }

        // Call callback if provided
        if (onRegionSelected) {
          onRegionSelected(base64, box);
        }
      } catch (err) {
        console.error('Failed to capture region:', err);
        setWarning('Failed to capture selection. Please try again.');
      }
    },
    [docId, page, imageLoaded, imageError, onRegionSelected]
  );

  // Finish drawing and validate box
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

    // Normalize box (handle negative dimensions)
    const normalizedBox: BoundingBox = {
      ...activeBox,
      x: activeBox.width < 0 ? activeBox.x + activeBox.width : activeBox.x,
      y:
        activeBox.height < 0
          ? activeBox.y + activeBox.height
          : activeBox.y,
      width: Math.abs(activeBox.width),
      height: Math.abs(activeBox.height)
    };

    // Check minimum size
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (
      normalizedBox.width < MIN_SELECTION_SIZE ||
      normalizedBox.height < MIN_SELECTION_SIZE
    ) {
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

    // Add to boxes list
    setBoxes((prev: BoundingBox[]) => [...prev, normalizedBox]);
    currentBoxRef.current = null;
    setCurrentBox(null);

    // Capture region and dispatch event
    captureAndDispatch(normalizedBox);
  }, [captureAndDispatch, getRelativePosition]);

  // Remove a specific box
  const removeBox = useCallback((boxId: string) => {
    setBoxes((prev: BoundingBox[]) => prev.filter((b: BoundingBox) => b.id !== boxId));
  }, []);

  // Clear all boxes
  const clearAllBoxes = useCallback(() => {
    setBoxes([]);
    setWarning(null);
  }, []);

  // Toggle draw mode
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

  // Programmatic page navigation helper — updates local state and emits an overlay:document-changed event
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
      if (isDrawingRef.current) {
        handleMouseUp(event as MouseEvent);
      }
    };

    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [handleMouseUp]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!selectionEnabled || !drawModeRef.current) return;
      pointerActiveRef.current = true;
      if (containerRef.current?.setPointerCapture) {
        containerRef.current.setPointerCapture(e.pointerId);
      }
      handleMouseDown(e as any);
    },
    [handleMouseDown]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      handleMouseMove(e as any);
    },
    [handleMouseMove]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      handleMouseUp(e as any);
      pointerActiveRef.current = false;
      if (containerRef.current?.releasePointerCapture) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    },
    [handleMouseUp]
  );

  const handlePointerCancel = useCallback((e: PointerEvent) => {
    pointerActiveRef.current = false;
    if (containerRef.current?.releasePointerCapture) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleMouseDownFallback = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (pointerActiveRef.current) return;
      handleMouseDown(e);
    },
    [handleMouseDown]
  );

  const handleMouseMoveFallback = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (pointerActiveRef.current) return;
      handleMouseMove(e);
    },
    [handleMouseMove]
  );

  const handleMouseUpFallback = useCallback((e?: MouseEvent | TouchEvent) => {
    if (pointerActiveRef.current) return;
    handleMouseUp(e);
  }, [handleMouseUp]);

  const visibleOverlays = useMemo(() => {
    if (!overlayItems || overlayItems.length === 0) return [];
    if (!mandatoryOnly) return overlayItems;
    return overlayItems.filter((o: any) => o.isMandatory);
  }, [overlayItems, mandatoryOnly]);

  // Draw boxes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    ctx.strokeStyle = 'rgba(220, 20, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(220, 20, 60, 0.1)';

    boxes.forEach((box: BoundingBox) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    });

    // Draw current box
    if (currentBox && isDrawing) {
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)';
      ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
      ctx.strokeRect(
        currentBox.x,
        currentBox.y,
        currentBox.width,
        currentBox.height
      );
      ctx.fillRect(
        currentBox.x,
        currentBox.y,
        currentBox.width,
        currentBox.height
      );
    }

  }, [boxes, currentBox, isDrawing]);

  return (
    <div
      data-testid="overlay-viewer-root"
      data-hydrated="true"
      data-has-boxes={boxes.length}
      data-has-warning={warning ? 'true' : 'false'}
      data-original-url={originalUrl || ''}
      className="h-full flex flex-col"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200">
        {selectionEnabled && (
          <button
            data-testid="red-pen-toggle"
            onClick={toggleDrawMode}
            aria-pressed={isDrawMode ? 'true' : 'false'}
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
                  onChange={(e: any) => setMandatoryOnly(e.target.checked)}
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
                <span style={{ width: 12, height: 12, background: item.color, display: 'inline-block', borderRadius: 2 }} aria-hidden="true"></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            data-testid="overlay-prev-page"
            onClick={() => changePage(-1)}
            aria-label="Previous page"
            disabled={page <= 1}
            className="px-2 py-1 bg-bg-secondary text-text-primary rounded border border-border-color hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <span data-testid="overlay-page-indicator" className="text-xs text-gray-400">
            Page {page}{pageCount ? ` of ${pageCount}` : ''}
          </span>

          <button
            data-testid="overlay-next-page"
            onClick={() => changePage(1)}
            aria-label="Next page"
            disabled={pageCount ? page >= pageCount : false}
            className="px-2 py-1 bg-bg-secondary text-text-primary rounded border border-border-color hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Warning Message */}
      {warning && (
        <div
          className="mx-2 my-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700"
          data-testid="selection-warning"
        >
          <i className="fas fa-exclamation-triangle mr-1"></i>
          {warning}
        </div>
      )}

      {/* Document Viewer with Canvas Overlay */}
      <div
        ref={containerRef}
        data-testid="overlay-container"
        className="relative flex-1 overflow-hidden bg-gray-100"
        style={{
          cursor: isDrawMode ? 'crosshair' : 'default',
          touchAction: isDrawMode ? 'none' : 'auto'
        }}
        onPointerDown={handlePointerDown as any}
        onPointerMove={handlePointerMove as any}
        onPointerUp={handlePointerUp as any}
        onPointerCancel={handlePointerCancel as any}
        onPointerLeave={() => {
          if (isDrawingRef.current) handleMouseUp();
        }}
        onMouseDown={handleMouseDownFallback as any}
        onMouseMove={handleMouseMoveFallback as any}
        onMouseUp={handleMouseUpFallback as any}
        onMouseLeave={() => {
          if (pointerActiveRef.current) return;
          if (isDrawingRef.current) handleMouseUp();
        }}
        onTouchStart={handleMouseDownFallback as any}
        onTouchMove={handleMouseMoveFallback as any}
        onTouchEnd={handleMouseUpFallback as any}
      >
        {/* Document Image */}
        {imageUrl && !imageError ? (
          <img
            ref={imageRef}
            alt={`Document ${docId} page ${page}`}
            className="w-full h-full object-contain pointer-events-none select-none"
            data-testid="document-image"
            draggable={false}
            crossOrigin="anonymous"
            onDragStart={(e: any) => e.preventDefault()}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : null}

        {/* Loading State */}
        {imageUrl && !imageLoaded && !imageError && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            data-testid="overlay-loading"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {imageError && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            data-testid="image-error"
          >
            <div className="text-center text-gray-500">
              <i className="fas fa-exclamation-circle text-3xl mb-2"></i>
              <p className="text-sm">{imageError}</p>
            </div>
          </div>
        )}

        {/* No Document State */}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-500">No document selected</p>
          </div>
        )}

        {/* Overlay Boxes */}
        {overlayMode === 'document' && visibleOverlays.map((overlay: any, idx: number) => {
          const box = normalizeOverlayBox(overlay.boundingBox);
          if (!box) return null;
          const color = overlay.color || '#2563eb';
          return (
            <div
              key={overlay.id || `${overlay.label}-${idx}`}
              data-testid="overlay-box"
              className="absolute border-2 rounded-sm pointer-events-none"
              style={{
                left: `${box.left}%`,
                top: `${box.top}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                borderColor: color,
                backgroundColor: `${color}22`,
              }}
            >
              <span
                className="absolute -top-5 left-0 text-[10px] px-1 py-0.5 rounded"
                style={{ backgroundColor: color, color: '#fff' }}
              >
                {overlay.label || 'Overlay'}
              </span>
            </div>
          );
        })}

        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          data-testid="annotation-canvas"
        />

        {/* Box Labels */}
        {boxes.map((box: BoundingBox, idx: number) => (
          <div
            key={box.id}
            className="absolute flex items-center gap-1"
            style={{
              left: box.x,
              top: box.y - 24,
              zIndex: 10
            }}
          >
            <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">
              Region {idx + 1}
            </span>
            <button
              onClick={() => removeBox(box.id)}
              className="w-5 h-5 bg-white border border-gray-300 rounded text-xs text-gray-600 hover:text-red-600 hover:border-red-300"
              title="Remove this selection"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}

        {/* Instructions */}
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
  );
}
