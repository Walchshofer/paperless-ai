import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  SmartMetadataSchema,
  SmartMetadataContract,
  SmartField,
  SmartTag
} from '../ui/contracts/SmartMetadata.contract';

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

type MatchType = 'exact' | 'fuzzy' | 'none';

const DOMAIN_FALLBACKS: Record<string, { icon: string; label: string; badge: string }> = {
  financial: {
    icon: '📋',
    label: 'Financial Document',
    badge: 'bg-[#fff1e6] border-[#f3c9a6] text-[#9a3412]'
  },
  medical: {
    icon: '🏥',
    label: 'Medical Document',
    badge: 'bg-[#ecfdf3] border-[#bbf7d0] text-[#166534]'
  },
  legal: {
    icon: '⚖️',
    label: 'Legal Document',
    badge: 'bg-[#f5f3ff] border-[#ddd6fe] text-[#5b21b6]'
  },
  general: {
    icon: '📄',
    label: 'General Document',
    badge: 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]'
  }
};

const MATCH_BADGES: Record<MatchType, string> = {
  exact: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  fuzzy: 'bg-amber-50 border-amber-200 text-amber-700',
  none: 'bg-red-50 border-red-200 text-red-700'
};

function createSafeCustomEvent(name: string, detail?: unknown): CustomEvent<unknown> | null {
  try {
    if (typeof window !== 'undefined' && window.CustomEvent) {
      return new window.CustomEvent(name, { detail } as CustomEventInit<unknown>);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof CustomEvent !== 'undefined') {
      return new CustomEvent(name, { detail } as CustomEventInit<unknown>);
    }
  } catch (e) { /* ignore */ }
  return null;
}

function dispatchEventSafe(name: string, detail?: unknown): void {
  const evt = createSafeCustomEvent(name, detail);
  if (!evt) return;
  try {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(evt);
    }
  } catch (e) {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(evt);
    }
  } catch (e) {
    // ignore
  }
}

function normalizeDomain(value?: string | null): string {
  if (!value) return 'general';
  const lowered = String(value).trim().toLowerCase();
  if (['financial', 'medical', 'legal', 'general'].includes(lowered)) return lowered;
  if (lowered.includes('finan') || lowered.includes('invoice') || lowered.includes('receipt')) return 'financial';
  if (lowered.includes('med') || lowered.includes('clinic') || lowered.includes('lab')) return 'medical';
  if (lowered.includes('legal') || lowered.includes('contract') || lowered.includes('agreement')) return 'legal';
  return 'general';
}

function normalizePaperlessKey(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const parts = raw.split(':');
  if (parts.length < 2) return raw.toLowerCase().replace(/\s+/g, '');
  const prefix = parts[0].trim().toLowerCase();
  const rest = parts.slice(1).join(':').trim().replace(/\s+/g, '');
  return `${prefix}:${rest}`;
}

