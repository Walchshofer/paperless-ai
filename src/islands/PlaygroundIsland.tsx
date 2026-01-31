import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type {
  PlaygroundContract,
  SidecarStatus,
  SearchResult,
  QdrantPayload,
  FilterOptions,
  BoundingBox
} from '../ui/contracts/Playground.contract';
import { PlaygroundSchema, SearchResponseSchema } from '../ui/contracts/Playground.contract';

/**
 * PlaygroundIsland - Visual RAG Debugger
 *
 * Features:
 * - Image upload with Red Pen drawing
 * - Collection selector (visual_pages, visual_overlays)
 * - Sidecar status display (503/200, VRAM, model)
 * - Payload inspector for Qdrant metadata
 * - MaxSim search results display
 *
 * Architecture Reference: ticket:017.2 (Alpha-9 Protocol)
 */

interface PlaygroundProps extends Partial<PlaygroundContract> {
  onSearch?: (image: string, collection: string, filters?: FilterOptions) => void;
}

// API endpoints
const API_HEALTH = '/api/visual-rag/health';
const API_SEARCH = '/api/visual-rag/search/visual';

// Valid collections
const COLLECTIONS = [
  { value: 'visual_pages', label: 'visual_pages (320D, Dot)' },
  { value: 'visual_overlays', label: 'visual_overlays (320D, Cosine)' }
];

// Min selection size (pixels)
const MIN_BOX_SIZE = 20;

