import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { SmartMetadataSchema, SmartMetadataContract, SmartField } from '../ui/contracts/SmartMetadata.contract';

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

export default function SmartMetadataIsland(props: Partial<SmartMetadataContract & { documentId?: DocumentId }>) {
  const initial = props || {};
  const fields: SmartField[] = Array.isArray(initial.customFields) ? initial.customFields : [];

  const [localMetadata, setLocalMetadata] = useState(() => ({
    title: initial.metadata?.title || '',
    correspondent: initial.metadata?.correspondent || '',
  }) as { title: string; correspondent: string });

  const [localFields, setLocalFields] = useState(() => fields.map((f: SmartField) => ({ ...f })) as SmartField[]);
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

  const validateAndMarkDirty = (meta: { title: string; correspondent: string }, fields: SmartField[]) => {
    const payload = { documentId: props.documentId ?? null, metadata: meta, customFields: fields };
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

  const onMetaChange = (key: 'title' | 'correspondent', val: string) => {
    // compute next state synchronously for validation
    const next = { ...localMetadata, [key]: val };
    setLocalMetadata(next);
    validateAndMarkDirty(next, localFields);
  };

  const onFieldValueChange = (idx: number, val: string) => {
    const nextFields = localFields.map((f: SmartField, i: number) => (i === idx ? { ...f, value: val } : f));
    setLocalFields(nextFields);
    validateAndMarkDirty(localMetadata, nextFields);
  };

  return (
    <div data-testid="smart-metadata-root" className="flex flex-col gap-3">
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