function normalizeLabel(value?: string | null): string {
  if (!value) return '';
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stringifyValue(value?: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isEmptyValue(value?: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function toTestId(value: string | number): string {
  return String(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

function resolveDomainMeta(domain: string) {
  return DOMAIN_FALLBACKS[domain] || DOMAIN_FALLBACKS.general;
}

function resolveMatchLabel(matchType?: MatchType | null): string {
  if (matchType === 'exact') return 'Exact Match ✓';
  if (matchType === 'fuzzy') return 'Fuzzy Match ~';
  return 'No Match ✗';
}

export default function SmartMetadataIsland(props: Partial<SmartMetadataContract & { documentId?: DocumentId; saveDelayMs?: number }>) {
  const initial = props || {};

  const [currentDocumentId, setCurrentDocumentId] = useState(props.documentId ?? null);
  const [localMetadata, setLocalMetadata] = useState(() => ({
    title: initial.metadata?.title || '',
    correspondent: initial.metadata?.correspondent || '',
    createdDate: initial.metadata?.createdDate || ''
  }) as { title: string; correspondent: string; createdDate: string });

  const [localTags, setLocalTags] = useState(() => (
    Array.isArray(initial.selectedTags)
      ? initial.selectedTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));
  const [availableTagsState, setAvailableTagsState] = useState(() => (
    Array.isArray(initial.availableTags)
      ? initial.availableTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));
  const [validationError, setValidationError] = useState(null as string | null);
  const [validationErrors, setValidationErrors] = useState(() => new Map<string, string>());
  const [requiredFields, setRequiredFields] = useState([] as SmartField[]);
  const [optionalFields, setOptionalFields] = useState([] as SmartField[]);
  const [mappedVisualFields, setMappedVisualFields] = useState([] as SmartField[]);
  const [optionalExpanded, setOptionalExpanded] = useState(false);
  const [requiredMetadataKeys, setRequiredMetadataKeys] = useState([] as string[]);
  const [domainOverride, setDomainOverride] = useState(null as string | null);
  const [profileOverride, setProfileOverride] = useState(null as { displayName?: string; icon?: string } | null);

  const resolvedProfile = useMemo(() => {
    const profile = initial.fieldProfile || {};
    const domain = normalizeDomain(
      domainOverride ||
      initial.documentDomain ||
      profile.domain ||
      initial.metadata?.documentType ||
      initial.visualFields?.[0]?.domain ||
      'general'
    );
    const fallback = resolveDomainMeta(domain);
    return {
      domain,
      displayName: profileOverride?.displayName || profile.displayName || fallback.label,
      icon: profileOverride?.icon || profile.icon || fallback.icon,
      requiredFields: Array.isArray(profile.requiredFields) ? profile.requiredFields : [],
      optionalFields: Array.isArray(profile.optionalFields) ? profile.optionalFields : []
    };
  }, [
    domainOverride,
    profileOverride,
    initial.documentDomain,
    initial.fieldProfile,
    initial.metadata?.documentType,
    initial.visualFields
  ]);

  useEffect(() => {
    try { window.__smart_metadata_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  const markDirty = (): void => {
    try { window.__smart_metadata_dirty = true; } catch (e) { /* ignore */ }
    dispatchEventSafe('workspace:dirty', { documentId: currentDocumentId } as WorkspaceDirtyDetail);
  };

  const validateFieldValue = (field: SmartField, rawValue: unknown, isRequired: boolean): string | null => {
    if (isRequired && isEmptyValue(rawValue)) {
      return 'Required field is missing';
    }

    if (isEmptyValue(rawValue)) return null;

    const rules = field.validationRules || {};
    const fieldType = field.type || 'string';
    const value = rawValue as unknown;

    if (fieldType === 'number') {
      const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
      if (Number.isNaN(num)) return 'Value must be a number';
      if (rules.min !== undefined && num < rules.min) return `Value too small (min: ${rules.min})`;
      if (rules.max !== undefined && num > rules.max) return `Value too large (max: ${rules.max})`;
      return null;
    }

    if (field.enum && typeof value === 'string' && !field.enum.includes(value)) {
      return 'Value not in allowed set';
    }

    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        return `Value too short (min: ${rules.minLength})`;
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        return `Value too long (max: ${rules.maxLength})`;
      }
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          return 'Value does not match required pattern';
        }
      }
    }

    return null;
  };

  const runValidation = (meta: { title: string; correspondent: string; createdDate: string }, nextRequired: SmartField[], nextOptional: SmartField[]) => {
    const errors = new Map<string, string>();

    if (requiredMetadataKeys.includes('metadata:title') && !meta.title) {
      errors.set('metadata:title', 'Title is required');
    }
    if (requiredMetadataKeys.includes('metadata:correspondent') && !meta.correspondent) {
      errors.set('metadata:correspondent', 'Correspondent is required');
    }
    if (requiredMetadataKeys.includes('metadata:document_date') && !meta.createdDate) {
      errors.set('metadata:document_date', 'Document date is required');
    }

    nextRequired.forEach((field) => {
      const err = validateFieldValue(field, field.value, true);
      if (err) errors.set(String(field.id), err);
    });
    nextOptional.forEach((field) => {
      if (isEmptyValue(field.value)) return;
      const err = validateFieldValue(field, field.value, false);
      if (err) errors.set(String(field.id), err);
    });

    setValidationErrors(errors);
    if (errors.size > 0) {
      const summary = errors.values().next().value || 'Validation failed';
      setValidationError(summary);
      return false;
    }

    setValidationError(null);
    return true;
  };

  const validateAndMarkDirty = (meta: { title: string; correspondent: string; createdDate: string }, nextRequired: SmartField[], nextOptional: SmartField[], tags: SmartTag[]) => {
    const payload = {
      documentId: currentDocumentId,
      metadata: meta,
      customFields: [...nextRequired, ...nextOptional],
      selectedTags: tags
    };
    const res = SmartMetadataSchema.safeParse(payload);
    if (!res.success) {
      const msg = res.error?.issues?.[0]?.message || 'Validation failed';
      setValidationError(msg);
      return false;
    }

    const valid = runValidation(meta, nextRequired, nextOptional);
    if (!valid) return false;

    markDirty();
    return true;
  };

  const buildCustomFieldMap = (customFields: Array<Record<string, unknown>>): Map<string, string> => {
    const map = new Map<string, string>();
    customFields.forEach((cf) => {
      const fieldRef = cf?.field as unknown;
      const name =
        (cf?.name as string | undefined) ||
        (typeof fieldRef === 'object' && fieldRef && (fieldRef as Record<string, unknown>).name
          ? String((fieldRef as Record<string, unknown>).name)
          : (typeof fieldRef === 'string' ? fieldRef : null));
      if (!name) return;
      const key = normalizePaperlessKey(`custom_field:${name}`);
      if (!key) return;
      map.set(key, stringifyValue(cf?.value));
    });
    return map;
  };

  const buildVisualMaps = (visualFields: SmartField[]) => {
    const normalized = visualFields.map((field, index) => {
      const matchId = String(field.id || field.fieldId || field.label || index);
      const paperlessKey = normalizePaperlessKey(field.paperlessField || field.paperlessMapping || '');
      const labelKey = normalizeLabel(field.label || field.fieldId || '');
      return {
        ...field,
        _matchId: matchId,
        _paperlessKey: paperlessKey,
        _labelKey: labelKey
      };
    });

    const byPaperless = new Map<string, SmartField & { _matchId: string }>();
    const byLabel = new Map<string, SmartField & { _matchId: string }>();

    normalized.forEach((field) => {
      if (field._paperlessKey) byPaperless.set(field._paperlessKey, field);
      if (field._labelKey) byLabel.set(field._labelKey, field);
    });

    return { normalized, byPaperless, byLabel };
  };

  const mergeFieldValues = (nextFields: SmartField[], existingFields: SmartField[]) => {
    if (!existingFields || existingFields.length === 0) return nextFields;
    const existingMap = new Map(existingFields.map((f) => [String(f.id), f]));
    return nextFields.map((field) => {
      const prev = existingMap.get(String(field.id));
      if (!prev) return field;
      if (!isEmptyValue(prev.value)) {
        return {
          ...field,
          value: prev.value,
          isAiGenerated: prev.isAiGenerated === true
        };
      }
      return field;
    });
  };

  const syncDomainFields = (visualOverride?: SmartField[]) => {
    const profile = resolvedProfile;
    const customFieldMap = buildCustomFieldMap(Array.isArray(initial.customFields) ? initial.customFields : []);
    const visualFieldsRaw = Array.isArray(visualOverride)
      ? visualOverride
      : (Array.isArray(initial.visualFields) ? initial.visualFields : []);
    const { normalized, byPaperless, byLabel } = buildVisualMaps(visualFieldsRaw);
    const matchedIds = new Set<string>();

    const requiredMetadata = (profile.requiredFields || [])
      .map((field: SmartField) => normalizePaperlessKey(field.paperlessField || field.paperlessMapping || ''))
      .filter((key) => key.startsWith('metadata:'));

    const mapFields = (fields: SmartField[], mandatory: boolean) => {
      return (fields || [])
        .filter((field) => {
          const key = normalizePaperlessKey(field.paperlessField || field.paperlessMapping || '');
          return !key.startsWith('metadata:');
        })
        .map((field, index) => {
          const paperlessField = field.paperlessField || field.paperlessMapping || null;
          const paperlessKey = normalizePaperlessKey(paperlessField || '');
          const labelKey = normalizeLabel(field.label || field.fieldId || '');
          const match = (paperlessKey && byPaperless.get(paperlessKey)) || (labelKey && byLabel.get(labelKey)) || null;
          if (match && match._matchId) matchedIds.add(match._matchId);

          const existingValue = paperlessKey ? customFieldMap.get(paperlessKey) : '';
          const matchValue = match ? stringifyValue(match.value) : '';
          const value = !isEmptyValue(existingValue) ? existingValue : matchValue;
          const isAiGenerated = isEmptyValue(existingValue) && !isEmptyValue(matchValue);
          const matchType: MatchType = (match?.matchType as MatchType) || ((match?.paperlessMapping || match?.paperlessField) ? 'exact' : 'none');

          return {
            id: String(field.fieldId || field.id || field.label || `${mandatory ? 'req' : 'opt'}-${index}`),
            fieldId: field.fieldId || undefined,
            label: field.label || field.displayName?.en || field.fieldId || 'Field',
            value: value,
            paperlessField: paperlessField,
            paperlessMapping: match?.paperlessMapping || match?.paperlessField || null,
            mappingConfidence: match?.mappingConfidence ?? null,
            matchType: matchType,
            confidence: match?.confidence ?? null,
            overlayId: match?.overlayId ?? null,
            pageNumber: match?.pageNumber ?? null,
            isMandatory: mandatory,
            isAiGenerated: isAiGenerated,
            validationRules: field.validationRules || {},
            type: field.type,
            enum: Array.isArray(field.enum) ? field.enum : undefined,
            domain: profile.domain
          } as SmartField;
        });
    };

    let nextRequired = mapFields(profile.requiredFields as SmartField[], true);
    let nextOptional = mapFields(profile.optionalFields as SmartField[], false);

    nextRequired = mergeFieldValues(nextRequired, requiredFields);
    nextOptional = mergeFieldValues(nextOptional, optionalFields);

    const remainingVisual = normalized
      .filter((field) => !matchedIds.has((field as unknown as { _matchId: string })._matchId))
      .map((field, index) => ({
        id: String(field.id || field.fieldId || field.label || `visual-${index}`),
        fieldId: field.fieldId || undefined,
        label: field.label || 'Visual Field',
        value: stringifyValue(field.value),
        paperlessField: field.paperlessField || field.paperlessMapping || null,
        paperlessMapping: field.paperlessMapping || field.paperlessField || null,
        mappingConfidence: field.mappingConfidence ?? null,
        matchType: (field.matchType as MatchType) || ((field.paperlessMapping || field.paperlessField) ? 'exact' : 'none'),
        confidence: field.confidence ?? null,
        overlayId: field.overlayId ?? null,
        pageNumber: field.pageNumber ?? null,
        isAiGenerated: true
      })) as SmartField[];

    setRequiredMetadataKeys(requiredMetadata);
    setRequiredFields(nextRequired);
    setOptionalFields(nextOptional);
    setMappedVisualFields(remainingVisual);
    runValidation(localMetadata, nextRequired, nextOptional);
  };

  useEffect(() => {
    syncDomainFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvedProfile.domain,
    resolvedProfile.displayName,
    resolvedProfile.icon,
    initial.fieldProfile,
    initial.visualFields,
    initial.customFields,
    currentDocumentId
  ]);

  // Listen for document changes from the main workspace document dropdown
  useEffect(() => {
    const handleDocumentSwitched = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { documentId, document } = detail;

      if (documentId != null && documentId !== currentDocumentId) {
        setCurrentDocumentId(documentId);
        setLocalMetadata({
          title: document?.title || '',
          correspondent: document?.correspondent || '',
          createdDate: document?.createdDate || ''
        });
        setLocalTags(Array.isArray(document?.tagItems)
          ? document.tagItems.map((t: SmartTag) => ({ ...t }))
          : []);
        setAvailableTagsState(Array.isArray(document?.availableTags)
          ? document.availableTags.map((t: SmartTag) => ({ ...t }))
          : []);
        setRequiredFields([]);
        setOptionalFields([]);
        setMappedVisualFields([]);
        setOptionalExpanded(false);
        setValidationError(null);
        setValidationErrors(new Map());
        setDomainOverride(null);
        setProfileOverride(null);
        console.log(`[SmartMetadata] Document switched to ${documentId}`);
      }
    };

    window.addEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
    return () => window.removeEventListener('workspace:document-switched', handleDocumentSwitched as EventListener);
  }, [currentDocumentId]);

  const onLocate = (fieldId: string | number): void => {
    dispatchEventSafe('metadata:locate-field', { fieldId } as MetadataLocateDetail);
  };

  const onFeedback = (fieldId: string | number, vote: 'up' | 'down'): void => {
    dispatchEventSafe('feedback:vote', { fieldId, vote } as FeedbackVoteDetail);
  };

  const onMetaChange = (key: 'title' | 'correspondent' | 'createdDate', val: string) => {
    const next = { ...localMetadata, [key]: val };
    setLocalMetadata(next);
    validateAndMarkDirty(next, requiredFields, optionalFields, localTags);
  };

  const handleAddTag = (tagId: number): void => {
    const tagToAdd = (Array.isArray(availableTagsState) ? availableTagsState : [])
      .find((t: SmartTag) => t.id === tagId);
    if (!tagToAdd || localTags.some((t: SmartTag) => t.id === tagId)) return;
    const nextTags = [...localTags, tagToAdd];
    setLocalTags(nextTags);
    validateAndMarkDirty(localMetadata, requiredFields, optionalFields, nextTags);
    dispatchEventSafe('tags:updated', { documentId: currentDocumentId, tags: nextTags });
  };

  const handleRemoveTag = (tagId: number): void => {
    const nextTags = localTags.filter((t: SmartTag) => t.id !== tagId);
    setLocalTags(nextTags);
    validateAndMarkDirty(localMetadata, requiredFields, optionalFields, nextTags);
    dispatchEventSafe('tags:updated', { documentId: currentDocumentId, tags: nextTags });
  };

  const updateFieldValue = (fieldId: string, val: string) => {
    const nextRequired = requiredFields.map((field) => (
      String(field.id) === fieldId ? { ...field, value: val, isAiGenerated: false } : field
    ));
    const nextOptional = optionalFields.map((field) => (
      String(field.id) === fieldId ? { ...field, value: val, isAiGenerated: false } : field
    ));
    setRequiredFields(nextRequired);
    setOptionalFields(nextOptional);
    validateAndMarkDirty(localMetadata, nextRequired, nextOptional, localTags);
  };

  // Listen for metadata refresh events from reprocessing
  useEffect(() => {
    interface MetadataRefreshDetail {
      documentId?: DocumentId;
      fields?: SmartField[];
      tags?: SmartTag[];
      classification?: Record<string, unknown>;
    }

    const handleMetadataRefresh = (e: Event) => {
      const detail = (e as CustomEvent<MetadataRefreshDetail>)?.detail || {};
      const { documentId, fields: newFields, tags: newTags, classification } = detail;

      if (String(documentId) !== String(currentDocumentId)) return;

      if (Array.isArray(newFields) && newFields.length > 0) {
        const normalizedFields = newFields.map((f: SmartField & { confidence?: number }) => ({
          ...f,
          isAiGenerated: true,
          confidence: f.confidence || 0.5
        }));
        syncDomainFields(normalizedFields);
      }

      if (Array.isArray(newTags) && newTags.length > 0) {
        setLocalTags((prevTags: SmartTag[]) => {
          const existingIds = new Set(prevTags.map((t: SmartTag) => t.id));
          const tagsToAdd = newTags.filter((t: SmartTag) => !existingIds.has(t.id));
          return [...prevTags, ...tagsToAdd];
        });
      }

      if (classification) {
        const rawDomain =
          (classification as Record<string, unknown>)?.primary_domain ||
          (classification as Record<string, unknown>)?.domain ||
          (classification as Record<string, unknown>)?.classification?.['primary_domain'];
        if (rawDomain) {
          const normalized = normalizeDomain(String(rawDomain));
          const fallback = resolveDomainMeta(normalized);
          setDomainOverride(normalized);
          setProfileOverride({ displayName: fallback.label, icon: fallback.icon });
        }
      }

      markDirty();
    };

    window.addEventListener('metadata:refresh', handleMetadataRefresh as EventListener);
    return () => window.removeEventListener('metadata:refresh', handleMetadataRefresh as EventListener);
  }, [currentDocumentId]);

  // Participant wiring: acknowledge save requests and attempt to save if dirty
  useEffect(() => {
    type SaveRequestDetail = { saveId?: string; documentId?: number | null };

    function onSaveRequest(e: Event) {
      const detail = (e as CustomEvent<SaveRequestDetail>)?.detail || {};
      const { saveId, documentId } = detail;
      if (String(documentId) !== String(currentDocumentId)) return;
      const participantId = 'smart-metadata';
      const willSave = Boolean(window.__smart_metadata_dirty);

      dispatchEventSafe('workspace:save-ack', { saveId, participantId, willSave });
      if (!willSave) return;

      const delay = props.saveDelayMs ?? 100;
      setTimeout(() => {
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
  }, [currentDocumentId, props.saveDelayMs, validationError]);

  const domainMeta = resolveDomainMeta(resolvedProfile.domain);
  const availableTags: SmartTag[] = Array.isArray(availableTagsState) ? availableTagsState : [];
  const hiddenOptionalCount = Math.max(optionalFields.length - 4, 0);
  const optionalPreview = optionalExpanded ? optionalFields : optionalFields.slice(0, 4);

  const titleError = validationErrors.get('metadata:title');
  const correspondentError = validationErrors.get('metadata:correspondent');
  const createdDateError = validationErrors.get('metadata:document_date');

  return (
    <div data-testid="smart-metadata-root" className="flex flex-col gap-4">
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

      <div className="rounded-lg border border-[#eee4d7] bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[#8a6f54]">Smart Metadata</div>
            <div className="text-lg font-['Fraunces'] text-[#2c2c2c]">Unified Metadata View</div>
          </div>
          <div
            data-testid="document-domain-badge"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${domainMeta.badge}`}
          >
            <span>{resolvedProfile.icon || domainMeta.icon}</span>
            <span>{resolvedProfile.displayName || domainMeta.label}</span>
          </div>
        </div>

        <div className="grid gap-3 mt-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="smart-title-input" className="text-xs text-[#666] flex items-center gap-2">
              Title
              {requiredMetadataKeys.includes('metadata:title') && (
                <span className="text-[10px] px-2 py-[2px] rounded-full bg-[#fff3e6] text-[#9a3412] border border-[#f3c9a6]">Required</span>
              )}
            </label>
            <input
              id="smart-title-input"
              title="Document title"
              placeholder="Enter document title"
              data-testid="smart-title-input"
              className={`w-full border rounded-md px-3 py-2 text-sm ${titleError ? 'border-red-400 bg-red-50' : 'border-[#e5e0d8]'}`}
              value={localMetadata.title}
              onInput={(e: Event) => onMetaChange('title', (e.target as HTMLInputElement).value)}
            />
            {titleError && (
              <span data-testid="title-error" className="text-xs text-red-600">{titleError}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="smart-correspondent-input" className="text-xs text-[#666] flex items-center gap-2">
              Correspondent
              {requiredMetadataKeys.includes('metadata:correspondent') && (
                <span className="text-[10px] px-2 py-[2px] rounded-full bg-[#fff3e6] text-[#9a3412] border border-[#f3c9a6]">Required</span>
              )}
            </label>
            <input
              id="smart-correspondent-input"
              title="Correspondent name"
              placeholder="Enter correspondent name"
              data-testid="smart-correspondent-input"
              className={`w-full border rounded-md px-3 py-2 text-sm ${correspondentError ? 'border-red-400 bg-red-50' : 'border-[#e5e0d8]'}`}
              value={localMetadata.correspondent}
              onInput={(e: Event) => onMetaChange('correspondent', (e.target as HTMLInputElement).value)}
            />
            {correspondentError && (
              <span data-testid="correspondent-error" className="text-xs text-red-600">{correspondentError}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="smart-date-input" className="text-xs text-[#666] flex items-center gap-2">
              Created Date
              {requiredMetadataKeys.includes('metadata:document_date') && (
                <span className="text-[10px] px-2 py-[2px] rounded-full bg-[#fff3e6] text-[#9a3412] border border-[#f3c9a6]">Required</span>
              )}
            </label>
            <input
              id="smart-date-input"
              type="date"
              title="Document created date"
              data-testid="smart-date-input"
              className={`w-full border rounded-md px-3 py-2 text-sm ${createdDateError ? 'border-red-400 bg-red-50' : 'border-[#e5e0d8]'}`}
              value={localMetadata.createdDate}
              onInput={(e: Event) => onMetaChange('createdDate', (e.target as HTMLInputElement).value)}
            />
            {createdDateError && (
              <span data-testid="created-date-error" className="text-xs text-red-600">{createdDateError}</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2" data-testid="tags-container">
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
                  data-testid={`tag-remove-${tag.id}`}
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
      </div>

      <div className="rounded-lg border border-[#eee4d7] bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide text-[#8a6f54]">Required Fields</div>
          <div className="text-xs text-[#8a6f54]" data-testid="required-field-count">
            {requiredFields.length} fields
          </div>
        </div>
        {requiredFields.length === 0 && (
          <div data-testid="no-required-fields" className="text-xs text-[#888]">
            No required custom fields for this domain.
          </div>
        )}
        {requiredFields.map((field) => {
          const fieldKey = String(field.id);
          const error = validationErrors.get(fieldKey);
          const confidenceValue = typeof field.confidence === 'number' ? field.confidence : (field.mappingConfidence ?? null);
          const confidencePercent = confidenceValue !== null ? Math.round(confidenceValue * 100) : null;
          const matchType = (field.matchType as MatchType) || 'none';
          return (
            <div
              key={fieldKey}
              className={`mb-3 border rounded-md p-3 ${error ? 'border-red-300 bg-red-50' : 'border-[#f2efe9] bg-[#fffaf3]'}`}
              data-testid={`required-field-${toTestId(fieldKey)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#444] font-medium">{field.label || fieldKey}</div>
                  <div className="text-[10px] text-[#8a6f54]">{field.paperlessField || ''}</div>
                </div>
                <span
                  data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                  className={`text-[10px] px-2 py-1 rounded-full border ${MATCH_BADGES[matchType]}`}
                >
                  {resolveMatchLabel(matchType)}
                </span>
              </div>
              <input
                id={`required-field-value-${fieldKey}`}
                title={`Value for ${field.label || fieldKey}`}
                placeholder="Enter value"
                data-testid={`required-field-value-${toTestId(fieldKey)}`}
                className={`mt-2 w-full border rounded px-2 py-1 text-sm ${error ? 'border-red-400 bg-red-50' : 'border-[#eae6df]'}`}
                value={stringifyValue(field.value)}
                onInput={(e: Event) => updateFieldValue(fieldKey, (e.target as HTMLInputElement).value)}
              />
              {error && (
                <div data-testid={`field-error-${toTestId(fieldKey)}`} className="text-xs text-red-600 mt-1">{error}</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-[#f3e8dc] overflow-hidden" data-testid={`confidence-bar-${toTestId(fieldKey)}`}>
                    <div
                      className="h-full bg-[#b87333]"
                      style={{ width: `${confidencePercent ?? 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-[#8a6f54] w-[44px] text-right">
                  {confidencePercent !== null ? `${confidencePercent}%` : '--'}
                </div>
                <button
                  data-testid={`locate-required-${toTestId(fieldKey)}`}
                  className="px-2 py-1 text-xs rounded bg-[#f6efe8] border border-[#e5e0d8]"
                  title="Locate field on document"
                  onClick={() => onLocate(field.paperlessField || field.id)}
                >
                  <i className="fas fa-crosshairs mr-1"></i>
                  Locate
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#eee4d7] bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide text-[#8a6f54]">Optional Fields</div>
          {optionalFields.length > 4 && (
            <button
              type="button"
              data-testid="optional-fields-toggle"
              className="text-xs text-[#7c5a3a] underline"
              onClick={() => setOptionalExpanded(!optionalExpanded)}
            >
              {optionalExpanded ? 'Hide extras' : `Show ${hiddenOptionalCount} more`}
            </button>
          )}
        </div>
        {optionalFields.length === 0 && (
          <div data-testid="no-optional-fields" className="text-xs text-[#888]">
            No optional custom fields for this domain.
          </div>
        )}
        {optionalPreview.map((field) => {
          const fieldKey = String(field.id);
          const error = validationErrors.get(fieldKey);
          const confidenceValue = typeof field.confidence === 'number' ? field.confidence : (field.mappingConfidence ?? null);
          const confidencePercent = confidenceValue !== null ? Math.round(confidenceValue * 100) : null;
          const matchType = (field.matchType as MatchType) || 'none';
          return (
            <div
              key={fieldKey}
              className={`mb-3 border rounded-md p-3 ${error ? 'border-red-300 bg-red-50' : 'border-[#f2efe9]'}`}
              data-testid={`optional-field-${toTestId(fieldKey)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#444] font-medium">{field.label || fieldKey}</div>
                  <div className="text-[10px] text-[#8a6f54]">{field.paperlessField || ''}</div>
                </div>
                <span
                  data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                  className={`text-[10px] px-2 py-1 rounded-full border ${MATCH_BADGES[matchType]}`}
                >
                  {resolveMatchLabel(matchType)}
                </span>
              </div>
              <input
                id={`optional-field-value-${fieldKey}`}
                title={`Value for ${field.label || fieldKey}`}
                placeholder="Enter value"
                data-testid={`optional-field-value-${toTestId(fieldKey)}`}
                className={`mt-2 w-full border rounded px-2 py-1 text-sm ${error ? 'border-red-400 bg-red-50' : 'border-[#eae6df]'}`}
                value={stringifyValue(field.value)}
                onInput={(e: Event) => updateFieldValue(fieldKey, (e.target as HTMLInputElement).value)}
              />
              {error && (
                <div data-testid={`field-error-${toTestId(fieldKey)}`} className="text-xs text-red-600 mt-1">{error}</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-[#f3e8dc] overflow-hidden" data-testid={`confidence-bar-${toTestId(fieldKey)}`}>
                    <div
                      className="h-full bg-[#b87333]"
                      style={{ width: `${confidencePercent ?? 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-[#8a6f54] w-[44px] text-right">
                  {confidencePercent !== null ? `${confidencePercent}%` : '--'}
                </div>
                <button
                  data-testid={`locate-optional-${toTestId(fieldKey)}`}
                  className="px-2 py-1 text-xs rounded bg-[#f6efe8] border border-[#e5e0d8]"
                  title="Locate field on document"
                  onClick={() => onLocate(field.paperlessField || field.id)}
                >
                  <i className="fas fa-crosshairs mr-1"></i>
                  Locate
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#eee4d7] bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide text-[#8a6f54]">Visual Extracted Fields</div>
          <div className="text-xs text-[#8a6f54]" data-testid="visual-field-count">
            {mappedVisualFields.length} fields
          </div>
        </div>
        {mappedVisualFields.length === 0 && (
          <div data-testid="no-visual-fields" className="text-xs text-[#888]">
            No unmapped visual fields detected.
          </div>
        )}
        {mappedVisualFields.map((field) => {
          const fieldKey = String(field.id);
          const matchType = (field.matchType as MatchType) || 'none';
          return (
            <div
              key={fieldKey}
              className="mb-3 border border-[#f2efe9] rounded-md p-3"
              data-testid={`visual-field-${toTestId(fieldKey)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#444] font-medium">{field.label || fieldKey}</div>
                  <div className="text-[10px] text-[#8a6f54]">{field.paperlessField || field.paperlessMapping || ''}</div>
                </div>
                <span
                  data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                  className={`text-[10px] px-2 py-1 rounded-full border ${MATCH_BADGES[matchType]}`}
                >
                  {resolveMatchLabel(matchType)}
                </span>
              </div>
              <div className="mt-2 text-xs text-[#555]">
                {stringifyValue(field.value) || 'No value detected'}
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  data-testid={`locate-visual-${toTestId(fieldKey)}`}
                  className="px-2 py-1 text-xs rounded bg-[#f6efe8] border border-[#e5e0d8]"
                  title="Locate field on document"
                  onClick={() => onLocate(field.paperlessField || field.id)}
                >
                  <i className="fas fa-crosshairs mr-1"></i>
                  Locate
                </button>
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  data-testid={`feedback-up-${toTestId(fieldKey)}`}
                  className="px-2 py-1 rounded bg-white border border-[#eae6df] text-sm"
                  onClick={() => onFeedback(field.id, 'up')}
                  title="Thumbs up"
                >
                  <i className="fas fa-thumbs-up"></i>
                </button>
                <button
                  data-testid={`feedback-down-${toTestId(fieldKey)}`}
                  className="px-2 py-1 rounded bg-white border border-[#eae6df] text-sm"
                  onClick={() => onFeedback(field.id, 'down')}
                  title="Thumbs down"
                >
                  <i className="fas fa-thumbs-down"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
