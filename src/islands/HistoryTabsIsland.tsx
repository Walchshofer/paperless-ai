import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { HistoryTabsContract } from '../ui/contracts/HistoryTabs.contract';

/**
 * HistoryTabsIsland - Tabbed interface for document history view
 *
 * Features:
 * - Text Tab: Display document text content
 * - Metadata Tab: Display PostgreSQL metadata with filter actions
 * - Similar Tab: Alpha-9 visual search with MaxSim results
 *
 * Architecture Reference: ticket:008.2, ticket:008.3
 */

interface SimilarResult {
  docId: number;
  pageNum?: number;
  score: number;
  thumbnailUrl?: string;
}

interface MetadataInfo {
  correspondent?: string;
  correspondentId?: number;
  tags?: Array<{ id: number; name: string }>;
  documentType?: string;
  created?: string;
  modified?: string;
}

interface ActiveFilters {
  correspondentId?: number;
  tagIds?: number[];
}

type TabId = 'text' | 'metadata' | 'similar';

interface HistoryTabsProps extends Partial<HistoryTabsContract> {
  metadata?: MetadataInfo;
}

export default function HistoryTabsIsland(props: HistoryTabsProps) {
  const { documentId, content, metadata } = props;

  const [activeTab, setActiveTab] = useState<TabId>('text');
  const [isSearching, setIsSearching] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStage, setInitStage] = useState<string>('');
  const [similarResults, setSimilarResults] = useState<SimilarResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tabs: TabId[] = ['text', 'metadata', 'similar'];
    const currentIndex = tabs.indexOf(activeTab);

    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]);
    }
  }, [activeTab]);

  // Listen for visual search events
  useEffect(() => {
    const handleVisualSearchRequest = async (event: CustomEvent) => {
      const { imageBase64, collection = 'visual_pages' } = event.detail || {};
      if (imageBase64 && documentId) {
        await performVisualSearch(imageBase64, collection);
      }
    };

    window.addEventListener(
      'visual-search-requested',
      handleVisualSearchRequest as EventListener
    );

    return () => {
      window.removeEventListener(
        'visual-search-requested',
        handleVisualSearchRequest as EventListener
      );
    };
  }, [documentId, activeFilters]);

  /**
   * Perform Alpha-9 visual search with current filters
   */
  const performVisualSearch = async (
    imageBase64: string,
    collection: string = 'visual_pages'
  ) => {
    setIsSearching(true);
    setSearchError(null);
    setIsInitializing(false);

    try {
      const filters: Record<string, unknown> = {};
      if (activeFilters.correspondentId) {
        filters.correspondent_id = activeFilters.correspondentId;
      }
      if (activeFilters.tagIds && activeFilters.tagIds.length > 0) {
        filters.tag_ids = activeFilters.tagIds;
      }

      const response = await fetch('/api/visual-rag/search/visual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': `history-${documentId}-${Date.now()}`
        },
        body: JSON.stringify({
          image: imageBase64,
          collection,
          k: 5,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        })
      });

      if (response.status === 503) {
        const data = await response.json();
        if (data.type === 'SIDECAR_INITIALIZING') {
          setIsInitializing(true);
          setInitStage(data.detail || 'GPU Initializing...');
          return;
        }
        throw new Error(data.error || 'Service unavailable');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      const results: SimilarResult[] = (data.results || []).map(
        (r: { docId: number; pageNum?: number; score: number; thumbnailUrl?: string }) => ({
          docId: r.docId,
          pageNum: r.pageNum,
          score: r.score,
          thumbnailUrl: r.thumbnailUrl
        })
      );

      setSimilarResults(results);
      setActiveTab('similar');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Add correspondent filter
   */
  const handleFilterByCorrespondent = (correspondentId: number) => {
    setActiveFilters((prev) => ({
      ...prev,
      correspondentId
    }));
  };

  /**
   * Add tag filter
   */
  const handleFilterByTag = (tagId: number) => {
    setActiveFilters((prev) => ({
      ...prev,
      tagIds: [...(prev.tagIds || []), tagId].filter(
        (id, idx, arr) => arr.indexOf(id) === idx
      )
    }));
  };

  /**
   * Remove a specific filter
   */
  const removeFilter = (type: 'correspondent' | 'tag', id?: number) => {
    if (type === 'correspondent') {
      setActiveFilters((prev) => {
        const { correspondentId, ...rest } = prev;
        return rest;
      });
    } else if (type === 'tag' && id !== undefined) {
      setActiveFilters((prev) => ({
        ...prev,
        tagIds: (prev.tagIds || []).filter((t) => t !== id)
      }));
    }
  };

  /**
   * Clear all filters
   */
  const clearAllFilters = () => {
    setActiveFilters({});
  };

  // Tab button component
  const TabButton = ({
    id,
    label,
    icon
  }: {
    id: TabId;
    label: string;
    icon: string;
  }) => (
    <button
      role="tab"
      aria-selected={activeTab === id}
      aria-controls={`panel-${id}`}
      data-testid={`tab-${id}`}
      onClick={() => setActiveTab(id)}
      onKeyDown={handleKeyDown}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      <i className={`${icon} mr-1`}></i>
      {label}
    </button>
  );

  // Filter badge component
  const FilterBadge = ({
    label,
    onRemove
  }: {
    label: string;
    onRemove: () => void;
  }) => (
    <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mr-1 mb-1">
      {label}
      <button
        onClick={onRemove}
        className="ml-1 text-blue-600 hover:text-blue-800"
        aria-label={`Remove filter: ${label}`}
      >
        <i className="fas fa-times"></i>
      </button>
    </span>
  );

  return (
    <div data-testid="history-tabs-root" className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Document tabs"
        className="flex border-b border-gray-200"
      >
        <TabButton id="text" label="Text" icon="fas fa-file-alt" />
        <TabButton id="metadata" label="Metadata" icon="fas fa-tags" />
        <TabButton id="similar" label="Similar" icon="fas fa-search" />
      </div>

      {/* Active Filters Display */}
      {(activeFilters.correspondentId ||
        (activeFilters.tagIds && activeFilters.tagIds.length > 0)) && (
        <div className="p-2 bg-gray-50 border-b flex flex-wrap items-center">
          <span className="text-xs text-gray-500 mr-2">Active filters:</span>
          {activeFilters.correspondentId && (
            <FilterBadge
              label={`Correspondent: ${metadata?.correspondent || activeFilters.correspondentId}`}
              onRemove={() => removeFilter('correspondent')}
            />
          )}
          {activeFilters.tagIds?.map((tagId) => {
            const tag = metadata?.tags?.find((t) => t.id === tagId);
            return (
              <FilterBadge
                key={tagId}
                label={`Tag: ${tag?.name || tagId}`}
                onRemove={() => removeFilter('tag', tagId)}
              />
            );
          })}
          <button
            onClick={clearAllFilters}
            className="text-xs text-red-600 hover:text-red-800 ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Tab Panels */}
      <div className="flex-1 overflow-auto p-4">
        {/* Text Tab */}
        {activeTab === 'text' && (
          <div
            role="tabpanel"
            id="panel-text"
            aria-labelledby="tab-text"
            data-testid="panel-text"
          >
            <div className="prose prose-sm max-w-none">
              {content ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {content}
                </pre>
              ) : (
                <p className="text-gray-500 italic">
                  No text content available
                </p>
              )}
            </div>
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div
            role="tabpanel"
            id="panel-metadata"
            aria-labelledby="tab-metadata"
            data-testid="panel-metadata"
          >
            <dl className="space-y-3">
              {metadata?.correspondent && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-gray-500">
                    Correspondent
                  </dt>
                  <dd className="text-sm text-gray-900 flex items-center">
                    {metadata.correspondent}
                    {metadata.correspondentId && (
                      <button
                        onClick={() =>
                          handleFilterByCorrespondent(metadata.correspondentId!)
                        }
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                        title="Filter Similar by this correspondent"
                      >
                        <i className="fas fa-filter"></i>
                      </button>
                    )}
                  </dd>
                </div>
              )}

              {metadata?.tags && metadata.tags.length > 0 && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">
                    Tags
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {metadata.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 rounded"
                      >
                        {tag.name}
                        <button
                          onClick={() => handleFilterByTag(tag.id)}
                          className="ml-1 text-gray-400 hover:text-blue-600"
                          title="Filter Similar by this tag"
                        >
                          <i className="fas fa-filter text-xs"></i>
                        </button>
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              {metadata?.documentType && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">
                    Document Type
                  </dt>
                  <dd className="text-sm text-gray-900">
                    {metadata.documentType}
                  </dd>
                </div>
              )}

              {metadata?.created && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">{metadata.created}</dd>
                </div>
              )}

              {metadata?.modified && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">
                    Modified
                  </dt>
                  <dd className="text-sm text-gray-900">{metadata.modified}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Similar Tab */}
        {activeTab === 'similar' && (
          <div
            role="tabpanel"
            id="panel-similar"
            aria-labelledby="tab-similar"
            data-testid="panel-similar"
          >
            {/* GPU Initializing State */}
            {isInitializing && (
              <div
                className="flex flex-col items-center justify-center py-8"
                data-testid="gpu-initializing"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600">GPU Initializing...</p>
                <p className="text-xs text-gray-400 mt-1">{initStage}</p>
                <p className="text-xs text-gray-400">
                  RTX 3090 Ti loading ColQwen3-4B-AWQ
                </p>
              </div>
            )}

            {/* Searching State */}
            {isSearching && !isInitializing && (
              <div
                className="flex flex-col items-center justify-center py-8"
                data-testid="searching"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600">Searching...</p>
              </div>
            )}

            {/* Error State */}
            {searchError && !isSearching && (
              <div
                className="bg-red-50 border border-red-200 rounded p-4"
                data-testid="search-error"
              >
                <p className="text-sm text-red-700">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {searchError}
                </p>
              </div>
            )}

            {/* Results */}
            {!isSearching &&
              !isInitializing &&
              !searchError &&
              similarResults.length > 0 && (
                <div data-testid="similar-results">
                  <p className="text-sm text-gray-500 mb-3">
                    Found {similarResults.length} similar documents
                  </p>
                  <div className="space-y-3">
                    {similarResults.map((result, idx) => (
                      <div
                        key={`${result.docId}-${idx}`}
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {result.thumbnailUrl && (
                          <img
                            src={result.thumbnailUrl}
                            alt={`Document ${result.docId} thumbnail`}
                            className="w-16 h-20 object-cover rounded mr-3 border"
                          />
                        )}
                        <div className="flex-1">
                          <a
                            href={`/history/${result.docId}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Document #{result.docId}
                          </a>
                          {result.pageNum && (
                            <span className="text-xs text-gray-500 ml-2">
                              Page {result.pageNum}
                            </span>
                          )}
                          <div className="mt-1">
                            <span className="text-xs text-gray-500">
                              Similarity:
                            </span>
                            <span className="ml-1 text-sm font-medium text-green-600">
                              {(result.score * 100).toFixed(1)}%
                            </span>
                            <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${result.score * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Empty State */}
            {!isSearching &&
              !isInitializing &&
              !searchError &&
              similarResults.length === 0 && (
                <div
                  className="text-center py-8"
                  data-testid="similar-empty"
                >
                  <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                  <p className="text-sm text-gray-500">
                    Select a region in the document viewer to find similar
                    documents
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Results use MaxSim scoring from ColQwen3-4B-AWQ
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
