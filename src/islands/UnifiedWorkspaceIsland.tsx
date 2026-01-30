import { h } from 'preact';
import { useEffect } from 'preact/hooks';

export default function UnifiedWorkspaceIsland(props: any) {
  // Listen for metadata locate events and translate to overlay highlight events
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      const fieldId = detail.fieldId || detail.field_id || detail.id;
      try { (window as any).__last_metadata_locate = { fieldId, handled: false }; } catch (err) { /* ignore */ }
      if (!fieldId) return;

      // Try to resolve using visual overlays and fields
      const visual = props.visual || {};
      const overlays = (visual.overlays || visual.overlayItems || visual.items || []) as any[];
      const vfields = (visual.fields || []) as any[];

      // Helper: find overlay bbox from overlay object
      const getBboxFromOverlay = (ov: any) => {
        if (!ov) return null;
        if (ov.bbox) return ov.bbox;
        if (ov.box) return ov.box;
        if (Array.isArray(ov.bbox_array)) {
          const [x, y, w, h] = ov.bbox_array;
          return { x, y, width: w, height: h };
        }
        return null;
      };

      // 1) Try to find a direct field match which includes overlay info
      let found: any = vfields.find((f) => f.id === fieldId || f.name === fieldId || f.label === fieldId || f.paperlessMapping === fieldId);
      if (found && (found.bbox || found.overlay || found.overlayId || found.overlay_bbox)) {
        const bbox = found.bbox || found.overlay?.bbox || found.overlay_bbox || null;
        const page = found.pageNumber || found.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
          return;
        }
        // If field has overlayId, try to find that overlay
        if (found.overlayId) {
          const overlay = overlays.find((o) => o.id === found.overlayId || o.overlayId === found.overlayId);
          const bbox = getBboxFromOverlay(overlay);
          const page = overlay?.pageNumber || overlay?.page || found.pageNumber || 1;
          if (bbox) {
            window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
            try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
            return;
          }
        }
      }

      // 2) Try to find an overlay by paperlessMapping match
      const overlayByMapping = overlays.find((o) => o.paperlessMapping === fieldId || o.paperless_mapping === fieldId || o.paperless_mapping === (vfields.find((f:any) => f.id === fieldId)?.paperlessMapping));
      if (overlayByMapping) {
        const bbox = getBboxFromOverlay(overlayByMapping);
        const page = overlayByMapping?.pageNumber || overlayByMapping?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
          return;
        }
      }

      // 3) Try to resolve overlay by id directly
      const overlayById = overlays.find((o) => o.id === fieldId);
      if (overlayById) {
        const bbox = getBboxFromOverlay(overlayById);
        const page = overlayById?.pageNumber || overlayById?.page || 1;
        if (bbox) {
          window.dispatchEvent(new CustomEvent('overlay:highlight-region', { detail: { bbox, page } }));
          try { (window as any).__last_metadata_locate = { fieldId, handled: true, bbox, page }; } catch (err) {}
          return;
        }
      }

      // If not found, emit a not-found marker (tests can observe)
      try { (window as any).__last_metadata_locate = { fieldId, handled: false }; } catch (err) { /* ignore */ }
      console.warn('[UnifiedWorkspaceIsland] metadata:locate-field: could not resolve fieldId to overlay bbox', fieldId);
    };

    window.addEventListener('metadata:locate-field', handler as EventListener);
    return () => window.removeEventListener('metadata:locate-field', handler as EventListener);
  }, [props.visual]);

  return (
    <div className="h-full w-full flex flex-col p-8">
      <div className="flex-1 border-2 border-dashed border-[#e5e0d8] rounded-lg flex items-center justify-center">
        <p className="font-['Space_Grotesk'] text-[#888]">Document Viewer Area Placeholder</p>
      </div>
    </div>
  );
}
