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
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function normalizeBoxToPixels(bbox: { x: number; y: number; width: number; height: number }, containerWidth: number, containerHeight: number) {
  // bbox normalized in [0..1]
  return {
    left: Math.round(bbox.x * containerWidth),
    top: Math.round(bbox.y * containerHeight),
    width: Math.round(bbox.width * containerWidth),
    height: Math.round(bbox.height * containerHeight),
  };
}

export async function fetchOverlaysForImage(image: any, fetchImpl: any = (globalThis as any).fetch) {
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

  if (typeof fetchImpl !== 'function') throw new Error('fetch not available');

  const controller = new AbortController();
  opts.signal = controller.signal;

  try {
    const res = await fetchImpl(url, opts);
    if (!res || !res.ok) throw new Error('Overlay service error');
    const json = await res.json();
    const overlays = Array.isArray(json.overlays) ? json.overlays : json;
    overlayCache.set(cacheKey, { ts: now, data: overlays });
    return overlays;
  } catch (err) {
    // Do not cache failures; caller should handle retries
    throw err;
  } finally {
    // nothing (controller can be used by caller if needed)
  }
}

export default function VisualOverlaysIsland(props: Props) {
  const { images = [], overlaysByImage = {} } = props;
  const [mounted, setMounted] = useState(false);
  const [localOverlays, setLocalOverlays] = useState<Record<string, any[]>>(overlaysByImage || {});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Fetch overlays for each image (simple strategy: fetch all, can be optimized to viewport later)
    images.forEach((img) => {
      const key = img.id || img.originalSrc || '';
      if (!key) return;
      // If overlays pre-provided, prefer them
      if (Array.isArray(overlaysByImage && overlaysByImage[img.id])) {
        setLocalOverlays((s) => ({ ...s, [img.id]: overlaysByImage[img.id] }));
        return;
      }

      // Skip if already cached
      const cached = overlayCache.get(key);
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
        setLocalOverlays((s) => ({ ...s, [img.id]: cached.data }));
        return;
      }

      // Start fetch
      (async () => {
        setLoadingMap((m) => ({ ...m, [key]: true }));
        setErrorMap((m) => ({ ...m, [key]: null }));
        const controller = new AbortController();
        controllersRef.current.set(key, controller);

        try {
          const overlays = await fetchOverlaysForImage(img, (globalThis as any).fetch);
          setLocalOverlays((s) => ({ ...s, [img.id]: overlays }));
        } catch (err: any) {
          setErrorMap((m) => ({ ...m, [key]: err?.message || 'Failed to fetch overlays' }));
        } finally {
          setLoadingMap((m) => ({ ...m, [key]: false }));
          controllersRef.current.delete(key);
        }
      })();
    });

    return () => {
      // abort pending fetches when images change or component unmounts
      controllersRef.current.forEach((c) => c.abort());
      controllersRef.current.clear();
    };

  }, [images, overlaysByImage]);

  return (
    <div data-testid="visual-overlays-island-root" data-hydrated={mounted ? 'true' : 'false'}>
      <div className="visual-overlays-list space-y-6">
        {images.map((img) => (
          <div key={img.id} className="visual-image-item" data-testid={`visual-image-${img.id}`} style={{ position: 'relative' }}>
            <img
              src={img.originalSrc || img.thumbnailSrc || ''}
              alt={`Document ${props.documentId || ''} image ${img.id}`}
              data-testid="document-image"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              crossOrigin="anonymous"
            />

            {/* SVG overlay that scales with the image container */}
            <div data-testid={`overlay-container-${img.id}`} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              <svg data-testid={`overlay-svg-${img.id}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
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
