import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { TagsManagerSchema, type TagsManagerContract, type Tag } from '../ui/contracts/TagsManager.contract';

function dispatchEventSafe(name: string, detail: any) {
  if (typeof document === 'undefined') return;
  if (typeof document.dispatchEvent !== 'function') return;
  const EventConstructor = (typeof window !== 'undefined' && window.CustomEvent) ? window.CustomEvent : CustomEvent;
  document.dispatchEvent(new EventConstructor(name, { detail }));
}

export default function TagsManagerIsland(props: Partial<TagsManagerContract>) {
  const [currentTags, setCurrentTags] = useState<Tag[]>(props.currentTags || []);
  const [suggestedTags, setSuggestedTags] = useState<Tag[]>(props.suggestedTags || []);
  const [availableTags, setAvailableTags] = useState<Tag[]>(props.availableTags || []);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

  // Listen for AI analysis completion to receive tag suggestions
  useEffect(() => {
    const onSuggestionsReceived = (e: any) => {
      const detail = e?.detail || {};
      if (detail.suggestedTags) {
        setSuggestedTags(detail.suggestedTags);
      }
    };

    const onAnalysisCompleted = (e: any) => {
      const detail = e?.detail || {};
      if (detail.result?.tags) {
        // Convert string tags to Tag objects
        const tagObjects = detail.result.tags.map((tagName: string, idx: number) => {
          // Try to find existing tag by name
          const existing = availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          return existing || { id: -1 - idx, name: tagName };
        });
        setSuggestedTags(tagObjects);
      }
    };

    window.addEventListener('tags:suggestions-received', onSuggestionsReceived as EventListener);
    window.addEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
    
    return () => {
      window.removeEventListener('tags:suggestions-received', onSuggestionsReceived as EventListener);
      window.removeEventListener('ai:analysis-completed', onAnalysisCompleted as EventListener);
    };
  }, [availableTags]);

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
    if (!currentTags.find(t => t.id === tag.id || t.name === tag.name)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      
      dispatchEventSafe('tags:updated', {
        type: 'tags:updated',
        documentId: props.documentId ?? null,
        currentTags: newCurrentTags.map(t => t.id),
        action: 'accept-suggestion',
      });
    }
    
    // Remove from suggestions
    setSuggestedTags(prev => prev.filter(t => t.id !== tag.id && t.name !== tag.name));
  }, [currentTags, props.documentId]);

  const handleDismissSuggestion = useCallback((tag: Tag) => {
    setSuggestedTags(prev => prev.filter(t => t.id !== tag.id && t.name !== tag.name));
  }, []);

  const handleRemoveTag = useCallback((tag: Tag) => {
    const newCurrentTags = currentTags.filter(t => t.id !== tag.id);
    setCurrentTags(newCurrentTags);
    
    dispatchEventSafe('tags:updated', {
      type: 'tags:updated',
      documentId: props.documentId ?? null,
      currentTags: newCurrentTags.map(t => t.id),
      action: 'remove',
    });
  }, [currentTags, props.documentId]);

  const handleAddTag = useCallback(() => {
    if (!selectedTagId) return;
    
    const tag = availableTags.find(t => t.id === parseInt(selectedTagId));
    if (!tag) return;
    
    if (!currentTags.find(t => t.id === tag.id)) {
      const newCurrentTags = [...currentTags, tag];
      setCurrentTags(newCurrentTags);
      
      dispatchEventSafe('tags:updated', {
        type: 'tags:updated',
        documentId: props.documentId ?? null,
        currentTags: newCurrentTags.map(t => t.id),
        action: 'add',
      });
    }
    
    setSelectedTagId('');
  }, [selectedTagId, availableTags, currentTags, props.documentId]);

  const handleSaveTags = useCallback(async () => {
    if (!props.documentId) return;
    
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      const tagIds = currentTags.map(t => t.id).filter(id => id > 0);
      
      const res = await fetch('/manual/updateDocument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: props.documentId,
          tags: tagIds,
        }),
      });
      
      if (res.ok) {
        setSaveStatus('success');
        dispatchEventSafe('tags:updated', {
          type: 'tags:updated',
          documentId: props.documentId,
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
  }, [currentTags, props.documentId]);

  // Filter available tags to exclude current ones
  const selectableTags = availableTags.filter(
    at => !currentTags.find(ct => ct.id === at.id)
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
            suggestedTags.map((tag, idx) => (
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
            disabled={isSaving || !props.documentId}
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
            currentTags.map((tag, idx) => (
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
            onChange={(e: any) => setSelectedTagId(e.target.value)}
            data-testid="new-tag-select"
          >
            <option value="">Select a tag...</option>
            {selectableTags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="tm-add-btn"
            onClick={handleAddTag}
            disabled={!selectedTagId}
            data-testid="add-tag-btn"
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
