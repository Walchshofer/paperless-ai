import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import type { VisualAnnotationContract } from '../ui/contracts/VisualAnnotation.contract';

type Annotation = {
  label: string;
  note: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confirmed?: boolean;
};

type GpuState = 'idle' | 'checking' | 'preparing' | 'ready' | 'error';

export default function VisualAnnotationIsland(props: Partial<VisualAnnotationContract>) {
  const [status, setStatus] = useState('idle' as GpuState);
  const [annotations, setAnnotations] = useState([] as Annotation[]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [liveRect, setLiveRect] = useState(null as {x: number, y: number, w: number, h: number} | null);

  const canvasRef = useRef(null as HTMLDivElement | null);
  const startRef = useRef(null as {x: number, y: number} | null);

  // 1. Handshake & 503 Handling
  useEffect(() => {
    let mounted = true;
    const checkSidecar = async () => {
      setStatus('checking');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

      try {
        // Mock endpoint based on architecture - in real app this hits the sidecar proxy
        const res = await fetch('/api/visual-rag/health', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!mounted) return;

        if (res.status === 503) {
          setStatus('preparing');
          // Poll again after delay
          setTimeout(() => mounted && checkSidecar(), 2000);
          return;
        }

        if (res.ok) {
          setStatus('ready');
        } else {
          setStatus('error');
        }
      } catch (e) {
        if (mounted) setStatus('error');
      }
    };

    checkSidecar();
    return () => { mounted = false; };
  }, []);

  // 2. Canvas Interaction Logic
  const getLocalCoords = (evt: MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!isDrawing || status !== 'ready') return;
    e.preventDefault();
    const { x, y } = getLocalCoords(e);
    startRef.current = { x, y };
    setLiveRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x, y } = getLocalCoords(e);
    const left = Math.min(startRef.current.x, x);
    const top = Math.min(startRef.current.y, y);
    const width = Math.abs(x - startRef.current.x);
    const height = Math.abs(y - startRef.current.y);
    setLiveRect({ x: left, y: top, w: width, h: height });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDrawing || !startRef.current || !liveRect) return;
    const { x, y, w: cw, h: ch } = getLocalCoords(e);
    const left = Math.min(startRef.current.x, x);
    const top = Math.min(startRef.current.y, y);
    const width = Math.abs(x - startRef.current.x);
    const height = Math.abs(y - startRef.current.y);

    // Normalize
    const nx = left / cw;
    const ny = top / ch;
    const nw = width / cw;
    const nh = height / ch;

    setAnnotations((prev: Annotation[]) => [...prev, { label: '', note: '', x: nx, y: ny, width: nw, height: nh }]);
    setLiveRect(null);
    startRef.current = null;
  };

  // 3. Actions
  const handleConfirm = async (index: number) => {
    const ann = annotations[index];
    try {
      // Trigger Hybrid SOT update
      await fetch('/api/visual-rag/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'feedback:confirmed',
          documentId: props.documentId,
          page: props.page,
          annotation: ann
        })
      });

      const newAnns = [...annotations];
      newAnns[index].confirmed = true;
      setAnnotations(newAnns);
      
      document.dispatchEvent(new CustomEvent('feedback:confirmed', { detail: ann }));
    } catch (e) {
      console.error('Failed to confirm match', e);
    }
  };

  const handleSave = () => {
    const payload = {
      documentId: props.documentId || null,
      page: props.page || null,
      annotations
    };
    document.dispatchEvent(new CustomEvent('payload:ready', { detail: payload }));
  };

  return (
    <div data-testid="visual-annotation-island-root">
      <div className="vai-controls">
        <button 
          data-testid="draw-toggle"
          onClick={() => setIsDrawing(!isDrawing)}
          aria-pressed={isDrawing ? 'true' : 'false'}
          disabled={status !== 'ready'}
        >
          {isDrawing ? 'Drawing: ON' : 'Draw Mode'}
        </button>
        <button data-testid="save-annotations" onClick={handleSave}>Save Annotations</button>
        <div data-testid="annotation-status" className="vai-status">
          {annotations.length} annotations
        </div>
        {status === 'preparing' && (
          <span className="vai-gpu-text">GPU Preparing...</span>
        )}
      </div>

      <div 
        ref={canvasRef}
        data-testid="annotation-canvas" 
        className={`vai-canvas ${isDrawing ? 'vai-cursor-draw' : 'vai-cursor-default'}`}
        onMouseDown={handleMouseDown as any}
        onMouseMove={handleMouseMove as any}
        onMouseUp={handleMouseUp as any}
      >
        {/* GPU Preparing Loader Overlay */}
        {status === 'preparing' && (
          <div className="vai-loader-overlay">
            <div className="vai-spinner" />
            <div className="vai-loader-text">GPU Preparing (Warmup)</div>
          </div>
        )}

        {/* Render Annotations */}
        {annotations.map((ann: Annotation, i: number) => (
          <div key={i} style={{
            '--vai-x': `${ann.x * 100}%`, '--vai-y': `${ann.y * 100}%`,
            '--vai-w': `${ann.width * 100}%`, '--vai-h': `${ann.height * 100}%`
          } as any} className={`vai-annotation-box ${ann.confirmed ? 'vai-box-confirmed' : 'vai-box-default'}`} />
        ))}

        {/* Live Rect */}
        {liveRect && (
          <div style={{
            '--vai-x': `${liveRect.x}px`, '--vai-y': `${liveRect.y}px`,
            '--vai-w': `${liveRect.w}px`, '--vai-h': `${liveRect.h}px`
          } as any} className="vai-annotation-box vai-box-default" />
        )}
      </div>

      <div data-testid="annotations-list" className="vai-list">
        {annotations.map((ann: Annotation, i: number) => (
          <div key={i} data-testid="annotation-item" className="vai-item">
            <input 
              data-testid={`annotation-label-${i}`} 
              placeholder="Label" 
              value={ann.label} 
              onInput={(e: any) => { const newAnns = [...annotations]; newAnns[i].label = (e.target as HTMLInputElement).value; setAnnotations(newAnns); }}
            />
            <input 
              data-testid={`annotation-note-${i}`} 
              placeholder="Note" 
              value={ann.note} 
              onInput={(e: any) => { const newAnns = [...annotations]; newAnns[i].note = (e.target as HTMLInputElement).value; setAnnotations(newAnns); }}
            />
            <button onClick={() => handleConfirm(i)} disabled={ann.confirmed}>
              {ann.confirmed ? 'Confirmed' : 'Confirm Match'}
            </button>
            <button onClick={() => setAnnotations(annotations.filter((_: Annotation, idx: number) => idx !== i))}>Remove</button>
          </div>
        ))}
      </div>
      <style>{`
        .vai-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .vai-status { margin-left: 8px; color: #333; }
        .vai-gpu-text { color: #e67e22; font-weight: bold; }
        .vai-canvas { position: relative; border: 1px solid #ddd; height: 240px; touch-action: none; background: #fff; }
        .vai-cursor-draw { cursor: crosshair; }
        .vai-cursor-default { cursor: default; }
        .vai-loader-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; }
        .vai-spinner { width: 24px; height: 24px; border: 3px solid #ddd; border-top-color: #333; border-radius: 50%; animation: spin 1s linear infinite; }
        .vai-loader-text { margin-top: 8px; font-weight: bold; }
        .vai-annotation-box { position: absolute; box-sizing: border-box; pointer-events: none; left: var(--vai-x); top: var(--vai-y); width: var(--vai-w); height: var(--vai-h); }
        .vai-box-default { border: 2px solid rgba(220,20,60,0.9); }
        .vai-box-confirmed { border: 2px solid #27ae60; }
        .vai-list { margin-top: 8px; }
        .vai-item { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
