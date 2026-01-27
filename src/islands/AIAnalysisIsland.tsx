import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { AIAnalysisSchema, type AIAnalysisContract } from '../ui/contracts/AIAnalysis.contract';

type GpuState = 'idle' | 'checking' | 'preparing' | 'ready' | 'error';
type AnalysisType = 'text' | 'visual' | 'chat' | null;

function dispatchEventSafe(name: string, detail: any) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  const EventConstructor = (typeof window !== 'undefined' && window.CustomEvent) ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}

export default function AIAnalysisIsland(props: Partial<AIAnalysisContract>) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType>(null);
  const [gpuState, setGpuState] = useState<GpuState>(props.gpuState || 'idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [documentId, setDocumentId] = useState<number | null>(props.documentId ?? null);
  const [content, setContent] = useState(props.content || '');

  // Check GPU state on mount
  useEffect(() => {
    let mounted = true;

    const checkGpu = async () => {
      setGpuState('checking');
      try {
        const res = await fetch('/api/visual-rag/health', { signal: AbortSignal.timeout(5000) });
        if (!mounted) return;

        if (res.status === 503) {
          setGpuState('preparing');
        } else if (res.ok) {
          setGpuState('ready');
        } else {
          setGpuState('error');
        }
      } catch {
        if (mounted) setGpuState('error');
      }
    };

    checkGpu();
    return () => { mounted = false; };
  }, []);

  // Listen for document selection
  useEffect(() => {
    const onDocumentSelected = (e: any) => {
      const detail = e?.detail || {};
      if (detail.documentId !== undefined) {
        setDocumentId(detail.documentId);
      }
      if (detail.content !== undefined) {
        setContent(detail.content);
      }
    };

    const onMetadataUpdated = (e: any) => {
      const detail = e?.detail || {};
      if (detail.content !== undefined) {
        setContent(detail.content);
      }
    };

    window.addEventListener('document:selected', onDocumentSelected as EventListener);
    window.addEventListener('manual:metadata-updated', onMetadataUpdated as EventListener);
    
    return () => {
      window.removeEventListener('document:selected', onDocumentSelected as EventListener);
      window.removeEventListener('manual:metadata-updated', onMetadataUpdated as EventListener);
    };
  }, []);

  // Test-only marker
  useEffect(() => {
    try { (window as any).__ai_analysis_island_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  // Clear status after delay
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const toManualFields = useCallback((doc: any, fallbackDomain = 'AI') => {
    const customFields = doc?.custom_fields;
    if (!customFields || typeof customFields !== 'object') return [];
    return Object.entries(customFields).map(([label, value]) => ({
      label,
      value: value != null ? String(value) : '',
      domain: doc?.domain || fallbackDomain,
      confidence: 1,
    }));
  }, []);

  const handleTextAnalysis = useCallback(async () => {
    if (!documentId) return;
    
    setIsAnalyzing(true);
    setAnalysisType('text');
    setStatusMessage('AI is analyzing the document...');
    
    dispatchEventSafe('ai:analysis-started', {
      type: 'ai:analysis-started',
      documentId,
      analysisType: 'text',
    });

    try {
      let analysisContent = content;

      if (!analysisContent || analysisContent === 'No content available') {
        throw new Error('No document content available for analysis');
      }

      if (analysisContent.length > 50000) {
        analysisContent = analysisContent.substring(0, 50000);
      }

      const res = await fetch('/manual/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: analysisContent,
          id: documentId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result = await res.json();

      const doc = result?.document || result?.result?.document || result?.result || {};
      const tags = Array.isArray(doc.tags) ? doc.tags : [];
      const fields = toManualFields(doc);
      const documentType = doc.document_type || null;

      dispatchEventSafe('ai:analysis-completed', {
        type: 'ai:analysis-completed',
        documentId,
        analysisType: 'text',
        result: {
          tags,
          correspondent: doc.correspondent || null,
          title: doc.title || null,
          documentType,
          fields,
        },
      });
      if (tags && tags.length > 0) {
        dispatchEventSafe('tags:suggestions-received', {
          type: 'tags:suggestions-received',
          documentId,
          suggestedTags: tags,
        });
      }

      setStatusMessage('Analysis completed successfully');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisType(null);
    }
  }, [documentId, content, toManualFields]);

  const handleVisualAnalysis = useCallback(async () => {
    if (!documentId) return;
    if (gpuState !== 'ready') {
      setStatusMessage('GPU is not ready for visual analysis');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisType('visual');
    setStatusMessage('Running Visual Analysis (Expert Pipeline)...');
    
    dispatchEventSafe('ai:analysis-started', {
      type: 'ai:analysis-started',
      documentId,
      analysisType: 'visual',
    });

    try {
      const res = await fetch('/manual/analyze-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: documentId }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Visual analysis failed');
      }

      dispatchEventSafe('visual:fallback', {
        type: 'visual:fallback',
        documentId,
        fallback: data.fallback || null,
      });

      const doc = data.result || data.document || {};
      const tags = Array.isArray(doc.tags) ? doc.tags : [];
      const domain = doc.domain || 'general';
      const fields = toManualFields(doc, domain);
      const documentType = doc.document_type || null;

      dispatchEventSafe('ai:analysis-completed', {
        type: 'ai:analysis-completed',
        documentId,
        analysisType: 'visual',
        result: {
          tags,
          correspondent: doc.correspondent || null,
          title: doc.title || null,
          domain,
          documentType,
          fields,
        },
      });
      if (tags.length > 0) {
        dispatchEventSafe('tags:suggestions-received', {
          type: 'tags:suggestions-received',
          documentId,
          suggestedTags: tags,
        });
      }

      setStatusMessage(`Visual analysis complete! Domain: ${data.result?.domain || 'general'}, Overlays: ${data.overlayCount || 0}`);
    } catch (err: any) {
      console.error('Visual analysis error:', err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisType(null);
    }
  }, [documentId, gpuState, toManualFields]);

  const handleChat = useCallback(() => {
    if (!documentId) return;
    
    dispatchEventSafe('ai:analysis-started', {
      type: 'ai:analysis-started',
      documentId,
      analysisType: 'chat',
    });

    window.location.href = `/chat?open=${documentId}`;
  }, [documentId]);

  const isDisabled = !documentId || isAnalyzing;
  const visualDisabled = isDisabled || gpuState !== 'ready';

  return (
    <div data-testid="ai-analysis-root" data-hydrated="true" className="aia-root">
      {/* Text Analysis Button */}
      <button
        type="button"
        className="aia-btn aia-btn-primary"
        onClick={handleTextAnalysis}
        disabled={isDisabled}
        data-testid="analyze-btn"
      >
        {isAnalyzing && analysisType === 'text' ? (
          <>
            <i className="fas fa-spinner fa-spin aia-icon" aria-hidden="true"></i>
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <i className="fas fa-robot aia-icon" aria-hidden="true"></i>
            <span>Analyze with AI</span>
          </>
        )}
      </button>

      {/* Chat Button */}
      <button
        type="button"
        className="aia-btn aia-btn-secondary"
        onClick={handleChat}
        disabled={!documentId}
        data-testid="open-chat-btn"
      >
        <i className="fas fa-comment aia-icon" aria-hidden="true"></i>
        <span>Chat with AI (Beta)</span>
      </button>

      {/* Visual Analysis Button */}
      <button
        type="button"
        className="aia-btn aia-btn-accent"
        onClick={handleVisualAnalysis}
        disabled={visualDisabled}
        data-testid="analyze-visual-btn"
      >
        {isAnalyzing && analysisType === 'visual' ? (
          <>
            <i className="fas fa-spinner fa-spin aia-icon" aria-hidden="true"></i>
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <i className="fas fa-eye aia-icon" aria-hidden="true"></i>
            <span>Visual Analysis (Expert Pipeline)</span>
            {gpuState === 'preparing' && (
              <span className="aia-gpu-badge aia-gpu-preparing">GPU Warming</span>
            )}
            {gpuState === 'error' && (
              <span className="aia-gpu-badge aia-gpu-error">GPU Unavailable</span>
            )}
          </>
        )}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`aia-status ${statusMessage.startsWith('Error') ? 'aia-status-error' : 'aia-status-info'}`}
          data-testid="ai-status"
          role="status"
          aria-live="polite"
        >
          {!statusMessage.startsWith('Error') && isAnalyzing && (
            <i className="fas fa-spinner fa-spin aia-icon" aria-hidden="true"></i>
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      <style>{`
        .aia-root {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .aia-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border-color, #ddd);
        }
        .aia-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .aia-btn-primary {
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
        }
        .aia-btn-primary:hover:not(:disabled) {
          background: var(--hover-bg, #f5f5f5);
        }
        .aia-btn-secondary {
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
        }
        .aia-btn-secondary:hover:not(:disabled) {
          background: var(--hover-bg, #f5f5f5);
        }
        .aia-btn-accent {
          background: var(--bg-primary, white);
          color: var(--accent-primary, #3498db);
          border-color: var(--accent-primary, #3498db);
        }
        .aia-btn-accent:hover:not(:disabled) {
          background: var(--accent-primary, #3498db);
          color: white;
        }
        .aia-icon {
          font-size: 0.875rem;
        }
        .aia-gpu-badge {
          font-size: 0.625rem;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }
        .aia-gpu-preparing {
          background: #fef3c7;
          color: #92400e;
        }
        .aia-gpu-error {
          background: #fee2e2;
          color: #991b1b;
        }
        .aia-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 0.875rem;
          animation: aia-fade-in 0.3s ease;
        }
        .aia-status-info {
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent-primary, #3b82f6);
        }
        .aia-status-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        @keyframes aia-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
