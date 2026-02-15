import { h } from 'preact';
/* global describe, it, before, after, beforeEach, afterEach, expect, assert, sinon, page, browser, context, test */
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
interface ReprocessProgressDetail {
  documentId?: DocumentId;
  stage?: string;
  label?: string;
  status?: string;
  percentage?: number;
  details?: Record<string, unknown> | null;
}

type MatchType = 'exact' | 'fuzzy' | 'none';

const DOMAIN_FALLBACKS: Record<string, { icon: string; label: string; badge: string }> = {
  financial: {
    icon: 'fa-file-invoice-dollar',
    label: 'Financial Protocol',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
  },
  medical: {
    icon: 'fa-microscope',
    label: 'Medical Laboratory',
    badge: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
  },
  legal: {
    icon: 'fa-scale-balanced',
    label: 'Legal Framework',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
  },
  general: {
    icon: 'fa-file-lines',
    label: 'General Document',
    badge: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
  }
};

const MATCH_BADGES: Record<MatchType, string> = {
  exact: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  fuzzy: 'bg-amber-50 border-amber-200 text-amber-700',
  none: 'bg-red-50 border-red-200 text-red-700'
};

const REPROCESS_STEPS = [
  { key: 'visual_triage', label: 'Visual triage' },
  { key: 'visual_extraction', label: 'Visual extraction' },
  { key: 'query_generation', label: 'Query generation' },
  { key: 'query_execution', label: 'Query execution' },
  { key: 'ocr_fallback', label: 'OCR fallback' },
  { key: 'hybrid_fusion', label: 'Hybrid fusion' },
  { key: 'storage', label: 'Storage' }
];

function resolveProgressStage(stage?: string): string {
  if (!stage) return 'visual_triage';
  if (stage === 'queued') return 'visual_triage';
  if (stage === 'completed') return 'storage';
  if (stage === 'failed') return 'storage';
  return stage;
}

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

function asNonEmptyText(value?: unknown): string {
  if (value === undefined || value === null) return '';
  const normalized = String(value).trim();
  return normalized;
}

function toFieldToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function hashFieldSeed(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function resolveDeterministicFieldId(
  field: Partial<SmartField>,
  fallbackPrefix: string
): string {
  const explicitFieldId = asNonEmptyText(field.fieldId);
  if (explicitFieldId) return explicitFieldId;

  const paperlessKey = normalizePaperlessKey(
    asNonEmptyText(field.paperlessField || field.paperlessMapping)
  );
  const paperlessToken = toFieldToken(paperlessKey);
  if (paperlessToken) return paperlessToken;

  const labelSource =
    asNonEmptyText(field.label) ||
    asNonEmptyText(field.displayName?.en) ||
    asNonEmptyText(field.displayName?.de);
  const labelToken = toFieldToken(labelSource);
  if (labelToken) return `${fallbackPrefix}_${labelToken}`;

  const stableSeed = JSON.stringify({
    id: asNonEmptyText(field.id),
    label: asNonEmptyText(field.label),
    paperlessField: asNonEmptyText(field.paperlessField),
    paperlessMapping: asNonEmptyText(field.paperlessMapping),
    type: asNonEmptyText(field.type),
    enum: Array.isArray(field.enum) ? field.enum : []
  });
  return `${fallbackPrefix}_${hashFieldSeed(stableSeed)}`;
}

function resolveDeterministicFieldDomId(
  field: Partial<SmartField>,
  fallbackFieldId: string
): string {
  const explicitId = asNonEmptyText(field.id);
  if (explicitId) return explicitId;
  return fallbackFieldId;
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

function normalizeDateInput(value?: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s].*$/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }

  const parts = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (parts) {
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    let year = Number(parts[3]);
    if (year < 100) {
      year += year < 70 ? 2000 : 1900;
    }
    if (!Number.isFinite(first) || !Number.isFinite(second)) return '';

    const looksLikeMdy = first <= 12 && second > 12;
    const month = looksLikeMdy ? first : second;
    const day = looksLikeMdy ? second : first;
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function extractAiMetadataPrefill(
  visualFields?: SmartField[]
): { title: string; correspondent: string; createdDate: string } {
  const defaults = { title: '', correspondent: '', createdDate: '' };
  if (!Array.isArray(visualFields) || visualFields.length === 0) {
    return defaults;
  }

  for (const field of visualFields) {
    const key = normalizePaperlessKey(
      field.paperlessField || field.paperlessMapping || ''
    );
    if (!key) continue;
    const value = stringifyValue(field.value);
    if (isEmptyValue(value)) continue;

    if (!defaults.title && key === 'metadata:title') {
      defaults.title = value;
      continue;
    }
    if (!defaults.correspondent && key === 'metadata:correspondent') {
      defaults.correspondent = value;
      continue;
    }
    if (
      !defaults.createdDate &&
      (key === 'metadata:document_date' || key === 'metadata:date')
    ) {
      defaults.createdDate = normalizeDateInput(value);
    }
  }

  return defaults;
}

function toTestId(value: string | number): string {
  return String(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

function resolveDomainMeta(domain: string) {
  return DOMAIN_FALLBACKS[domain] || DOMAIN_FALLBACKS.general;
}

function resolveMatchLabel(matchType?: MatchType | null): string {
  if (matchType === 'exact') return 'Exact Match';
  if (matchType === 'fuzzy') return 'Fuzzy Match';
  return 'No Match';
}

export default function SmartMetadataIsland(props: Partial<SmartMetadataContract & { documentId?: DocumentId; saveDelayMs?: number }>) {
  const aiMetadataPrefill = extractAiMetadataPrefill(props.visualFields);
  const [currentDocumentId, setCurrentDocumentId] = useState(props.documentId ?? null);
  const [localMetadata, setLocalMetadata] = useState({
    title: props.metadata?.title || aiMetadataPrefill.title || '',
    correspondent: props.metadata?.correspondent || aiMetadataPrefill.correspondent || '',
    createdDate: normalizeDateInput(
      props.metadata?.createdDate || aiMetadataPrefill.createdDate
    )
  } as { title: string; correspondent: string; createdDate: string });

  const [localTags, setLocalTags] = useState(() => (
    Array.isArray(props.selectedTags)
      ? props.selectedTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));
  const [availableTagsState, setAvailableTagsState] = useState(() => (
    Array.isArray(props.availableTags)
      ? props.availableTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));

  // Sync state when props change (initial load and switches)
  useEffect(() => {
    const nextPrefill = extractAiMetadataPrefill(props.visualFields);
    if (props.documentId !== undefined) setCurrentDocumentId(props.documentId);
    setLocalMetadata({
      title: props.metadata?.title || nextPrefill.title || '',
      correspondent: props.metadata?.correspondent || nextPrefill.correspondent || '',
      createdDate: normalizeDateInput(
        props.metadata?.createdDate || nextPrefill.createdDate
      )
    });
    setLocalTags(Array.isArray(props.selectedTags)
      ? props.selectedTags.map((t: SmartTag) => ({ ...t }))
      : []);
    setAvailableTagsState(Array.isArray(props.availableTags)
      ? props.availableTags.map((t: SmartTag) => ({ ...t }))
      : []);
  }, [props.documentId, props.metadata, props.selectedTags, props.availableTags]);

  const [validationError, setValidationError] = useState(null as string | null);
  const [validationErrors, setValidationErrors] = useState(() => new Map<string, string>());
  const [requiredFields, setRequiredFields] = useState([] as SmartField[]);
  const [optionalFields, setOptionalFields] = useState([] as SmartField[]);
  const [mappedVisualFields, setMappedVisualFields] = useState([] as SmartField[]);
  const [optionalExpanded, setOptionalExpanded] = useState(false);
  const [requiredMetadataKeys, setRequiredMetadataKeys] = useState([] as string[]);
  const [domainOverride, setDomainOverride] = useState(null as string | null);
  const [profileOverride, setProfileOverride] = useState(null as { displayName?: string; icon?: string } | null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [showReprocessOverlay, setShowReprocessOverlay] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState({
    stage: 'idle',
    label: 'Waiting to start',
    status: 'idle',
    percentage: 0
  });
  const [feedbackVotes, setFeedbackVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState('');

  const resolvedProfile = useMemo(() => {
    const profile = props.fieldProfile || {};
    const domain = normalizeDomain(
      domainOverride ||
      props.documentDomain ||
      profile.domain ||
      props.metadata?.documentType ||
      props.visualFields?.[0]?.domain ||
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
    props.documentDomain,
    props.fieldProfile,
    props.metadata?.documentType,
    props.visualFields
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
    const normalized = visualFields.map((field) => {
      const fallbackFieldId = resolveDeterministicFieldId(
        field,
        'visual_field'
      );
      const matchId = resolveDeterministicFieldDomId(field, fallbackFieldId);
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
    const customFieldMap = buildCustomFieldMap(Array.isArray(props.customFields) ? props.customFields : []);
    const visualFieldsRaw = Array.isArray(visualOverride)
      ? visualOverride
      : (Array.isArray(props.visualFields) ? props.visualFields : []);
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
        .map((field) => {
          const resolvedFieldId = resolveDeterministicFieldId(
            field,
            mandatory ? 'required_field' : 'optional_field'
          );
          const resolvedDomId = resolveDeterministicFieldDomId(
            field,
            resolvedFieldId
          );
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
            id: resolvedDomId,
            fieldId: resolvedFieldId,
            label: field.label || field.displayName?.en || resolvedFieldId,
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
      .map((field) => {
        const resolvedFieldId = resolveDeterministicFieldId(
          field,
          'visual_field'
        );
        const resolvedDomId = resolveDeterministicFieldDomId(
          field,
          resolvedFieldId
        );
        return {
          id: resolvedDomId,
          fieldId: resolvedFieldId,
          label: field.label || resolvedFieldId,
          value: stringifyValue(field.value),
          paperlessField: field.paperlessField || field.paperlessMapping || null,
          paperlessMapping: field.paperlessMapping || field.paperlessField || null,
          mappingConfidence: field.mappingConfidence ?? null,
          matchType: (field.matchType as MatchType) || ((field.paperlessMapping || field.paperlessField) ? 'exact' : 'none'),
          confidence: field.confidence ?? null,
          overlayId: field.overlayId ?? null,
          pageNumber: field.pageNumber ?? null,
          isAiGenerated: true
        };
      }) as SmartField[];

    const metadataCandidates = new Map<string, string>();
    normalized.forEach((field) => {
      const key = normalizePaperlessKey(field.paperlessField || field.paperlessMapping || '');
      if (!key.startsWith('metadata:')) return;
      const value = stringifyValue(field.value);
      if (isEmptyValue(value)) return;
      metadataCandidates.set(key, value);
    });

    const nextMetadata = { ...localMetadata };
    let metadataUpdated = false;

    const aiTitle = metadataCandidates.get('metadata:title');
    if (!nextMetadata.title && aiTitle) {
      nextMetadata.title = aiTitle;
      metadataUpdated = true;
    }
    const aiCorrespondent = metadataCandidates.get('metadata:correspondent');
    if (!nextMetadata.correspondent && aiCorrespondent) {
      nextMetadata.correspondent = aiCorrespondent;
      metadataUpdated = true;
    }
    const aiDate = normalizeDateInput(
      metadataCandidates.get('metadata:document_date') ||
      metadataCandidates.get('metadata:date')
    );
    if (!nextMetadata.createdDate && aiDate) {
      nextMetadata.createdDate = aiDate;
      metadataUpdated = true;
    }

    setRequiredMetadataKeys(requiredMetadata);
    setRequiredFields(nextRequired);
    setOptionalFields(nextOptional);
    setMappedVisualFields(remainingVisual);
    if (metadataUpdated) {
      setLocalMetadata(nextMetadata);
    }
    runValidation(metadataUpdated ? nextMetadata : localMetadata, nextRequired, nextOptional);
  };

  useEffect(() => {
    syncDomainFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolvedProfile.domain,
    resolvedProfile.displayName,
    resolvedProfile.icon,
    props.fieldProfile,
    props.visualFields,
    props.customFields,
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
          createdDate: normalizeDateInput(document?.createdDate)
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

  useEffect(() => {
    const onReprocessStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ documentId?: DocumentId }>)?.detail || {};
      if (String(detail.documentId) !== String(currentDocumentId)) return;
      setIsReprocessing(true);
      setShowReprocessOverlay(true);
      setReprocessProgress({
        stage: 'queued',
        label: 'Queued for re-analysis',
        status: 'in_progress',
        percentage: 5
      });
    };

    const onReprocessProgress = (e: Event) => {
      const detail = (e as CustomEvent<ReprocessProgressDetail>)?.detail || {};
      if (String(detail.documentId) !== String(currentDocumentId)) return;

      const nextStatus = detail.status || 'in_progress';
      const nextPercentage = Number.isFinite(Number(detail.percentage))
        ? Number(detail.percentage)
        : 0;
      const progressDetails = (
        detail.details &&
        typeof detail.details === 'object'
      ) ? detail.details : null;
      const detailUserMessage = (
        progressDetails &&
        typeof (progressDetails as Record<string, unknown>).userMessage ===
          'string'
      ) ? String((progressDetails as Record<string, unknown>).userMessage) : '';
      const nextLabel = nextStatus === 'failed'
        ? detailUserMessage || detail.label || 'Re-analysis failed'
        : detail.label || 'Reprocessing document';

      setReprocessProgress({
        stage: detail.stage || 'visual_extraction',
        label: nextLabel,
        status: nextStatus,
        percentage: Math.max(0, Math.min(100, Math.round(nextPercentage)))
      });

      if (nextStatus === 'completed') {
        setIsReprocessing(false);
        setTimeout(() => setShowReprocessOverlay(false), 600);
      } else if (nextStatus === 'failed') {
        setIsReprocessing(false);
      } else {
        setIsReprocessing(true);
        setShowReprocessOverlay(true);
      }
    };

    const onReprocessComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ documentId?: DocumentId }>)?.detail || {};
      if (String(detail.documentId) !== String(currentDocumentId)) return;
      setReprocessProgress({
        stage: 'completed',
        label: 'Re-analysis complete',
        status: 'completed',
        percentage: 100
      });
      setIsReprocessing(false);
      setTimeout(() => setShowReprocessOverlay(false), 600);
    };

    const onReprocessFailed = (e: Event) => {
      const detail = (e as CustomEvent<{
        documentId?: DocumentId;
        error?: string;
        userMessage?: string;
      }>)?.detail || {};
      if (String(detail.documentId) !== String(currentDocumentId)) return;
      const message = detail.userMessage || detail.error || 'Re-analysis failed';
      setReprocessProgress({
        stage: 'failed',
        label: message,
        status: 'failed',
        percentage: 100
      });
      setIsReprocessing(false);
      setShowReprocessOverlay(true);
    };

    window.addEventListener('workspace:reprocess-started', onReprocessStarted as EventListener);
    window.addEventListener('workspace:reprocess-progress', onReprocessProgress as EventListener);
    window.addEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
    window.addEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);
    return () => {
      window.removeEventListener('workspace:reprocess-started', onReprocessStarted as EventListener);
      window.removeEventListener('workspace:reprocess-progress', onReprocessProgress as EventListener);
      window.removeEventListener('workspace:reprocess-complete', onReprocessComplete as EventListener);
      window.removeEventListener('workspace:reprocess-failed', onReprocessFailed as EventListener);
    };
  }, [currentDocumentId]);

  const onLocate = (fieldId: string | number): void => {
    dispatchEventSafe('metadata:locate-field', { fieldId } as MetadataLocateDetail);
  };

  const onFeedback = async (fieldId: string | number, vote: 'up' | 'down'): Promise<void> => {
    dispatchEventSafe('feedback:vote', { fieldId, vote } as FeedbackVoteDetail);

    const fieldKey = String(fieldId);
    setFeedbackVotes((prev) => ({ ...prev, [fieldKey]: vote }));

    // If voting down, open inline correction editor
    if (vote === 'down') {
      setEditingField(fieldKey);
      setCorrectionValue('');
    } else {
      // If switching from down to up, close any open editor
      if (editingField === fieldKey) {
        setEditingField(null);
        setCorrectionValue('');
      }
    }

    const field = mappedVisualFields.find(
      (f) => String(f.id) === fieldKey || String((f as Record<string, unknown>).fieldId) === fieldKey
    );

    try {
      await fetch('/api/visual-rag/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: currentDocumentId,
          events: [{
            event_type: vote === 'up' ? 'verification' : 'correction',
            field_name: field?.paperlessField || field?.label || fieldKey,
            original_value: field?.value ?? null,
            corrected_value: null,
            context: {
              source: 'visual_insights',
              confidence: field?.confidence,
              matchType: field?.matchType,
              overlayId: (field as Record<string, unknown>)?.overlayId ?? null,
              pageNumber: (field as Record<string, unknown>)?.pageNumber ?? null,
              bbox: (field as Record<string, unknown>)?.bbox ?? null
            }
          }]
        })
      });
    } catch (err) {
      console.warn('[SmartMetadata] feedback POST failed:', err);
    }
  };

  const onSubmitCorrection = async (fieldId: string): Promise<void> => {
    if (!correctionValue.trim()) return;

    const field = mappedVisualFields.find(
      (f) => String(f.id) === fieldId || String((f as Record<string, unknown>).fieldId) === fieldId
    );

    try {
      await fetch('/api/visual-rag/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: currentDocumentId,
          events: [{
            event_type: 'correction',
            field_name: field?.paperlessField || field?.label || fieldId,
            original_value: field?.value ?? null,
            corrected_value: correctionValue.trim(),
            context: {
              source: 'visual_insights_correction',
              confidence: field?.confidence,
              matchType: field?.matchType,
              overlayId: (field as Record<string, unknown>)?.overlayId ?? null,
              pageNumber: (field as Record<string, unknown>)?.pageNumber ?? null,
              bbox: (field as Record<string, unknown>)?.bbox ?? null
            }
          }]
        })
      });
    } catch (err) {
      console.warn('[SmartMetadata] correction POST failed:', err);
    }

    setEditingField(null);
    setCorrectionValue('');
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

  const handleReprocess = (): void => {
    if (currentDocumentId == null || isReprocessing) return;
    setIsReprocessing(true);
    setShowReprocessOverlay(true);
    setReprocessProgress({
      stage: 'queued',
      label: 'Queued for re-analysis',
      status: 'in_progress',
      percentage: 5
    });
    dispatchEventSafe('workspace:reprocess-request', {
      documentId: currentDocumentId
    });
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
  const currentStepIndex = Math.max(
    0,
    REPROCESS_STEPS.findIndex(
      (step) => step.key === resolveProgressStage(reprocessProgress.stage)
    )
  );
  const hasFailedProgress = reprocessProgress.status === 'failed';

  return (
    <div data-testid="smart-metadata-root" className="flex flex-col gap-6">
      {validationError && (
        <div
          data-testid="validation-error"
          className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 animate-in fade-in slide-in-from-top-2"
          role="alert"
        >
          <i className="fas fa-triangle-exclamation text-rose-500"></i>
          <span>{validationError}</span>
        </div>
      )}

      {/* ── HEADER & DOMAIN ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Intelligence Layer</h3>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Unified Metadata Hub</div>
          </div>
          <div className="flex items-center gap-3">
            <div
              data-testid="document-domain-badge"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${domainMeta.badge}`}
            >
              <i className={`fas ${resolvedProfile.icon || domainMeta.icon}`}></i>
              <span>{resolvedProfile.displayName || domainMeta.label}</span>
            </div>
            <button
              type="button"
              data-testid="reprocess-metadata-btn"
              onClick={handleReprocess}
              disabled={isReprocessing || currentDocumentId == null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-cyan-600 hover:bg-cyan-700 shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:grayscale transition-all"
            >
              <i className={`fas ${isReprocessing ? 'fa-circle-notch fa-spin' : 'fa-wand-sparkles'}`}></i>
              <span>{isReprocessing ? 'Analyzing...' : 'Reprocess'}</span>
            </button>
          </div>
        </div>

        {/* ── CORE FIELDS ── */}
        <div className="grid gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="smart-title-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Title</label>
              {requiredMetadataKeys.includes('metadata:title') && (
                <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">Required</span>
              )}
            </div>
            <input
              id="smart-title-input"
              data-testid="smart-title-input"
              className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all focus:ring-2 focus:ring-cyan-500/20 outline-none ${titleError ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/10 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-cyan-50'}`}
              value={localMetadata.title}
              onInput={(e: Event) => onMetaChange('title', (e.target as HTMLInputElement).value)}
            />
            {titleError && <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-tight">{titleError}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="smart-correspondent-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correspondent</label>
                {requiredMetadataKeys.includes('metadata:correspondent') && (
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">Required</span>
                )}
              </div>
              <input
                id="smart-correspondent-input"
                data-testid="smart-correspondent-input"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all focus:ring-2 focus:ring-cyan-500/20 outline-none ${correspondentError ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/10 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-cyan-50'}`}
                value={localMetadata.correspondent}
                onInput={(e: Event) => onMetaChange('correspondent', (e.target as HTMLInputElement).value)}
              />
              {correspondentError && <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-tight">{correspondentError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="smart-date-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol Date</label>
                {requiredMetadataKeys.includes('metadata:document_date') && (
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">Required</span>
                )}
              </div>
              <input
                id="smart-date-input"
                type="date"
                data-testid="smart-date-input"
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all focus:ring-2 focus:ring-cyan-500/20 outline-none ${createdDateError ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/10 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-cyan-50'}`}
                value={localMetadata.createdDate}
                onInput={(e: Event) => onMetaChange('createdDate', (e.target as HTMLInputElement).value)}
              />
              {createdDateError && <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-tight">{createdDateError}</p>}
            </div>
          </div>
        </div>

        {/* ── TAGS ── */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800" data-testid="tags-container">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Classification Tags</label>
          <div className="flex flex-wrap gap-2 mb-4 min-h-[32px]">
            {localTags.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                No Tags Assigned
              </div>
            )}
            {localTags.map((tag: SmartTag) => (
              <span
                key={tag.id}
                data-testid={`tag-chip-${tag.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight border shadow-sm transition-all hover:scale-105"
                style={{
                  backgroundColor: tag.color ? `${tag.color}15` : undefined,
                  borderColor: tag.color ? `${tag.color}30` : undefined,
                  color: tag.color || undefined
                }}
              >
                {tag.name}
                <button
                  type="button"
                  data-testid={`tag-remove-${tag.id}`}
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:text-rose-500 transition-colors"
                  title={`Remove ${tag.name}`}
                >
                  <i className="fas fa-xmark text-[9px]"></i>
                </button>
              </span>
            ))}
          </div>
          {availableTags.filter((t: SmartTag) => !localTags.some((lt: SmartTag) => lt.id === t.id)).length > 0 && (
            <div className="relative">
              <select
                id="add-tag-select"
                data-testid="add-tag-select"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-cyan-500/20 appearance-none transition-all"
                onChange={(e: Event) => {
                  const val = parseInt((e.target as HTMLSelectElement).value, 10);
                  if (!isNaN(val)) {
                    handleAddTag(val);
                    (e.target as HTMLSelectElement).value = '';
                  }
                }}
                value=""
              >
                <option value="">+ Add Classification Tag</option>
                {availableTags
                  .filter((t: SmartTag) => !localTags.some((lt: SmartTag) => lt.id === t.id))
                  .map((t: SmartTag) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <i className="fas fa-chevron-down text-[10px] text-slate-400"></i>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── REQUIRED FIELDS ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Domain Requirements</h3>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-500 dark:text-slate-400" data-testid="required-field-count">
            {requiredFields.length}
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {requiredFields.length === 0 && (
            <div data-testid="no-required-fields" className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4">
              No domain-specific requirements detected.
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
                className={`group rounded-xl border transition-all p-4 ${error ? 'border-rose-200 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50'}`}
                data-testid={`required-field-${toTestId(fieldKey)}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-0.5">{field.label || fieldKey}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter truncate">{field.paperlessField || ''}</div>
                  </div>
                  <span
                    data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                    className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${MATCH_BADGES[matchType]}`}
                  >
                    {resolveMatchLabel(matchType)}
                  </span>
                </div>
                <input
                  id={`required-field-value-${fieldKey}`}
                  data-testid={`required-field-value-${toTestId(fieldKey)}`}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all outline-none focus:ring-2 focus:ring-cyan-500/20 ${error ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-cyan-50'}`}
                  value={stringifyValue(field.value)}
                  onInput={(e: Event) => updateFieldValue(fieldKey, (e.target as HTMLInputElement).value)}
                  placeholder="Enter Protocol Value"
                />
                {error && <p className="text-[9px] font-bold text-rose-500 mt-1 uppercase tracking-tight">{error}</p>}
                
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Certainty</span>
                      <span className="text-[9px] font-mono text-slate-500">{confidencePercent !== null ? `${confidencePercent}%` : '--'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" data-testid={`confidence-bar-${toTestId(fieldKey)}`}>
                      <div
                        className={`h-full transition-all duration-500 ${confidencePercent && confidencePercent > 80 ? 'bg-emerald-500' : confidencePercent && confidencePercent > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${confidencePercent ?? 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <button
                    data-testid={`locate-required-${toTestId(fieldKey)}`}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-cyan-500 transition-colors"
                    title="Locate spatial coordinates"
                    onClick={() => onLocate(field.paperlessField || field.id)}
                  >
                    <i className="fas fa-crosshairs text-xs"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── OPTIONAL FIELDS ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-slate-400 rounded-full"></div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Extended Data</h3>
          </div>
          {optionalFields.length > 4 && (
            <button
              type="button"
              data-testid="optional-fields-toggle"
              className="text-[9px] font-black text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 uppercase tracking-widest transition-colors"
              onClick={() => setOptionalExpanded(!optionalExpanded)}
            >
              {optionalExpanded ? 'Contract View' : `Expand +${hiddenOptionalCount}`}
            </button>
          )}
        </div>
        
        <div className="p-5 space-y-4">
          {optionalFields.length === 0 && (
            <div data-testid="no-optional-fields" className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4">
              No auxiliary fields detected.
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
                className={`group rounded-xl border transition-all p-4 ${error ? 'border-rose-200 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50'}`}
                data-testid={`optional-field-${toTestId(fieldKey)}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-0.5">{field.label || fieldKey}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter truncate">{field.paperlessField || ''}</div>
                  </div>
                  <span
                    data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                    className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${MATCH_BADGES[matchType]}`}
                  >
                    {resolveMatchLabel(matchType)}
                  </span>
                </div>
                <input
                  id={`optional-field-value-${fieldKey}`}
                  data-testid={`optional-field-value-${toTestId(fieldKey)}`}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all outline-none focus:ring-2 focus:ring-cyan-500/20 ${error ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-cyan-50'}`}
                  value={stringifyValue(field.value)}
                  onInput={(e: Event) => updateFieldValue(fieldKey, (e.target as HTMLInputElement).value)}
                  placeholder="Enter Metadata Value"
                />
                {error && <p className="text-[9px] font-bold text-rose-500 mt-1 uppercase tracking-tight">{error}</p>}
                
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Certainty</span>
                      <span className="text-[9px] font-mono text-slate-500">{confidencePercent !== null ? `${confidencePercent}%` : '--'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" data-testid={`confidence-bar-${toTestId(fieldKey)}`}>
                      <div
                        className={`h-full transition-all duration-500 ${confidencePercent && confidencePercent > 80 ? 'bg-emerald-500' : confidencePercent && confidencePercent > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${confidencePercent ?? 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <button
                    data-testid={`locate-optional-${toTestId(fieldKey)}`}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-cyan-500 transition-colors"
                    title="Locate spatial coordinates"
                    onClick={() => onLocate(field.paperlessField || field.id)}
                  >
                    <i className="fas fa-crosshairs text-xs"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── VISUAL EXTRACTIONS ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-amber-500 rounded-full"></div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Visual Insights</h3>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-500 dark:text-slate-400" data-testid="visual-field-count">
            {mappedVisualFields.length}
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {mappedVisualFields.length === 0 && (
            <div data-testid="no-visual-fields" className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4">
              No raw visual extractions detected.
            </div>
          )}
          {mappedVisualFields.map((field) => {
            const fieldKey = String(field.id);
            const matchType = (field.matchType as MatchType) || 'none';
            return (
              <div
                key={fieldKey}
                className="group rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50 transition-all p-4"
                data-testid={`visual-field-${toTestId(fieldKey)}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-0.5">{field.label || fieldKey}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter truncate">{field.paperlessField || field.paperlessMapping || ''}</div>
                  </div>
                  <span
                    data-testid={`mapping-badge-${toTestId(fieldKey)}`}
                    className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${MATCH_BADGES[matchType]}`}
                  >
                    {resolveMatchLabel(matchType)}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 mb-4">
                  {stringifyValue(field.value) || 'NULL DETECTED'}
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      data-testid={`feedback-up-${toTestId(fieldKey)}`}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        feedbackVotes[fieldKey] === 'up'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-500'
                      }`}
                      onClick={() => onFeedback(field.id, 'up')}
                      title="Confirm Logic"
                    >
                      <i className="fas fa-thumbs-up text-[10px]"></i>
                    </button>
                    <button
                      data-testid={`feedback-down-${toTestId(fieldKey)}`}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        feedbackVotes[fieldKey] === 'down'
                          ? 'bg-rose-50 border-rose-300 text-rose-600'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500'
                      }`}
                      onClick={() => onFeedback(field.id, 'down')}
                      title="Report Inaccuracy"
                    >
                      <i className="fas fa-thumbs-down text-[10px]"></i>
                    </button>
                  </div>
                  <button
                    data-testid={`locate-visual-${toTestId(fieldKey)}`}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-500 transition-colors"
                    onClick={() => onLocate(field.paperlessField || field.id)}
                  >
                    <i className="fas fa-crosshairs text-[10px]"></i>
                    Locate
                  </button>
                </div>
                {editingField === fieldKey && (
                  <div className="mt-2 flex gap-2" data-testid={`correction-input-${toTestId(fieldKey)}`}>
                    <input
                      type="text"
                      className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-rose-200 bg-rose-50/50 focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                      placeholder="Enter corrected value..."
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSubmitCorrection(fieldKey); }}
                      autoFocus
                    />
                    <button
                      className="px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                      onClick={() => onSubmitCorrection(fieldKey)}
                      data-testid={`correction-submit-${toTestId(fieldKey)}`}
                    >
                      Submit
                    </button>
                    <button
                      className="px-2 py-1.5 text-[10px] rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      onClick={() => { setEditingField(null); setCorrectionValue(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showReprocessOverlay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in"
          data-testid="reprocess-progress-overlay"
          role="dialog"
          aria-live="polite"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <i className="fas fa-dna text-cyan-500 animate-pulse"></i>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Deep Analysis</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">AI Pipeline Execution in Progress</p>
              </div>
            </div>

            <div
              className={`mb-4 px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-tight ${hasFailedProgress ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
              data-testid="reprocess-progress-label"
            >
              <i className={`fas ${hasFailedProgress ? 'fa-circle-xmark' : 'fa-terminal'} mr-2`}></i>
              {reprocessProgress.label}
            </div>

            <div className="space-y-2 mb-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync Progress</span>
                <span className="text-xs font-mono font-bold text-cyan-500" data-testid="reprocess-progress-percent">{reprocessProgress.percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                <div
                  data-testid="reprocess-progress-bar"
                  className={`h-full transition-all duration-500 ${hasFailedProgress ? 'bg-rose-500' : 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`}
                  style={{ width: `${reprocessProgress.percentage}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {REPROCESS_STEPS.map((step, index) => {
                const isFailedStep = hasFailedProgress && index === currentStepIndex;
                const isDoneStep = !hasFailedProgress && (
                  index < currentStepIndex ||
                  (index === currentStepIndex && reprocessProgress.status === 'completed')
                );
                const isActiveStep = !hasFailedProgress &&
                  reprocessProgress.status === 'in_progress' &&
                  index === currentStepIndex;

                const statusIcon = isFailedStep
                  ? 'fa-circle-xmark text-rose-500'
                  : isDoneStep
                    ? 'fa-circle-check text-emerald-500'
                    : isActiveStep
                      ? 'fa-dna fa-spin text-cyan-500'
                      : 'fa-circle text-slate-200 dark:text-slate-800';

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${isActiveStep ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-transparent'}`}
                    data-testid={`reprocess-step-${step.key}`}
                  >
                    <i className={`fas ${statusIcon} text-[10px]`}></i>
                    <span className={`text-[10px] font-black uppercase tracking-tight ${isActiveStep ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                data-testid="reprocess-overlay-cancel"
                className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                onClick={() => setShowReprocessOverlay(false)}
              >
                {isReprocessing ? 'Abort' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