export default function PlaygroundIsland(props: PlaygroundProps) {
  const validated = PlaygroundSchema.parse(props);

  const {
    mode: _mode,
    collection: initialCollection,
    gpuState: initialGpuState,
    documentId: _documentId,
    filters: _initialFilters,
  } = validated;
  const { onSearch } = props; // callback not part of the Zod contract


  // State
  const [collection, setCollection] = useState(initialCollection);
  const [gpuState, setGpuState] = useState(initialGpuState);
  const [sidecarStatus, setSidecarStatus] = useState(validated.sidecarStatus ?? ({ state: 'unknown', model: 'ColQwen3-4B-AWQ' } as SidecarStatus));
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentBox, setCurrentBox] = useState(null as BoundingBox | null);
  const [boxes, setBoxes] = useState([] as BoundingBox[]);
  const [imageData, setImageData] = useState(null as string | null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState([] as SearchResult[]);
  const [payloads, setPayloads] = useState([] as QdrantPayload[]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [latency, setLatency] = useState(null as number | null);
  const [docIdFilter, setDocIdFilter] = useState('' as string);
  const [showRawJson, setShowRawJson] = useState(false);

  // Refs
  const containerRef = useRef(null as HTMLDivElement | null);
  const canvasRef = useRef(null as HTMLCanvasElement | null);
  const imageRef = useRef(null as HTMLImageElement | null);
  const fileInputRef = useRef(null as HTMLInputElement | null);
  const drawToggleRef = useRef(null as HTMLButtonElement | null);

  // Keep aria-pressed in sync for assistive tech (set as string on the DOM element)
  useEffect(() => {
    if (drawToggleRef.current) drawToggleRef.current.setAttribute('aria-pressed', String(isDrawMode));
  }, [isDrawMode]);

  // Poll sidecar health
  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch(API_HEALTH);
        if (res.status === 503) {
          setSidecarStatus({
            state: 'initializing',
            model: 'ColQwen3-4B-AWQ',
            error: 'GPU Preparing...'
          });
          setGpuState('preparing');
        } else if (res.ok) {
          const data = await res.json();
          setSidecarStatus({
            state: 'ready',
            model: data.model || 'ColQwen3-4B-AWQ',
            vram: data.vram,
            lastCheck: Date.now()
          });
          setGpuState('ready');
        } else {
          setSidecarStatus({
            state: 'error',
            error: `HTTP ${res.status}`
          });
          setGpuState('error');
        }
      } catch {
        setSidecarStatus({
          state: 'error',
          error: 'Connection failed'
        });
        setGpuState('error');
      }
    };

    pollHealth();
    const interval = setInterval(pollHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Get relative mouse position
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

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawMode || !imageLoaded) return;
      e.preventDefault();
      const pos = getRelativePosition(e);
      setIsDrawing(true);
      setCurrentBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setError(null);
    },
    [isDrawMode, imageLoaded, getRelativePosition]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawing || !currentBox) return;
      e.preventDefault();
      const pos = getRelativePosition(e);
      setCurrentBox((prev: BoundingBox | null) => {
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

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);

    const container = containerRef.current;
    if (!container) return;

    // Normalize box
    const normalizedBox: BoundingBox = {
      x: currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
      y: currentBox.height < 0 ? currentBox.y + currentBox.height : currentBox.y,
      width: Math.abs(currentBox.width),
      height: Math.abs(currentBox.height)
    };

    if (normalizedBox.width < MIN_BOX_SIZE || normalizedBox.height < MIN_BOX_SIZE) {
      setError('Selection too small. Draw a larger box.');
      setCurrentBox(null);
      return;
    }

    setBoxes((prev: BoundingBox[]) => [...prev, normalizedBox]);
    setCurrentBox(null);
  }, [isDrawing, currentBox]);

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setImageData(result);
        setImageLoaded(false);
        setBoxes([]);
        setSearchResults([]);
        setPayloads([]);
        setLatency(null);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

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
        currentBox.x, currentBox.y,
        currentBox.width, currentBox.height
      );
      ctx.fillRect(
        currentBox.x, currentBox.y,
        currentBox.width, currentBox.height
      );
    }
  }, [boxes, currentBox, isDrawing]);

  // Trigger search
  const triggerSearch = useCallback(async () => {
    if (!imageData || boxes.length === 0) {
      setError('Upload an image and draw a region first');
      return;
    }

    if (sidecarStatus.state !== 'ready') {
      setError('Sidecar not ready. Wait for GPU.');
      return;
    }

    setIsSearching(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Get the last box and capture region
      const box = boxes[boxes.length - 1];
      const container = containerRef.current;
      const img = imageRef.current;

      if (!container || !img) throw new Error('No container/image');

      // Create canvas to capture region
      const captureCanvas = document.createElement('canvas');
      const ctx = captureCanvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      // Scale coordinates
      const scaleX = img.naturalWidth / container.clientWidth;
      const scaleY = img.naturalHeight / container.clientHeight;

      const srcX = box.x * scaleX;
      const srcY = box.y * scaleY;
      const srcW = box.width * scaleX;
      const srcH = box.height * scaleY;

      captureCanvas.width = srcW;
      captureCanvas.height = srcH;

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      // Get base64 (strip data URL prefix)
      const dataUrl = captureCanvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      // Build filters
      const filters: FilterOptions = {};
      if (docIdFilter && !isNaN(parseInt(docIdFilter))) {
        filters.doc_id = parseInt(docIdFilter);
      }

      // Call API
      const res = await fetch(API_SEARCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          collection,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          limit: 10
        })
      });

      if (res.status === 503) {
        setGpuState('preparing');
        throw new Error('GPU still preparing. Try again.');
      }

      if (!res.ok) {
        throw new Error(`Search failed: HTTP ${res.status}`);
      }

      const raw = await res.json();
      const parsed = SearchResponseSchema.safeParse(raw);
      if (!parsed.success) throw new Error('Invalid search response');
      const data = parsed.data;
      const elapsed = Date.now() - startTime;

      setSearchResults(data.results || []);
      setLatency(elapsed);

      // Extract payloads from results
      const extractedPayloads = (data.results || []).map((r: SearchResult) => {
        const meta = r.metadata as { correspondent_id?: number; tag_ids?: number[]; created_date?: string } | undefined;
        return {
          doc_id: r.docId,
          correspondent_id: meta?.correspondent_id,
          tag_ids: meta?.tag_ids,
          created_date: meta?.created_date,
          page_num: r.pageNum
        } as QdrantPayload;
      });
      setPayloads(extractedPayloads);

      // Dispatch event
      window.dispatchEvent(new CustomEvent('playground:results-received', {
        detail: { results: data.results, executionTimeMs: elapsed }
      }));

      if (onSearch) {
        onSearch(base64, collection, filters);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [imageData, boxes, collection, docIdFilter, sidecarStatus.state, onSearch]);

  // Clear all
  const clearAll = useCallback(() => {
    setBoxes([]);
    setSearchResults([]);
    setPayloads([]);
    setLatency(null);
    setError(null);
  }, []);

  // Copy payloads to clipboard
  const copyPayloads = useCallback(() => {
    const json = JSON.stringify(payloads, null, 2);
    navigator.clipboard.writeText(json);
  }, [payloads]);

  // Render sidecar status badge
  const renderStatusBadge = () => {
    const stateColors: Record<string, string> = {
      ready: 'bg-green-500',
      initializing: 'bg-yellow-500',
      error: 'bg-red-500',
      unknown: 'bg-gray-500'
    };

    const stateLabels: Record<string, string> = {
      ready: '200 OK',
      initializing: '503 Initializing',
      error: 'Error',
      unknown: 'Unknown'
    };

    return (
      <div
        data-testid="sidecar-status"
        className={`flex items-center gap-2 p-2 rounded border-l-4 ${
          sidecarStatus.state === 'ready' ? 'bg-green-50 border-green-500' :
          sidecarStatus.state === 'initializing' ? 'bg-yellow-50 border-yellow-500' :
          'bg-red-50 border-red-500'
        }`}
      >
        <span
          className={`px-2 py-1 text-xs font-bold text-white rounded ${
            stateColors[sidecarStatus.state]
          }`}
        >
          {stateLabels[sidecarStatus.state]}
        </span>
        {sidecarStatus.vram && (
          <span className="text-sm text-gray-600">
            VRAM: {sidecarStatus.vram.used_mb}MB / {sidecarStatus.vram.total_mb}MB
          </span>
        )}
        <span className="text-sm text-gray-500">
          Model: {sidecarStatus.model}
        </span>
      </div>
    );
  };

  return (
    <div
      data-testid="playground-island-root"
      className="h-full flex flex-col bg-white rounded-lg shadow"
    >
      {/* Header */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Visual RAG Playground</h1>
        <p className="text-sm text-gray-500">
          Debug and test Qdrant payloads, sidecar state, and visual search
        </p>
      </div>

      {/* Sidecar Status */}
      <div className="p-4 border-b">
        {renderStatusBadge()}
      </div>

      {/* GPU Preparing Modal */}
      {gpuState === 'preparing' && (
        <div
          data-testid="gpu-preparing-modal"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-bold">GPU Preparing</h2>
            <p className="text-gray-600">
              ColQwen3-4B-AWQ model is loading on RTX 3090 Ti...
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Expected VRAM: ~3.5GB
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-end">
        {/* Collection Selector */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="collection-select" className="block text-sm font-medium mb-1">Collection</label>
          <select
            id="collection-select"
            data-testid="collection-select"
            value={collection}
            onChange={(e: Event) => setCollection((e.target as HTMLSelectElement).value)}
            className="w-full p-2 border rounded"
          >
            {COLLECTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Document ID Filter */}
        <div className="flex-1 min-w-[150px]">
          <label htmlFor="doc-id-filter" className="block text-sm font-medium mb-1">
            Filter by Doc ID (optional)
          </label>
          <input
            id="doc-id-filter"
            title="Filter by document ID"
            data-testid="doc-id-filter"
            type="text"
            value={docIdFilter}
            onChange={(e: Event) => setDocIdFilter((e.target as HTMLInputElement).value)}
            placeholder="e.g., 12345"
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Search Button */}
        <div>
          <button
            data-testid="search-button"
            onClick={triggerSearch}
            disabled={isSearching || !imageLoaded || boxes.length === 0}
            className={`px-4 py-2 font-medium rounded ${
              isSearching || !imageLoaded || boxes.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSearching ? 'Searching...' : 'Search Collection'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left: Image Canvas */}
        <div className="flex flex-col border rounded overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-2 bg-gray-100 border-b">
            <button
              data-testid="upload-button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
            >
              <i className="fas fa-upload mr-1"></i>Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload image file"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              data-testid="draw-toggle"
              ref={(el: HTMLButtonElement | null) => { drawToggleRef.current = el; }}
              onClick={() => setIsDrawMode(!isDrawMode)}
              className={`px-3 py-1 text-sm rounded ${
                isDrawMode
                  ? 'bg-red-600 text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
            >
              <i className={`fas fa-pen mr-1 ${isDrawMode ? 'animate-pulse' : ''}`}></i>
              {isDrawMode ? 'Drawing' : 'Draw'}
            </button>

            {boxes.length > 0 && (
              <button
                data-testid="clear-boxes"
                onClick={clearAll}
                className="px-3 py-1 text-sm text-gray-600 hover:text-red-600"
              >
                <i className="fas fa-trash-alt mr-1"></i>Clear
              </button>
            )}
          </div>

          {/* Canvas Area */}
          <div
            ref={containerRef}
            className={`relative flex-1 bg-gray-200 overflow-hidden ${isDrawMode ? 'cursor-crosshair touch-none' : 'cursor-default'}`}
            onMouseDown={handleMouseDown as (e: MouseEvent) => void}
            onMouseMove={handleMouseMove as (e: MouseEvent) => void}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => isDrawing && handleMouseUp()}
            onTouchStart={handleMouseDown as unknown as (e: TouchEvent) => void}
            onTouchMove={handleMouseMove as unknown as (e: TouchEvent) => void}
            onTouchEnd={handleMouseUp}
          >
            {imageData ? (
              <img
                ref={imageRef}
                src={imageData}
                alt="Uploaded"
                onLoad={handleImageLoad}
                className="w-full h-full object-contain"
                data-testid="uploaded-image"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <i className="fas fa-image text-4xl mb-2"></i>
                  <p>Upload an image to begin</p>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              data-testid="annotation-canvas"
            />
          </div>

          {/* Instructions */}
          {isDrawMode && imageLoaded && boxes.length === 0 && (
            <div className="p-2 text-center text-xs text-gray-500 bg-blue-50">
              <i className="fas fa-info-circle mr-1"></i>
              Click and drag to select a region
            </div>
          )}
        </div>

        {/* Right: Results & Inspector */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Error */}
          {error && (
            <div
              data-testid="error-message"
              className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700"
            >
              <i className="fas fa-exclamation-circle mr-1"></i>
              {error}
            </div>
          )}

          {/* Latency */}
          {latency !== null && (
            <div className="text-sm text-gray-500">
              Latency: {latency}ms
            </div>
          )}

          {/* Search Results */}
          <div className="flex-1 border rounded overflow-hidden flex flex-col">
            <div className="p-2 bg-gray-100 border-b font-medium text-sm">
              Search Results ({searchResults.length})
            </div>
            <div className="flex-1 overflow-auto p-2" data-testid="search-results">
              {searchResults.length === 0 ? (
                <p className="text-gray-500 text-sm">No results yet</p>
              ) : (
                searchResults.map((r: SearchResult, i: number) => (
                  <div
                    key={i}
                    className="p-2 border rounded mb-2"
                    data-testid={`result-${i}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium">Doc #{r.docId}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {r.score.toFixed(3)}
                      </span>
                    </div>
                    {r.pageNum && (
                      <div className="text-xs text-gray-500">Page {r.pageNum}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payload Inspector */}
          <div className="flex-1 border rounded overflow-hidden flex flex-col">
            <div className="p-2 bg-gray-100 border-b font-medium text-sm flex justify-between items-center">
              <span>Payload Inspector</span>
              <div className="flex gap-2">
                <button
                  data-testid="toggle-json"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {showRawJson ? 'Formatted' : 'Raw JSON'}
                </button>
                <button
                  data-testid="copy-payloads"
                  onClick={copyPayloads}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2" data-testid="payload-inspector">
              {payloads.length === 0 ? (
                <p className="text-gray-500 text-sm">No payloads to display</p>
              ) : showRawJson ? (
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                  {JSON.stringify(payloads, null, 2)}
                </pre>
              ) : (
                payloads.map((p: QdrantPayload, i: number) => (
                  <div
                    key={i}
                    className="p-2 bg-gray-50 rounded mb-2 font-mono text-xs"
                    data-testid={`payload-${i}`}
                  >
                    <div>
                      <span className="text-red-600">doc_id:</span>{' '}
                      <span className="text-blue-600">{p.doc_id}</span>
                    </div>
                    {p.correspondent_id !== undefined && (
                      <div>
                        <span className="text-red-600">correspondent_id:</span>{' '}
                        <span className="text-blue-600">{p.correspondent_id}</span>
                      </div>
                    )}
                    {p.tag_ids && (
                      <div>
                        <span className="text-red-600">tag_ids:</span>{' '}
                        <span className="text-blue-600">[{p.tag_ids.join(', ')}]</span>
                      </div>
                    )}
                    {p.created_date && (
                      <div>
                        <span className="text-red-600">created_date:</span>{' '}
                        <span className="text-blue-600">"{p.created_date}"</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
