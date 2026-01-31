import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { ExportPanelContract } from '../ui/contracts/ExportPanel.contract';

type ExportType = 'region' | 'text' | 'annotations';

export default function ExportPanelIsland(props: ExportPanelContract) {
  const [showModal, setShowModal] = useState(false);
  const [exportType, setExportType] = useState('text' as ExportType);
  const [data, setData] = useState(null as any);
  const [format, setFormat] = useState('png'); // png, pdf, txt, json
  const [loading, setLoading] = useState(false);

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
    try {
      let endpoint = '';
      let body: any = {};

      if (exportType === 'region') {
        endpoint = '/manual/export/region';
        body = { imageBase64: data, format };
      } else if (exportType === 'text') {
        endpoint = '/manual/export/text';
        body = { text: data, format };
      } else if (exportType === 'annotations') {
        endpoint = '/manual/export/annotations';
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
      alert('Export failed. Please try again.');
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
        <h2 className="text-xl font-bold mb-4 capitalize">Export {exportType}</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex gap-2">
            {exportType === 'region' && (
              <>
                <button 
                  onClick={() => setFormat('png')} 
                  className={`px-3 py-2 border rounded ${format === 'png' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                >
                  PNG
                </button>
                <button 
                  onClick={() => setFormat('pdf')} 
                  className={`px-3 py-2 border rounded ${format === 'pdf' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                >
                  PDF
                </button>
              </>
            )}
            {exportType === 'text' && (
              <>
                <button 
                  onClick={() => setFormat('txt')} 
                  className={`px-3 py-2 border rounded ${format === 'txt' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                >
                  TXT
                </button>
                <button 
                  onClick={() => setFormat('pdf')} 
                  className={`px-3 py-2 border rounded ${format === 'pdf' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
                >
                  PDF
                </button>
              </>
            )}
            {exportType === 'annotations' && (
              <button 
                onClick={() => setFormat('json')} 
                className={`px-3 py-2 border rounded ${format === 'json' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white'}`}
              >
                JSON
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={() => setShowModal(false)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button 
            onClick={handleCopy}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Copy
          </button>
          <button 
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
