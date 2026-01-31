import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { TagsManagerSchema, type TagsManagerContract, type Tag } from '../ui/contracts/TagsManager.contract';

function dispatchEventSafe(name: string, detail?: unknown) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  const EventConstructor = (typeof window !== 'undefined' && window.CustomEvent) ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail } as CustomEventInit<any>));
}

export default function TagsManagerIsland(props: Partial<TagsManagerContract>) {
  // Validate props at runtime
  const validated = TagsManagerSchema.parse(props);
  const [currentTags, setCurrentTags] = useState(props.currentTags || [] as Tag[]);
  const [suggestedTags, setSuggestedTags] = useState(props.suggestedTags || [] as Tag[]);
  const [availableTags, setAvailableTags] = useState(props.availableTags || [] as Tag[]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle' as 'idle' | 'success' | 'error');
  const [documentId, setDocumentId] = useState(props.documentId ?? null as number | null);

  const resolveTags = useCallback((tags: Array<Tag | string | number>) => {
    if (!Array.isArray(tags)) return [];
    return tags.map((tag, idx) => {
      if (typeof tag === 'object' && tag !== null && 'name' in tag) {
        return tag as Tag;
      }
      const tagName = String(tag);
      const match = availableTags.find(
        (t: Tag) => t.name.toLowerCase() === tagName.toLowerCase()
      );
      return match || { id: -1 - idx, name: tagName };
    });
  }, [availableTags]);

  // Fetch available tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/manual/tags');
        if (res.ok) {
          const tags = await res.json();
          setAvailableTags(tags);
        }
      } catch (err) {
        console.warn('Failed to fetch tags:', err);
      }
    };

    if (availableTags.length === 0) {
      fetchTags();
    }
  }, []);

  // Reconcile current/suggested tags when the available tags list changes
  useEffect(() => {
    if (availableTags.length === 0) return;
    setCurrentTags((prev: Array<Tag | string | number>) => resolveTags(prev));
    setSuggestedTags((prev: Array<Tag | string | number>) => resolveTags(prev));
  }, [availableTags, resolveTags]);

  // Listen for AI analysis completion to receive tag suggestions
  useEffect(() => {
    const onSuggestionsReceived = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.suggestedTags) {
        setSuggestedTags(resolveTags(detail.suggestedTags));
      }
    };

    const onAnalysisCompleted = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.result?.tags) {
        setSuggestedTags(resolveTags(detail.result.tags));
      }
    };

    window.addEventListener('tags:suggestions-received', onSuggestionsReceived as EventListener);
    window.addEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
    
    return () => {
      window.removeEventListener('tags:suggestions-received', onSuggestionsReceived as EventListener);
      window.removeEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
    };
  }, [resolveTags]);

  // Listen for document selection to hydrate current tags
  useEffect(() => {
    const onDocumentSelected = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.documentId !== undefined) {
        setDocumentId(detail.documentId ?? null);
      }
      if (detail.tags) {
        setCurrentTags(resolveTags(detail.tags));
      } else if (detail.documentId === null || detail.documentId === undefined) {
        setCurrentTags([]);
      }
      setSuggestedTags([]);
      setSaveStatus('idle');
    };

    window.addEventListener('document:selected', onDocumentSelected as EventListener);
    return () => {
      window.removeEventListener('document:selected', onDocumentSelected as EventListener);
    };
  }, [resolveTags]);

  // Test-only marker
  useEffect(() => {
    try { (window as any).__tags_manager_island_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  // Clear save status after delay
  useEffect(() => {
    if (saveStatus !== 'idle') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleAcceptSuggestion = useCallback((tag: Tag) => {
    // Add to current tags if not already present
    if (!currentTags.find((t: Tag) => t.id === tag.id || t.name === tag.name)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      
      dispatchEventSafe('tags:updated', {
        type: 'tags:updated',
        documentId,
        currentTags: newCurrentTags.map((t: Tag) => t.id),
        action: 'accept-suggestion',
      });
    }
    
    // Remove from suggestions
    setSuggestedTags((prev: Tag[]) => prev.filter((t: Tag) => t.id !== tag.id && t.name !== tag.name));
  }, [currentTags, props.documentId]);

  const handleDismissSuggestion = useCallback((tag: Tag) => {
    setSuggestedTags((prev: Tag[]) => prev.filter((t: Tag) => t.id !== tag.id && t.name !== tag.name));
  }, []);

  const handleRemoveTag = useCallback((tag: Tag) => {
    const newCurrentTags = currentTags.filter((t: Tag) => t.id !== tag.id);
    setCurrentTags(newCurrentTags);
    
    dispatchEventSafe('tags:updated', {
      type: 'tags:updated',
      documentId,
      currentTags: newCurrentTags.map((t: Tag) => t.id),
      action: 'remove',
    });
  }, [currentTags, documentId]);

  const handleAddTag = useCallback(() => {
    if (!selectedTagId) return;
    
    const tag = availableTags.find((t: Tag) => t.id === parseInt(selectedTagId));
    if (!tag) return;
    
    if (!currentTags.find((t: Tag) => t.id === tag.id)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      
      dispatchEventSafe('tags:updated', {
        type: 'tags:updated',
        documentId,
        currentTags: newCurrentTags.map(t => t.id),
        action: 'add',
      });
    }
    
    setSelectedTagId('');
  }, [selectedTagId, availableTags, currentTags, documentId]);

  const handleSaveTags = useCallback(async () => {
    if (!documentId) return;
    
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      const tagIds = currentTags.map((t: Tag) => t.id).filter((id: number) => id > 0);
      
      const res = await fetch('/manual/updateDocument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          tags: tagIds,
        }),
      });
      
      if (res.ok) {
        setSaveStatus('success');
        dispatchEventSafe('tags:updated', {
          type: 'tags:updated',
          documentId,
          currentTags: tagIds,
          action: 'save',
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Failed to save tags:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [currentTags, documentId]);

  // Filter available tags to exclude current ones
  const selectableTags = availableTags.filter(
    (at: Tag) => !currentTags.find((ct: Tag) => ct.id === at.id)
  );

  return (
    <div data-testid="tags-manager-root" data-hydrated="true" className="tm-root">
      {/* AI Suggestions Section */}
      <div className="tm-section">
        <h3 className="tm-section-title">AI Suggestions</h3>
        <div className="tm-tags-container" data-testid="suggested-tags-container">
          {suggestedTags.length === 0 ? (
            <span className="tm-empty">No suggestions yet</span>
          ) : (
            suggestedTags.map((tag: Tag, idx: number) => (
              <span
                key={tag.id || idx}
                className="tm-tag tm-tag-suggested"
                data-testid={`suggested-tag-${idx}`}
              >
                <span className="tm-tag-name">{tag.name}</span>
                <button
                  type="button"
                  className="tm-tag-btn tm-tag-accept"
                  onClick={() => handleAcceptSuggestion(tag)}
                  aria-label={`Accept tag ${tag.name}`}
                  data-testid={`accept-tag-${idx}`}
                >
                  <i className="fas fa-plus" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  className="tm-tag-btn tm-tag-dismiss"
                  onClick={() => handleDismissSuggestion(tag)}
                  aria-label={`Dismiss tag ${tag.name}`}
                  data-testid={`dismiss-tag-${idx}`}
                >
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Current Tags Section */}
      <div className="tm-section">
        <div className="tm-section-header">
          <h3 className="tm-section-title">Current Tags</h3>
          <button
            type="button"
            className="tm-save-btn"
            onClick={handleSaveTags}
            disabled={isSaving || !documentId}
            data-testid="save-tags-btn"
          >
            {isSaving ? 'Saving...' : 'Save Tags'}
          </button>
        </div>
        {saveStatus === 'success' && (
          <div className="tm-status tm-status-success">Tags saved successfully</div>
        )}
        {saveStatus === 'error' && (
          <div className="tm-status tm-status-error">Failed to save tags</div>
        )}
        <div className="tm-tags-container" data-testid="current-tags-container">
          {currentTags.length === 0 ? (
            <span className="tm-empty">No tags assigned</span>
          ) : (
            currentTags.map((tag: Tag, idx: number) => (
              <span
                key={tag.id}
                className="tm-tag tm-tag-current"
                data-testid={`current-tag-${idx}`}
                data-tag-id={tag.id}
              >
                <span className="tm-tag-name">{tag.name}</span>
                <button
                  type="button"
                  className="tm-tag-btn tm-tag-remove"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag.name}`}
                  data-testid={`remove-tag-${idx}`}
                >
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Add New Tag Section */}
      <div className="tm-section">
        <h3 className="tm-section-title">Add New Tag</h3>
        <div className="tm-add-container">
          <select
            className="tm-select"
            value={selectedTagId}
            onChange={(e: Event) => setSelectedTagId((e.target as HTMLSelectElement).value)}
            data-testid="new-tag-select"
            aria-label="Select tag to add"
          >
            <option value="">Select a tag...</option>
            {selectableTags.map((tag: Tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="tm-add-btn"
            onClick={handleAddTag}
            disabled={!selectedTagId}
            data-testid="add-tag-btn"
            aria-label="Add selected tag"
          >
            <i className="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <style>{`
        .tm-root {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .tm-section {
          margin-bottom: 16px;
        }
        .tm-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .tm-section-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary, #666);
          margin: 0 0 8px;
        }
        .tm-section-header .tm-section-title {
          margin: 0;
        }
        .tm-tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 32px;
        }
        .tm-empty {
          color: var(--text-secondary, #999);
          font-size: 0.875rem;
          font-style: italic;
        }
        .tm-tag {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .tm-tag-suggested {
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent-primary, #3b82f6);
        }
        .tm-tag-current {
          background: rgba(107, 114, 128, 0.1);
          color: var(--text-primary, #374151);
        }
        .tm-tag-name {
          margin-right: 4px;
        }
        .tm-tag-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          font-size: 0.75rem;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .tm-tag-btn:hover {
          opacity: 1;
        }
        .tm-tag-accept {
          color: #10b981;
        }
        .tm-tag-dismiss, .tm-tag-remove {
          color: #ef4444;
        }
        .tm-add-container {
          display: flex;
          gap: 8px;
        }
        .tm-select {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--border-color, #ddd);
          border-radius: 4px;
          background: var(--bg-primary, white);
          color: var(--text-primary, #333);
          font-size: 0.875rem;
        }
        .tm-add-btn {
          padding: 8px 12px;
          background: var(--accent-primary, #3498db);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tm-add-btn:hover:not(:disabled) {
          background: var(--accent-secondary, #2980b9);
        }
        .tm-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tm-save-btn {
          padding: 4px 8px;
          font-size: 0.75rem;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .tm-save-btn:hover:not(:disabled) {
          background: #059669;
        }
        .tm-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .tm-status {
          padding: 8px;
          border-radius: 4px;
          font-size: 0.875rem;
          margin-bottom: 8px;
        }
        .tm-status-success {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .tm-status-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
