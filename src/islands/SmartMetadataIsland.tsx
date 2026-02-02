import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { SmartMetadataSchema, SmartMetadataContract, SmartField, SmartTag } from '../ui/contracts/SmartMetadata.contract';

// Strongly-typed global helpers used by tests/debug hooks
declare global {
  interface Window {
    __smart_metadata_mounted?: boolean;
    __smart_metadata_dirty?: boolean;
  }
}

type DocumentId = number | null;
interface WorkspaceDirtyDetail { documentId: DocumentId }
interface FeedbackVoteDetail { fieldId: string | number; vote: 'up' | 'down' }
interface MetadataLocateDetail { fieldId: string | number }

function dispatchEventSafe(name: string, detail?: unknown): void {
  try {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
    }
  } catch (e) {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(name, { detail } as CustomEventInit<unknown>));
    }
  } catch (e) {
    // ignore
  }
}

export default function SmartMetadataIsland(props: Partial<SmartMetadataContract & { documentId?: DocumentId; saveDelayMs?: number }>) {
  const initial = props || {};
  const fields: SmartField[] = Array.isArray(initial.customFields) ? initial.customFields : [];
  const initialTags: SmartTag[] = Array.isArray(initial.selectedTags) ? initial.selectedTags : [];
  const availableTags: SmartTag[] = Array.isArray(initial.availableTags) ? initial.availableTags : [];

  const [localMetadata, setLocalMetadata] = useState(() => ({
    title: initial.metadata?.title || '',
    correspondent: initial.metadata?.correspondent || '',
    createdDate: initial.metadata?.createdDate || '',
  }) as { title: string; correspondent: string; createdDate: string });

  const [localFields, setLocalFields] = useState(() => fields.map((f: SmartField) => ({ ...f })) as SmartField[]);
  const [localTags, setLocalTags] = useState(() => initialTags.map((t: SmartTag) => ({ ...t })) as SmartTag[]);
  const [validationError, setValidationError] = useState(null as string | null);

  useEffect(() => {
    try { window.__smart_metadata_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  const onLocate = (fieldId: string | number): void => {
    dispatchEventSafe('metadata:locate-field', { fieldId } as MetadataLocateDetail);
  };

  const onFeedback = (fieldId: string | number, vote: 'up' | 'down'): void => {
    dispatchEventSafe('feedback:vote', { fieldId, vote } as FeedbackVoteDetail);
  };

  const markDirty = (): void => {
    try { window.__smart_metadata_dirty = true; } catch (e) { /* ignore */ }
    dispatchEventSafe('workspace:dirty', { documentId: props.documentId ?? null } as WorkspaceDirtyDetail);
  };

  const validateAndMarkDirty = (meta: { title: string; correspondent: string; createdDate: string }, fields: SmartField[], tags: SmartTag[]) => {
    const payload = { documentId: props.documentId ?? null, metadata: meta, customFields: fields, selectedTags: tags };
    const res = SmartMetadataSchema.safeParse(payload);
    if (!res.success) {
      // expose first issue message
      const msg = res.error?.issues?.[0]?.message || 'Validation failed';
      setValidationError(msg);
      return false;
    }

    setValidationError(null);
    markDirty();
    return true;
  };

  const onMetaChange = (key: 'title' | 'correspondent' | 'createdDate', val: string) => {
    // compute next state synchronously for validation
    const next = { ...localMetadata, [key]: val };
    setLocalMetadata(next);
    validateAndMarkDirty(next, localFields, localTags);
  };

  const handleAddTag = (tagId: number): void => {
    const tagToAdd = availableTags.find((t: SmartTag) => t.id === tagId);
    if (!tagToAdd || localTags.some((t: SmartTag) => t.id === tagId)) return;
    const nextTags = [...localTags, tagToAdd];
    setLocalTags(nextTags);
    validateAndMarkDirty(localMetadata, localFields, nextTags);
    dispatchEventSafe('tags:updated', { documentId: props.documentId ?? null, tags: nextTags });
  };

  const handleRemoveTag = (tagId: number): void => {
    const nextTags = localTags.filter((t: SmartTag) => t.id !== tagId);
    setLocalTags(nextTags);
    validateAndMarkDirty(localMetadata, localFields, nextTags);
    dispatchEventSafe('tags:updated', { documentId: props.documentId ?? null, tags: nextTags });
  };

  const onFieldValueChange = (idx: number, val: string) => {
    const nextFields = localFields.map((f: SmartField, i: number) => (i === idx ? { ...f, value: val } : f));
    setLocalFields(nextFields);
    validateAndMarkDirty(localMetadata, nextFields, localTags);
  };

  // Listen for metadata refresh events from reprocessing
  useEffect(() => {
    interface MetadataRefreshDetail {
      documentId?: DocumentId;
      fields?: SmartField[];
      tags?: SmartTag[];
      classification?: string;
    }

    const handleMetadataRefresh = (e: Event) => {
      const detail = (e as CustomEvent<MetadataRefreshDetail>)?.detail || {};
      const { documentId, fields: newFields, tags: newTags } = detail;

      // Only handle if this metadata instance is for the same document
      if (String(documentId) !== String(props.documentId)) return;

      // Update local fields with AI-extracted data
      if (Array.isArray(newFields) && newFields.length > 0) {
        const updatedFields = newFields.map((f: SmartField) => ({
          ...f,
          isAiGenerated: true,
          confidence: f.confidence || 0.5
        }));
        setLocalFields(updatedFields);
      }

      // Update tags
      if (Array.isArray(newTags) && newTags.length > 0) {
        // Merge new tags with existing ones, avoiding duplicates
        setLocalTags((prevTags: SmartTag[]) => {
          const existingIds = new Set(prevTags.map((t: SmartTag) => t.id));
          const tagsToAdd = newTags.filter((t: SmartTag) => !existingIds.has(t.id));
          return [...prevTags, ...tagsToAdd];
        });
      }

      // Mark as dirty to prompt save
      markDirty();
    };

    window.addEventListener('metadata:refresh', handleMetadataRefresh as EventListener);
    return () => window.removeEventListener('metadata:refresh', handleMetadataRefresh as EventListener);
  }, [props.documentId]);

  // Participant wiring: acknowledge save requests and attempt to save if dirty
  useEffect(() => {
    type SaveRequestDetail = { saveId?: string; documentId?: number | null };

    function onSaveRequest(e: Event) {
      const detail = (e as CustomEvent<SaveRequestDetail>)?.detail || {};
      const { saveId, documentId } = detail;
      if (String(documentId) !== String(props.documentId)) return;
      const participantId = 'smart-metadata';
      const willSave = Boolean(window.__smart_metadata_dirty);

      // Send ack
      dispatchEventSafe('workspace:save-ack', { saveId, participantId, willSave });
      if (!willSave) return;

      const delay = props.saveDelayMs ?? 100;
      setTimeout(() => {
        // Perform a local 'save' - check validation state before reporting success
        const success = validationError === null;
        if (success) {
          try { window.__smart_metadata_dirty = false; } catch (err) { /* ignore */ }
          dispatchEventSafe('workspace:save-partial-complete', { saveId, participantId, success: true });
        } else {
          dispatchEventSafe('workspace:save-partial-complete', { saveId, participantId, success: false, message: validationError || 'validation failed' });
        }
      }, delay);
    }

    window.addEventListener('workspace:save-request', onSaveRequest as EventListener);
    return () => window.removeEventListener('workspace:save-request', onSaveRequest as EventListener);
  }, [props.documentId, props.saveDelayMs, validationError]);

  return (
    <div data-testid="smart-metadata-root" className="flex flex-col gap-3">
      {/* Validation error display */}
      {validationError && (
        <div
          data-testid="validation-error"
          className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
          role="alert"
        >
          <i className="fas fa-exclamation-circle text-red-500"></i>
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="smart-title-input" className="text-xs text-[#666]">Title</label>
        <input
          id="smart-title-input"
          title="Document title"
          placeholder="Enter document title"
          data-testid="smart-title-input"
          className="w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm"
          value={localMetadata.title}
          onInput={(e: Event) => onMetaChange('title', (e.target as HTMLInputElement).value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="smart-correspondent-input" className="text-xs text-[#666]">Correspondent</label>
        <input
          id="smart-correspondent-input"
          title="Correspondent name"
          placeholder="Enter correspondent name"
          data-testid="smart-correspondent-input"
          className="w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm"
          value={localMetadata.correspondent}
          onInput={(e: Event) => onMetaChange('correspondent', (e.target as HTMLInputElement).value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="smart-date-input" className="text-xs text-[#666]">Created Date</label>
        <input
          id="smart-date-input"
          type="date"
          title="Document created date"
          data-testid="smart-date-input"
          className="w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm"
          value={localMetadata.createdDate}
          onInput={(e: Event) => onMetaChange('createdDate', (e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Tags multi-select */}
      <div className="flex flex-col gap-2" data-testid="tags-container">
        <label className="text-xs text-[#666]">Tags</label>
        <div className="flex flex-wrap gap-1 min-h-[32px]">
          {localTags.length === 0 && (
            <span className="text-xs text-[#888]">No tags selected</span>
          )}
          {localTags.map((tag: SmartTag) => (
            <span
              key={tag.id}
              data-testid={`tag-chip-${tag.id}`}
              className="tag-chip inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
              style={tag.color ? { '--tag-color': tag.color } : undefined}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:text-red-600"
                title={`Remove ${tag.name}`}
              >
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </span>
          ))}
        </div>
        {availableTags.filter((t: SmartTag) => !localTags.some((lt: SmartTag) => lt.id === t.id)).length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="add-tag-select" className="sr-only">Add a tag</label>
            <select
              id="add-tag-select"
              data-testid="add-tag-select"
              className="w-full border border-[#e5e0d8] rounded-md px-3 py-2 text-sm"
              onChange={(e: Event) => {
                const val = parseInt((e.target as HTMLSelectElement).value, 10);
                if (!isNaN(val)) {
                  handleAddTag(val);
                  (e.target as HTMLSelectElement).value = '';
                }
              }}
              value=""
            >
              <option value="">Add a tag...</option>
            {availableTags
              .filter((t: SmartTag) => !localTags.some((lt: SmartTag) => lt.id === t.id))
              .map((t: SmartTag) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-sm font-medium mb-2">Custom Fields</div>
        {localFields.length === 0 && <div data-testid="no-custom-fields" className="text-xs text-[#888]">No custom fields</div>}

        {localFields.map((f: SmartField, idx: number) => (
          <div key={String(f.id)} className="flex items-center gap-2 mb-2 border border-[#f2efe9] rounded-md p-2" data-testid={`custom-field-${f.id}`}>
            <div className="flex-1">
              <div className="text-xs text-[#444] font-medium">{f.label || `Field ${idx + 1}`}</div>
              <input
                id={`custom-field-value-${f.id}`}
                title={`Value for ${f.label || `field ${idx + 1}`}`}
                placeholder="Enter value"
                data-testid={`custom-field-value-${f.id}`}
                className="w-full border border-[#eae6df] rounded px-2 py-1 text-sm"
                value={f.value ?? ''}
                onInput={(e: Event) => onFieldValueChange(idx, (e.target as HTMLInputElement).value)}
              />
            </div>

            <div className="flex flex-col gap-1 items-end">
              <button
                data-testid={`locate-btn-${f.id}`}
                className="px-2 py-1 text-xs rounded bg-[#f6efe8] border border-[#e5e0d8]"
                title="Locate field on document"
                onClick={() => onLocate(f.id)}
              >
                <i className="fas fa-crosshairs mr-1"></i>
                Locate
              </button>

              <div className="flex gap-1">
                <button
                  data-testid={`feedback-up-${f.id}`}
                  className="px-2 py-1 rounded bg-white border border-[#eae6df] text-sm"
                  onClick={() => onFeedback(f.id, 'up')}
                  title="Thumbs up"
                >
                  <i className="fas fa-thumbs-up"></i>
                </button>
                <button
                  data-testid={`feedback-down-${f.id}`}
                  className="px-2 py-1 rounded bg-white border border-[#eae6df] text-sm"
                  onClick={() => onFeedback(f.id, 'down')}
                  title="Thumbs down"
                >
                  <i className="fas fa-thumbs-down"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
