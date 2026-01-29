import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import type { Images, OverlaysByImage } from '../ui/contracts/VisualOverlays.contract';

/**
 * VisualOverlaysIsland
 * - Fetches overlays for images (with cache + abortable requests)
 * - Renders overlays as an SVG layer for accurate scaling
 * - Exports helpers for coordinate transforms (testable)
 */

interface Props {
  documentId?: number | null;
  images?: Images;
  overlaysByImage?: OverlaysByImage;
}

// Simple in-memory cache with TTL (ms)
const overlayCache: Map<string, { ts: number; data: any }> = new Map();
export const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Debounce helper
export function debounce(fn: (...args: any[]) => void, wait = 200) {
  let t: any = null;
  return (...args: any[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function normalizeBoxToPixels(bbox: { x: number; y: number; width: number; height: number }, containerWidth: number, containerHeight: number) {
  // bbox normalized in [0..1]
  return {
    left: Math.round(bbox.x * containerWidth),
    top: Math.round(bbox.y * containerHeight),
    width: Math.round(bbox.width * containerWidth),
    height: Math.round(bbox.height * containerHeight),
  };
}

// Helper to extract visible image ids from IntersectionObserverEntry list (testable)
export function getVisibleImageIds(entries: Array<any>): string[] {
  const ids: string[] = [];
  entries.forEach((e) => {
    const target = e.target as HTMLElement;
    const id = target?.dataset?.imageId || target?.getAttribute?.('data-image-id') || null;
    if (!id) return;
    if (e.isIntersecting || e.intersectionRatio > 0) ids.push(id);
  });
  return ids;
}

export async function fetchOverlaysForImage(image: any, fetchImpl: any = (globalThis as any).fetch, options: { timeoutMs?: number } = {}) {
  if (!image) return [];
  const cacheKey = image.id || image.originalSrc || image.thumbnailSrc || JSON.stringify(image);
  const now = Date.now();
  const cached = overlayCache.get(cacheKey);
  if (cached && (now - cached.ts) < CACHE_TTL) return cached.data;

  // Determine endpoint
  let url = '';
  let opts: any = { method: 'GET' };
  if (image.id) {
    url = `/api/visual-rag/overlays?imageId=${encodeURIComponent(image.id)}`;
  } else if (image.originalSrc) {
    url = `/api/visual-rag/overlays/search`;
    opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: image.originalSrc }) };
  } else {
    return [];
  }

  if (typeof fetchImpl !== 'function') throw Object.assign(new Error('fetch not available'), { code: 'no_fetch' });

  const controller = new AbortController();
  opts.signal = controller.signal;

  // timeout handling
  let timeoutHandle: any = null;
  const timeoutMs = options.timeoutMs || 10000; // default 10s
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('Fetch timeout'), { code: 'timeout' }));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([fetchImpl(url, opts), timeoutPromise]);
    if (!res || !res.ok) {
      const err: any = new Error('Overlay service error');
      err.code = res && res.status === 503 ? 'service_unavailable' : 'fetch_error';
      throw err;
    }
    const json = await res.json();
    const overlays = Array.isArray(json.overlays) ? json.overlays : json;
    overlayCache.set(cacheKey, { ts: now, data: overlays });
    return overlays;
  } catch (err: any) {
    // Do not cache failures; attach code if missing
    if (!err.code) err.code = err.name === 'AbortError' ? 'timeout' : 'fetch_error';
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export default function VisualOverlaysIsland(props: Props) {
  const { images = [], overlaysByImage = {} } = props;
  const [mounted, setMounted] = useState(false);
  const [localOverlays, setLocalOverlays] = useState<Record<string, any[]>>(overlaysByImage || {});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const imageRefs = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<any | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Intersection observer based viewport batching
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const intersectCb = debounce((entries: any[]) => {
      const visibleIds = getVisibleImageIds(entries);
      // fetch overlays only for visible ids
      visibleIds.forEach((id) => {
        const img = images.find((i) => i.id === id || i.originalSrc === id || i.thumbnailSrc === id);
        if (!img) return;
        const key = img.id || img.originalSrc || '';
        // If overlays pre-provided, set and skip
        if (Array.isArray(overlaysByImage && overlaysByImage[img.id])) {
          setLocalOverlays((s) => ({ ...s, [img.id]: overlaysByImage[img.id] }));
          return;
        }
        const cached = overlayCache.get(key);
        if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
          setLocalOverlays((s) => ({ ...s, [img.id]: cached.data }));
          return;
        }

        // Start fetch for visible image
        (async () => {
          setLoadingMap((m) => ({ ...m, [key]: true }));
          setErrorMap((m) => ({ ...m, [key]: null }));
          const controller = new AbortController();
          controllersRef.current.set(key, controller);

          try {
            const overlays = await fetchOverlaysForImage(img, (globalThis as any).fetch, { timeoutMs: 8000 });
            setLocalOverlays((s) => ({ ...s, [img.id]: overlays }));
          } catch (err: any) {
            const code = err?.code || 'fetch_error';
            setErrorMap((m) => ({ ...m, [key]: `${code}: ${err?.message || 'Failed to fetch overlays'}` }));
          } finally {
            setLoadingMap((m) => ({ ...m, [key]: false }));
            controllersRef.current.delete(key);
          }
        })();
      });
    }, 150);

    observerRef.current = new IntersectionObserver((entries) => {
      intersectCb(entries);
    }, { root: null, threshold: 0.05 });

    // Observe the registered image elements
    imageRefs.current.forEach((el) => {
      if (el) observerRef.current.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      controllersRef.current.forEach((c) => c.abort());
      controllersRef.current.clear();
    };
  }, [images, overlaysByImage]);

  // Helper to attach refs to images for observation
  const attachImageRef = (id: string) => (el: HTMLElement | null) => {
    if (!el) {
      imageRefs.current.delete(id);
      return;
    }
    el.dataset.imageId = id;
    imageRefs.current.set(id, el);
    if (observerRef.current) observerRef.current.observe(el);
  };

  // Fallback: If an image has pre-provided overlays, ensure they are set on mount
  useEffect(() => {
    images.forEach((img) => {
      if (Array.isArray(overlaysByImage && overlaysByImage[img.id])) {
        setLocalOverlays((s) => ({ ...s, [img.id]: overlaysByImage[img.id] }));
      }
    });
  }, [images, overlaysByImage]);

  return (
    <div data-testid="visual-overlays-island-root" data-hydrated={mounted ? 'true' : 'false'}>
      <div className="visual-overlays-list space-y-6">
        {images.map((img) => (
          <div key={img.id} className="visual-image-item relative" data-testid={`visual-image-${img.id}`}>
            <img
              ref={attachImageRef(img.id)}
              src={img.originalSrc || img.thumbnailSrc || ''}
              alt={`Document ${props.documentId || ''} image ${img.id}`}
              data-testid="document-image"
              data-image-id={img.id}
              className="w-full h-auto block"
              crossOrigin="anonymous"
            />

            {/* SVG overlay that scales with the image container */}
            <div data-testid={`overlay-container-${img.id}`} className="absolute inset-0 pointer-events-none">
              <svg data-testid={`overlay-svg-${img.id}`} width="100%" height="100%" preserveAspectRatio="none" className="block">
                {(localOverlays[img.id] || []).map((ov: any) => {
                  const bbox = normalizeBoxToPixels(ov.bbox || { x: 0, y: 0, width: 0, height: 0 }, 1000, 1000);
                  // Using percent viewBox mapping so that scaling works; we will render rect in percentage coordinates
                  const x = (ov.bbox?.x || 0) * 100;
                  const y = (ov.bbox?.y || 0) * 100;
                  const w = (ov.bbox?.width || 0) * 100;
                  const h = (ov.bbox?.height || 0) * 100;
                  return (
                    <rect key={ov.id} data-testid={`overlay-marker-${ov.id}`} x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} fill="none" stroke="rgba(34,197,94,0.9)" stroke-width="2" />
                  );
                })}
              </svg>

              {/* Loading / error indicators (non-interactive, aria-hidden) */}
              {loadingMap[img.id] ? <div data-testid={`overlay-loading-${img.id}`} aria-hidden="true">Loading overlays...</div> : null}
              {errorMap[img.id] ? <div data-testid={`overlay-error-${img.id}`} aria-hidden="true">{errorMap[img.id]}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
