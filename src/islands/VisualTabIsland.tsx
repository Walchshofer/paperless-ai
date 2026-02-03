import { h } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';

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
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState(null as string | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [deleteInProgress, setDeleteInProgress] = useState(null as string | null);

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
        console.log(`[VisualTab] Document switched to ${documentId}`);
        // The existing useEffect that watches props.documentId will trigger data refetch
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
        if (props.documentId) {
          const fieldsRes = await fetch(`/api/visual-overlays/missing-fields/${props.documentId}`);
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
  }, [props.documentId]);

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

      if (purpose === 'label-field' && fieldId && props.documentId) {
        // Save overlay for field
        try {
          const response = await fetch('/api/visual-overlays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: props.documentId,
              fieldId,
              bbox,
              pageNumber: page
            })
          });

          if (response.ok) {
            // Refresh overlays and fields
            const overlaysRes = await fetch(`/api/visual-overlays/document/${props.documentId}`);
            if (overlaysRes.ok) {
              const overlaysData = await overlaysRes.json();
              setOverlays(overlaysData.overlays || []);
            }

            const fieldsRes = await fetch(`/api/visual-overlays/missing-fields/${props.documentId}`);
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
          detail: { bbox, page, documentId: props.documentId, imageBase64 }
        }));
      }

      setIsDrawMode(false);
      setActiveFieldId(null);
    };

    window.addEventListener('overlay:draw-complete', handleDrawComplete as EventListener);
    return () => window.removeEventListener('overlay:draw-complete', handleDrawComplete as EventListener);
  }, [props.documentId]);

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

  const missingFields = fields.filter((f: VisualField) => !f.isMapped);
  const mappedFields = fields.filter((f: VisualField) => f.isMapped);

  // No document selected state
  if (!props.documentId) {
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
