import { h, Fragment } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { HistoryManagerContract } from '../ui/contracts/HistoryManager.contract';
import OverlayViewerIsland from './OverlayViewerIsland';

type HistoryDoc = {
  document_id: number;
  title: string;
  created_at: string;
  tags: Array<{ id: number; name: string; color?: string }>;
  correspondent: string;
  link?: string;
};

type OverlaySummary = {
  total: number;
  mandatory: number;
  domains: Record<string, number>;
};

const columns = [
  'document_id',
  'document_id',
  'title',
  'tags',
  'correspondent',
  'created_at',
  'document_id',
  'document_id'
];

const domainColors: Record<string, string> = {
  FINANCIAL: '#F97316',
  MEDICAL: '#22C55E',
  LEGAL: '#A855F7',
  GENERAL: '#3B82F6'
};

const getDomainColor = (domain: string) =>
  domainColors[domain.toUpperCase()] || '#6B7280';

export default function HistoryManagerIsland(
  props: Partial<HistoryManagerContract>
) {
  const filters = props.filters || { tags: [], correspondents: [] };
  const initialQuery = props.initialQuery || {
    search: '',
    tag: null,
    correspondent: null,
    sort: { column: 'created_at', dir: 'desc' },
    page: 0,
    pageSize: 10
  };

  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState<HistoryDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmMode, setConfirmMode] = useState<'selected' | 'all' | null>(null);
  const [overlaySummaries, setOverlaySummaries] = useState<Record<number, OverlaySummary>>({});
  const [visualDocId, setVisualDocId] = useState<number | null>(null);
  const [visualPageCount, setVisualPageCount] = useState(1);
  const [visualOriginalUrl, setVisualOriginalUrl] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(filteredTotal / query.pageSize));

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('draw', String(Date.now()));
      params.set('start', String(query.page * query.pageSize));
      params.set('length', String(query.pageSize));
      params.set('search[value]', query.search || '');
      if (query.tag) params.set('tag', query.tag);
      if (query.correspondent) params.set('correspondent', query.correspondent);

      const sortColumn = query.sort?.column || 'created_at';
      const sortDir = query.sort?.dir || 'desc';
      const columnIndex = columns.indexOf(sortColumn);

      params.set('order[0][column]', String(columnIndex < 0 ? 2 : columnIndex));
      params.set('order[0][dir]', sortDir);

      columns.forEach((col, idx) => {
        params.set(`columns[${idx}][data]`, col);
      });

      const response = await fetch(`/api/history?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load history');
      const data = await response.json();

      setRows(Array.isArray(data.data) ? data.data : []);
      setTotal(data.recordsTotal || 0);
      setFilteredTotal(data.recordsFiltered || 0);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (rows.length === 0) return;

    const controller = new AbortController();
    const summaries: Record<number, OverlaySummary> = {};

    const loadSummaries = async () => {
      await Promise.all(
        rows.map(async (row) => {
          try {
            const response = await fetch(`/api/visual-rag/overlays/${row.document_id}`,
              { signal: controller.signal }
            );
            if (!response.ok) return;
            const data = await response.json();
            const overlays = Array.isArray(data.overlays) ? data.overlays : [];
            const domains: Record<string, number> = {};
            let mandatory = 0;

            overlays.forEach((overlay: any) => {
              const domain = (overlay.domain || 'GENERAL').toUpperCase();
              domains[domain] = (domains[domain] || 0) + 1;
              if (overlay.isMandatory) mandatory += 1;
            });

            summaries[row.document_id] = {
              total: overlays.length,
              mandatory,
              domains
            };
          } catch (err) {
            // ignore overlay fetch failures
          }
        })
      );

      if (!controller.signal.aborted) {
        setOverlaySummaries((prev) => ({ ...prev, ...summaries }));
      }
    };

    void loadSummaries();
    return () => controller.abort();
  }, [rows]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(rows.map((row) => row.document_id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const response = await fetch('/api/reset-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Reset failed');
      setConfirmMode(null);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    }
  };

  const resetAll = async () => {
    try {
      const response = await fetch('/api/reset-all-documents', { method: 'POST' });
      if (!response.ok) throw new Error('Reset failed');
      setConfirmMode(null);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    }
  };

  const reanalyzeDocument = async (docId: number) => {
    try {
      const response = await fetch(`/api/history/reanalyze/${docId}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Re-analysis failed');
    } catch (err: any) {
      setError(err.message || 'Re-analysis failed');
    }
  };

  const openVisualModal = async (docId: number) => {
    setVisualDocId(docId);
    setVisualOriginalUrl(null);
    setVisualPageCount(1);

    // Prefer manual preview to source Paperless originalUrl + pageCount.
    try {
      const preview = await fetch(`/manual/preview/${docId}`);
      if (preview.ok) {
        const data = await preview.json();
        const nextOriginalUrl =
          data.normalized_original_url || data.original_url || null;
        const nextPageCount = Number.isFinite(Number(data.pageCount))
          ? Number(data.pageCount) || 1
          : 1;

        setVisualOriginalUrl(nextOriginalUrl);
        setVisualPageCount(nextPageCount);

        if (typeof window !== 'undefined' && window.dispatchEvent) {
          // Defer to ensure listeners mount before dispatch in fast responses.
          setTimeout(() => {
            const EvCtor =
              typeof window.CustomEvent === 'function'
                ? window.CustomEvent
                : CustomEvent;
            const ev = new EvCtor('overlay:document-changed', {
              detail: {
                documentId: docId,
                page: 1,
                originalUrl: nextOriginalUrl,
                pageCount: nextPageCount,
              },
            });
            window.dispatchEvent(ev);
          }, 0);
        }
        return;
      }
    } catch (err) {
      // fall through to page-count fallback
    }

    // Fallback: maintain existing page-count behavior if preview fails.
    try {
      const info = await fetch(`/api/document/${docId}/page-count`);
      if (info.ok) {
        const data = await info.json();
        setVisualPageCount(data.pageCount || 1);
      }
    } catch (err) {
      // ignore
    }
  };

  const closeVisualModal = () => {
    setVisualDocId(null);
  };

  const guidedMessage = useMemo(() => {
    if (loading) return 'Loading history entries...';
    if (rows.length === 0) return 'No history yet. Process a document to begin.';
    if (selected.size > 0) return 'Ready to reset selected documents.';
    return 'Filter, review overlays, and take corrective action.';
  }, [loading, rows.length, selected.size]);

  return (
    <div data-testid="history-manager-root" data-hydrated="true" className="sg-shell">
      <div className="guided-rail" data-testid="history-guided-rail">
        <div className="guided-rail__label">Guided Rail</div>
        <div className="guided-rail__text">{guidedMessage}</div>
      </div>

      <div className="sg-actions">
        <button
          type="button"
          className="sg-danger"
          data-testid="history-reset-selected"
          onClick={() => setConfirmMode('selected')}
          disabled={selected.size === 0}
        >
          Reset Selected
        </button>
        <button
          type="button"
          className="sg-danger"
          data-testid="history-reset-all"
          onClick={() => setConfirmMode('all')}
        >
          Reset All
        </button>
      </div>

      <div className="sg-filters">
        <input
          type="text"
          data-testid="history-search"
          className="sg-input"
          placeholder="Search title, correspondent, tags..."
          value={query.search || ''}
          onInput={(e: any) =>
            setQuery((prev: any) => ({ ...prev, search: e.target.value, page: 0 }))
          }
        />
        <select
          data-testid="history-tag-filter"
          className="sg-select"
          value={query.tag || ''}
          onChange={(e: any) =>
            setQuery((prev: any) => ({ ...prev, tag: e.target.value || null, page: 0 }))
          }
        >
          <option value="">All Tags</option>
          {filters.tags?.map((tag) => (
            <option key={tag.id} value={String(tag.id)}>
              {tag.name}
            </option>
          ))}
        </select>
        <select
          data-testid="history-correspondent-filter"
          className="sg-select"
          value={query.correspondent || ''}
          onChange={(e: any) =>
            setQuery((prev: any) => ({
              ...prev,
              correspondent: e.target.value || null,
              page: 0
            }))
          }
        >
          <option value="">All Correspondents</option>
          {filters.correspondents?.map((corr) => (
            <option key={corr} value={corr}>
              {corr}
            </option>
          ))}
        </select>
      </div>

      <div className="sg-table-wrapper">
        {error && <div className="sg-error">{error}</div>}
        <table className="sg-table" data-testid="history-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  data-testid="history-select-all"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(e: any) => toggleSelectAll(e.target.checked)}
                />
              </th>
              <th>ID</th>
              <th>
                <button
                  type="button"
                  className="sg-sort"
                  onClick={() =>
                    setQuery((prev: any) => ({
                      ...prev,
                      sort: {
                        column: 'title',
                        dir: prev.sort?.dir === 'asc' ? 'desc' : 'asc'
                      }
                    }))
                  }
                >
                  Title
                </button>
              </th>
              <th>Tags</th>
              <th>Correspondent</th>
              <th>
                <button
                  type="button"
                  className="sg-sort"
                  onClick={() =>
                    setQuery((prev: any) => ({
                      ...prev,
                      sort: {
                        column: 'created_at',
                        dir: prev.sort?.dir === 'asc' ? 'desc' : 'asc'
                      }
                    }))
                  }
                >
                  Modified
                </button>
              </th>
              <th>Overlays</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="sg-loading">
                  Loading history...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="sg-empty">
                  No history entries found.
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => {
              const summary = overlaySummaries[row.document_id];
              return (
                <tr key={row.document_id}>
                  <td>
                    <input
                      type="checkbox"
                      data-testid={`history-select-${row.document_id}`}
                      checked={selected.has(row.document_id)}
                      onChange={() => toggleSelectOne(row.document_id)}
                    />
                  </td>
                  <td>{row.document_id}</td>
                  <td>
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(row.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    {row.tags?.length ? (
                      <div className="sg-tags">
                        {row.tags.map((tag) => (
                          <span key={tag.id} className="sg-tag">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No tags</span>
                    )}
                  </td>
                  <td>{row.correspondent || 'Not assigned'}</td>
                  <td className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td>
                    {summary ? (
                      <div className="sg-overlays">
                        {Object.entries(summary.domains).map(([domain, count]) => (
                          <span
                            key={domain}
                            className="sg-badge"
                            style={{ color: getDomainColor(domain), borderColor: `${getDomainColor(domain)}55` }}
                          >
                            {domain.slice(0, 1)} {count}
                          </span>
                        ))}
                        {summary.mandatory > 0 && (
                          <span className="sg-mandatory">*{summary.mandatory}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td>
                    <div className="sg-row-actions">
                      <a
                        href={`/history/doc/${row.document_id}`}
                        className="sg-link"
                        data-testid={`history-view-${row.document_id}`}
                      >
                        View
                      </a>
                      <button
                        type="button"
                        className="sg-link"
                        data-testid={`history-visual-${row.document_id}`}
                        onClick={() => void openVisualModal(row.document_id)}
                      >
                        Visual
                      </button>
                      <a
                        href={`/chat?open=${row.document_id}`}
                        className="sg-link"
                        data-testid={`history-chat-${row.document_id}`}
                      >
                        Chat
                      </a>
                      <button
                        type="button"
                        className="sg-link"
                        onClick={() => void reanalyzeDocument(row.document_id)}
                        data-testid={`history-reanalyze-${row.document_id}`}
                      >
                        Re-analyse
                      </button>
                      <button
                        type="button"
                        className="sg-link"
                        onClick={() => {
                          if ((window as any).feedbackForm) {
                            (window as any).feedbackForm.show({
                              documentId: row.document_id
                            });
                          }
                        }}
                      >
                        Feedback
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="sg-pagination">
          <button
            type="button"
            className="sg-link"
            disabled={query.page <= 0}
            onClick={() =>
              setQuery((prev: any) => ({ ...prev, page: Math.max(0, prev.page - 1) }))
            }
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {query.page + 1} of {pageCount}
          </span>
          <button
            type="button"
            className="sg-link"
            disabled={query.page + 1 >= pageCount}
            onClick={() =>
              setQuery((prev: any) => ({
                ...prev,
                page: Math.min(pageCount - 1, prev.page + 1)
              }))
            }
          >
            Next
          </button>
        </div>
      </div>

      {confirmMode && (
        <div className="sg-modal" data-testid="history-confirm-modal">
          <div className="sg-modal__content">
            <h3 className="sg-display">Confirm Reset</h3>
            <p className="sg-helper">
              {confirmMode === 'selected'
                ? 'Reset selected documents to original values?'
                : 'Reset all documents to original values?'}
            </p>
            <div className="sg-modal__actions">
              <button
                type="button"
                className="sg-link"
                onClick={() => setConfirmMode(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sg-danger"
                onClick={() =>
                  confirmMode === 'selected' ? void resetSelected() : void resetAll()
                }
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {visualDocId && (
        <div className="sg-modal" data-testid="history-visual-modal">
          <div className="sg-modal__content sg-modal__content--wide">
            <div className="sg-modal__header">
              <h3 className="sg-display">Document Visual Preview</h3>
              <button type="button" className="sg-link" onClick={closeVisualModal}>
                Close
              </button>
            </div>
            <OverlayViewerIsland
              documentId={visualDocId}
              page={1}
              originalUrl={visualOriginalUrl || undefined}
              pageCount={visualPageCount}
              overlayMode="document"
              showLegend={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
