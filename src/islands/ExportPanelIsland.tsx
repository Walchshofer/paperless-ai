import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ExportPanelContract } from '../ui/contracts/ExportPanel.contract';

type ExportType = 'region' | 'text' | 'annotations';

export default function ExportPanelIsland(props: ExportPanelContract) {
  const [showModal, setShowModal] = useState(false);
  const [exportType, setExportType] = useState('text' as ExportType);
  const [data, setData] = useState(null as string | Record<string, unknown>[] | null);
  const [format, setFormat] = useState('png'); // png, pdf, txt, json
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  useEffect(() => {
    const onRegion = (e: Event) => {
      setData((e as CustomEvent).detail?.imageBase64);
      setExportType('region');
      setFormat('png');
      setShowModal(true);
    };
    const onText = (e: Event) => {
      setData((e as CustomEvent).detail?.text);
      setExportType('text');
      setFormat('txt');
      setShowModal(true);
    };
    const onAnnotations = (e: Event) => {
      setData((e as CustomEvent).detail?.annotations);
      setExportType('annotations');
      setFormat('json');
      setShowModal(true);
    };

    window.addEventListener('export:region-requested', onRegion as EventListener);
    window.addEventListener('export:text-requested', onText as EventListener);
    window.addEventListener('export:annotations-requested', onAnnotations as EventListener);

    return () => {
      window.removeEventListener('export:region-requested', onRegion as EventListener);
      window.removeEventListener('export:text-requested', onText as EventListener);
      window.removeEventListener('export:annotations-requested', onAnnotations as EventListener);
    };
  }, []);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (exportType === 'region') {
        endpoint = '/api/export/region';
        body = { imageBase64: data, format };
      } else if (exportType === 'text') {
        endpoint = '/api/export/text';
        body = { text: data, format };
      } else if (exportType === 'annotations') {
        endpoint = '/api/export/annotations';
        body = { annotations: data, documentId: props.documentId };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from header or default
      const disposition = response.headers.get('Content-Disposition');
      let filename = `export.${format}`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]*)"/.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowModal(false);
    } catch (e) {
      console.error('Export error', e);
      const errorMsg = e instanceof Error ? e.message : 'Export failed. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (exportType === 'text') {
        await navigator.clipboard.writeText(data);
        alert('Copied to clipboard!');
      } else if (exportType === 'annotations') {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert('Copied to clipboard!');
      } else if (exportType === 'region') {
        // Copy image to clipboard? Complex for base64.
        // For now, simpler to just support download.
        alert('Image copy not supported yet. Please download.');
      }
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 capitalize flex items-center gap-2">
          <i className={`fas ${exportType === 'region' ? 'fa-image' : exportType === 'text' ? 'fa-file-alt' : 'fa-list'}`}></i>
          Export {exportType}
        </h2>
        
        {/* Loading State */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
            <i className="fas fa-spinner fa-spin text-blue-600"></i>
            <span className="text-sm text-blue-700">Exporting...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2">
            <i className="fas fa-exclamation-circle text-red-600"></i>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex gap-2">
            {exportType === 'region' && (
              <>
                <button 
                  onClick={() => setFormat('png')} 
                  disabled={loading}
                  className={`px-3 py-2 border rounded transition-colors ${format === 'png' ? 'bg-[#b87333] border-[#b87333] text-white' : 'bg-white hover:bg-gray-50'} disabled:opacity-50`}
                >
                  PNG
                </button>
                <button 
                  onClick={() => setFormat('pdf')} 
                  disabled={loading}
                  className={`px-3 py-2 border rounded transition-colors ${format === 'pdf' ? 'bg-[#b87333] border-[#b87333] text-white' : 'bg-white hover:bg-gray-50'} disabled:opacity-50`}
                >
                  PDF
                </button>
              </>
            )}
            {exportType === 'text' && (
              <>
                <button 
                  onClick={() => setFormat('txt')} 
                  disabled={loading}
                  className={`px-3 py-2 border rounded transition-colors ${format === 'txt' ? 'bg-[#b87333] border-[#b87333] text-white' : 'bg-white hover:bg-gray-50'} disabled:opacity-50`}
                >
                  TXT
                </button>
                <button 
                  onClick={() => setFormat('pdf')} 
                  disabled={loading}
                  className={`px-3 py-2 border rounded transition-colors ${format === 'pdf' ? 'bg-[#b87333] border-[#b87333] text-white' : 'bg-white hover:bg-gray-50'} disabled:opacity-50`}
                >
                  PDF
                </button>
              </>
            )}
            {exportType === 'annotations' && (
              <button 
                onClick={() => setFormat('json')} 
                disabled={loading}
                className={`px-3 py-2 border rounded transition-colors ${format === 'json' ? 'bg-[#b87333] border-[#b87333] text-white' : 'bg-white hover:bg-gray-50'} disabled:opacity-50`}
              >
                JSON
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={() => setShowModal(false)}
            disabled={loading}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleCopy}
            disabled={loading}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <i className="fas fa-copy mr-1"></i>
            Copy
          </button>
          <button 
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-[#b87333] text-white rounded hover:bg-[#a56729] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <i className="fas fa-download"></i>
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
