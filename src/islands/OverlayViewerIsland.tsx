import { h, RefObject } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
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
}

// Minimum selection size (in pixels) to trigger search
const MIN_SELECTION_SIZE = 20;
// Minimum selection size (as fraction of container) to be valid
const MIN_SIZE_FRACTION = 0.01;

export default function OverlayViewerIsland(props: OverlayViewerProps) {
  const { documentId, page = 1, onRegionSelected } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Image URL for the document page
  const imageUrl = documentId
    ? `/api/documents/${documentId}/thumb/?page=${page}`
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
      }
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageError('Failed to load document image');
    };
    img.src = imageUrl;
  }, [imageUrl]);

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
      if (!isDrawMode) return;

      e.preventDefault();
      const pos = getRelativePosition(e);

      setIsDrawing(true);
      setCurrentBox({
        id: `box-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0
      });
      setWarning(null);
    },
    [isDrawMode, getRelativePosition]
  );

  // Update box size while drawing
  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawing || !currentBox) return;

      e.preventDefault();
      const pos = getRelativePosition(e);

      setCurrentBox((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          width: pos.x - prev.x,
          height: pos.y - prev.y
        };
      });
    },
    [isDrawing, currentBox, getRelativePosition]
  );

  // Finish drawing and validate box
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentBox) return;

    setIsDrawing(false);

    const container = containerRef.current;
    if (!container) return;

    // Normalize box (handle negative dimensions)
    const normalizedBox: BoundingBox = {
      ...currentBox,
      x: currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
      y:
        currentBox.height < 0 ? currentBox.y + currentBox.height : currentBox.y,
      width: Math.abs(currentBox.width),
      height: Math.abs(currentBox.height)
    };

    // Check minimum size
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (
      normalizedBox.width < MIN_SELECTION_SIZE ||
      normalizedBox.height < MIN_SELECTION_SIZE
    ) {
      setWarning('Selection too small. Please draw a larger box.');
      setCurrentBox(null);
      return;
    }

    const widthFraction = normalizedBox.width / containerWidth;
    const heightFraction = normalizedBox.height / containerHeight;

    if (widthFraction < MIN_SIZE_FRACTION || heightFraction < MIN_SIZE_FRACTION) {
      setWarning('Selection too small to yield meaningful results.');
      setCurrentBox(null);
      return;
    }

    // Add to boxes list
    setBoxes((prev) => [...prev, normalizedBox]);
    setCurrentBox(null);

    // Capture region and dispatch event
    captureAndDispatch(normalizedBox);
  }, [isDrawing, currentBox]);

  // Capture the selected region as base64 and dispatch event
  const captureAndDispatch = useCallback(
    async (box: BoundingBox) => {
      const container = containerRef.current;
      const img = imageRef.current;

      if (!container || !img || !imageLoaded) return;

      try {
        // Create a canvas to capture the region
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate scale between displayed image and actual image
        const scaleX = img.naturalWidth / container.clientWidth;
        const scaleY = img.naturalHeight / container.clientHeight;

        // Source rectangle (in original image coordinates)
        const srcX = box.x * scaleX;
        const srcY = box.y * scaleY;
        const srcWidth = box.width * scaleX;
        const srcHeight = box.height * scaleY;

        canvas.width = srcWidth;
        canvas.height = srcHeight;

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

        // Get base64 PNG
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        // Dispatch event for cross-island communication
        const event = new CustomEvent('visual-search-requested', {
          detail: {
            imageBase64: base64,
            collection: 'visual_pages',
            documentId,
            page,
            bbox: {
              x: box.x / container.clientWidth,
              y: box.y / container.clientHeight,
              width: box.width / container.clientWidth,
              height: box.height / container.clientHeight
            }
          }
        });
        window.dispatchEvent(event);

        // Call callback if provided
        if (onRegionSelected) {
          onRegionSelected(base64, box);
        }
      } catch (err) {
        console.error('Failed to capture region:', err);
        setWarning('Failed to capture selection. Please try again.');
      }
    },
    [documentId, page, imageLoaded, onRegionSelected]
  );

  // Remove a specific box
  const removeBox = useCallback((boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
  }, []);

  // Clear all boxes
  const clearAllBoxes = useCallback(() => {
    setBoxes([]);
    setWarning(null);
  }, []);

  // Toggle draw mode
  const toggleDrawMode = useCallback(() => {
    setIsDrawMode((prev) => !prev);
    if (isDrawMode) {
      setIsDrawing(false);
      setCurrentBox(null);
    }
  }, [isDrawMode]);

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

    boxes.forEach((box) => {
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
    <div data-testid="overlay-viewer-root" className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200">
        <button
          data-testid="red-pen-toggle"
          onClick={toggleDrawMode}
          aria-pressed={isDrawMode}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            isDrawMode
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <i className={`fas fa-pen mr-1.5 ${isDrawMode ? 'animate-pulse' : ''}`}></i>
          {isDrawMode ? 'Drawing Mode' : 'Draw Mode'}
        </button>

        {boxes.length > 0 && (
          <button
            data-testid="clear-boxes"
            onClick={clearAllBoxes}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600"
          >
            <i className="fas fa-trash-alt mr-1"></i>
            Clear ({boxes.length})
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          Page {page}
        </span>
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
        className="relative flex-1 overflow-hidden bg-gray-100"
        style={{
          cursor: isDrawMode ? 'crosshair' : 'default',
          touchAction: isDrawMode ? 'none' : 'auto'
        }}
        onMouseDown={handleMouseDown as any}
        onMouseMove={handleMouseMove as any}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) handleMouseUp();
        }}
        onTouchStart={handleMouseDown as any}
        onTouchMove={handleMouseMove as any}
        onTouchEnd={handleMouseUp}
      >
        {/* Document Image */}
        {imageUrl && !imageError ? (
          <img
            ref={imageRef}
            alt={`Document ${documentId} page ${page}`}
            className="w-full h-full object-contain"
            data-testid="document-image"
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

        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          data-testid="annotation-canvas"
        />

        {/* Box Labels */}
        {boxes.map((box, idx) => (
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
      </div>

      {/* Instructions */}
      {isDrawMode && boxes.length === 0 && (
        <div className="p-2 text-center text-xs text-gray-500 bg-blue-50">
          <i className="fas fa-info-circle mr-1"></i>
          Click and drag to select a region for visual search
        </div>
      )}
    </div>
  );
}
