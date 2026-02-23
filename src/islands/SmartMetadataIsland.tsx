import { h } from 'preact';
import { createPortal } from 'preact/compat';
/* global describe, it, before, after, beforeEach, afterEach, expect, assert, sinon, page, browser, context, test */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
  { key: 'expert_thinking', label: 'Expert thinking' },
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

const DOMAIN_TAG_PRIORITIES: Record<string, string[]> = {
  financial: ["Rechnung", "Mahnung", "Kontoauszug", "Steuer", "Vertrag"],
  medical: ["Attest", "Befund", "Rezept", "Überweisung", "Krankenhaus"],
  legal: ["Vertrag", "Kündigung", "Mahnung", "Vollmacht", "Gericht"],
  general: ["Dokument", "Notiz", "Brief", "Formular", "Antrag"],
};

function getDomainPriorities(domain: string): string[] {
  const key = domain ? domain.toLowerCase() : "general";
  const resolved = key === "fin" ? "financial" : key === "med" ? "medical" : key;
  return DOMAIN_TAG_PRIORITIES[resolved] || DOMAIN_TAG_PRIORITIES["general"];
}

function selectTop20Tags(
  availableTags: SmartTag[],
  localTags: SmartTag[],
  domain: string
): SmartTag[] {
  const unselected = availableTags.filter(t => !localTags.some(lt => lt.id === t.id));
  const domainPriorities = getDomainPriorities(domain);
  const domainTags: SmartTag[] = [];
  const seenIds = new Set<number>();
  for (const keyword of domainPriorities) {
    const match = unselected.find(
      t => !seenIds.has(t.id) && t.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) { domainTags.push(match); seenIds.add(match.id); }
  }
  const remaining = unselected
    .filter(t => !seenIds.has(t.id))
    .sort((a, b) => (b.document_count ?? 0) - (a.document_count ?? 0))
    .slice(0, 20 - domainTags.length);
  return [...domainTags, ...remaining];
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

function normalizeVisOcrPages(
  rawPages: unknown
): Array<{ pageNumber: number; text: string; success: boolean }> {
  if (!Array.isArray(rawPages)) return [];
  return rawPages
    .filter((page) => page && typeof page === 'object')
    .map((page) => {
      const record = page as Record<string, unknown>;
      const pageNumber = Number(record.pageNumber);
      return {
        pageNumber: Number.isFinite(pageNumber) ? pageNumber : 0,
        text: typeof record.text === 'string' ? record.text : '',
        success: record.success !== false
      };
    })
    .filter((page) => page.pageNumber > 0);
}

function resolvePreMetadata(
  propsMetadata: SmartMetadataContract['metadata'],
  aiPrefill: { title: string; correspondent: string; createdDate: string }
): { title: string; correspondent: string; createdDate: string } {
  const title = propsMetadata?.title || aiPrefill.title || '';
  let correspondent = propsMetadata?.correspondent || aiPrefill.correspondent || '';
  const createdDate = normalizeDateInput(propsMetadata?.createdDate || aiPrefill.createdDate);
  const currentUser = propsMetadata?.currentUser;

  // Business rule: if title contains 'Personal Note', correspondent defaults to current user
  if (!correspondent && currentUser && title.toLowerCase().includes('personal note')) {
    correspondent = currentUser;
  }

  return { title, correspondent, createdDate };
}

export default function SmartMetadataIsland(props: Partial<SmartMetadataContract & { documentId?: DocumentId; saveDelayMs?: number }>) {
  const aiMetadataPrefill = extractAiMetadataPrefill(props.visualFields);
  const [currentDocumentId, setCurrentDocumentId] = useState(props.documentId ?? null);
  const isDirtyRef = useRef(false);
  const [localMetadata, setLocalMetadata] = useState(() =>
    resolvePreMetadata(props.metadata, aiMetadataPrefill)
  );
  const [localTags, setLocalTags] = useState(() => (
    Array.isArray(props.selectedTags)
      ? props.selectedTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));
  // Refs that always reflect the latest state — used by the save handler to avoid stale closure captures.
  // Initialized to match the initial state values so the very first save reads correct data.
  const localMetadataRef = useRef(localMetadata);
  const localTagsRef = useRef(
    Array.isArray(props.selectedTags)
      ? props.selectedTags.map((t: SmartTag) => ({ ...t }))
      : [] as SmartTag[]
  );
  const requiredFieldsRef = useRef([] as SmartField[]);
  const optionalFieldsRef = useRef([] as SmartField[]);
  const [availableTagsState, setAvailableTagsState] = useState(() => (
    Array.isArray(props.availableTags)
      ? props.availableTags.map((t: SmartTag) => ({ ...t }))
      : []
  ));

  // Ref-syncing wrappers: always update the ref before (or alongside) calling the state setter
  // so that save handler closures (which cannot be in dep arrays of certain effects) always
  // read the freshest values via the ref.
  // NOTE: These must be declared before any useEffect that calls them.
  const setLocalMetadataAndRef = (next: { title: string; correspondent: string; createdDate: string }) => {
    localMetadataRef.current = next;
    setLocalMetadata(next);
  };
  const setLocalTagsAndRef = (next: SmartTag[]) => {
    localTagsRef.current = next;
    setLocalTags(next);
  };

  // Track whether the user has manually edited the correspondent field.
  // When true, the "Personal Note" auto-fill rule is suppressed so it
  // doesn't override the user's explicit choice (including clearing it).
  const correspondentManuallyEdited = useRef(false);

  // Sync state when props change (initial load and switches)
  useEffect(() => {
    // Only reset local state if the document ID actually changed
    // or if we are transitioning from no document to a document.
    if (props.documentId !== undefined && props.documentId !== currentDocumentId) {
      const nextPrefill = extractAiMetadataPrefill(props.visualFields);
      setCurrentDocumentId(props.documentId);
      correspondentManuallyEdited.current = false;
      setLocalMetadataAndRef(resolvePreMetadata(props.metadata, nextPrefill));
      setLocalTagsAndRef(Array.isArray(props.selectedTags)
        ? props.selectedTags.map((t: SmartTag) => ({ ...t }))
        : []);
      setAvailableTagsState(Array.isArray(props.availableTags)
        ? props.availableTags.map((t: SmartTag) => ({ ...t }))
        : []);

      // Reset dirty state on document switch
      isDirtyRef.current = false;
      try { window.__smart_metadata_dirty = false; } catch (e) { /* ignore */ }
    }
  }, [props.documentId, props.metadata, props.selectedTags, props.availableTags, currentDocumentId]);

  const [validationError, setValidationError] = useState(null as string | null);
  const [validationErrors, setValidationErrors] = useState(() => new Map<string, string>());
  const [requiredFields, setRequiredFields] = useState([] as SmartField[]);
  const [optionalFields, setOptionalFields] = useState([] as SmartField[]);
  const setRequiredFieldsAndRef = (next: SmartField[]) => {
    requiredFieldsRef.current = next;
    setRequiredFields(next);
  };
  const setOptionalFieldsAndRef = (next: SmartField[]) => {
    optionalFieldsRef.current = next;
    setOptionalFields(next);
  };
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

  // T3a: VIS_OCR reactive state — useState instead of useMemo so vis-ocr:updated events update the UI
  const [visOcrPages, setSmVisOcrPages] = useState<Array<{ pageNumber: number; text: string; success: boolean }>>(
    () => normalizeVisOcrPages(props.metadata?.visOcrPages)
  );
  const [visOcrSource, setSmVisOcrSource] = useState<string>(
    () => (typeof props.metadata?.visOcrSource === 'string' ? props.metadata.visOcrSource : '')
  );
  const [visOcrQuality, setSmVisOcrQuality] = useState<number | null>(() => {
    const quality = props.metadata?.visOcrQuality;
    return typeof quality === 'number' && Number.isFinite(quality) ? quality : null;
  });

  // T2b: Correspondent suggestions
  const [correspondentSuggestions, setCorrespondentSuggestions] = useState<string[]>([]);
  const [isSuggestingCorrespondent, setIsSuggestingCorrespondent] = useState(false);

  // T5: Tag source tracking (per-tag origin: 'ai' or 'manual')
  const [tagSourceMap, setTagSourceMap] = useState<Map<number, 'ai' | 'manual'>>(new Map());

  // T5 (Section J): Tag filter for pill-cloud search
  const [tagFilter, setTagFilter] = useState('');

  // T7: Locate ring feedback — which field is currently being located
  const [locatingFieldId, setLocatingFieldId] = useState<string | null>(null);

  useEffect(() => {
    try { window.__smart_metadata_mounted = true; } catch (e) { /* ignore */ }
  }, []);

  const markDirty = (): void => {
    isDirtyRef.current = true;
    try { 
      window.__smart_metadata_dirty = true; 
      if (typeof window !== 'undefined') {
        (window as any).__workspaceState = (window as any).__workspaceState || {};
        const key = String(currentDocumentId);
        (window as any).__workspaceState[key] = (window as any).__workspaceState[key] || {};
        (window as any).__workspaceState[key].isDirty = true;
      }
    } catch (e) { /* ignore */ }
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
    console.info('[SmartMetadata] runValidation start', { title: meta.title, requiredKeys: requiredMetadataKeys });
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
      console.warn('[SmartMetadata] runValidation failed:', Array.from(errors.entries()));
      const summary = errors.values().next().value || 'Validation failed';
      setValidationError(summary);
      return false;
    }

    setValidationError(null);
    return true;
  };

  const validateAndMarkDirty = (meta: { title: string; correspondent: string; createdDate: string }, nextRequired: SmartField[], nextOptional: SmartField[], tags: SmartTag[]) => {
    // skip zod validation for debugging
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
    if (!nextMetadata.correspondent) {
      if (aiCorrespondent) {
        nextMetadata.correspondent = aiCorrespondent;
        metadataUpdated = true;
      } else if (!correspondentManuallyEdited.current && props.metadata?.currentUser && nextMetadata.title.toLowerCase().includes('personal note')) {
        nextMetadata.correspondent = props.metadata.currentUser;
        metadataUpdated = true;
      }
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
    setRequiredFieldsAndRef(nextRequired);
    setOptionalFieldsAndRef(nextOptional);
    setMappedVisualFields(remainingVisual);
    /*
    if (metadataUpdated) {
      setLocalMetadataAndRef(nextMetadata);
    }
    */
    runValidation(localMetadata, nextRequired, nextOptional);
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
        correspondentManuallyEdited.current = false;

        const title = document?.title || '';
        let correspondent = document?.correspondent || '';
        const currentUser = document?.currentUser;
        if (!correspondent && currentUser && title.toLowerCase().includes('personal note')) {
          correspondent = currentUser;
        }
        setLocalMetadataAndRef({
          title,
          correspondent,
          createdDate: normalizeDateInput(document?.createdDate)
        });
        setLocalTagsAndRef(Array.isArray(document?.tagItems)
          ? document.tagItems.map((t: SmartTag) => ({ ...t }))
          : []);
        setAvailableTagsState(Array.isArray(document?.availableTags)
          ? document.availableTags.map((t: SmartTag) => ({ ...t }))
          : []);
        setRequiredFieldsAndRef([]);
        setOptionalFieldsAndRef([]);
        setMappedVisualFields([]);
        setOptionalExpanded(false);
        setValidationError(null);
        setValidationErrors(new Map());
        setDomainOverride(null);
        setProfileOverride(null);

        // T2c: Clear correspondent suggestions
        setCorrespondentSuggestions([]);
        setIsSuggestingCorrespondent(false);

        // T3a: Reset VIS_OCR state from new document metadata
        setSmVisOcrPages(Array.isArray(document?.visOcrPages) ? normalizeVisOcrPages(document.visOcrPages) : []);
        setSmVisOcrSource(typeof document?.visOcrSource === 'string' ? document.visOcrSource : '');
        setSmVisOcrQuality(
          typeof document?.visOcrQuality === 'number' && Number.isFinite(document.visOcrQuality)
            ? document.visOcrQuality
            : null
        );

        // T5: Clear tag source map and tag filter
        setTagSourceMap(new Map());
        setTagFilter('');

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

  // D1: vis-ocr:updated — react to OCR regeneration from OCR tab (T3a)
  useEffect(() => {
    const handleVisOcrUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { pages, source, quality } = detail as { pages?: unknown; source?: unknown; quality?: unknown };
      if (Array.isArray(pages)) {
        setSmVisOcrPages(normalizeVisOcrPages(pages));
      }
      if (source !== undefined) {
        setSmVisOcrSource(typeof source === 'string' ? source : '');
      }
      if (quality !== undefined) {
        setSmVisOcrQuality(typeof quality === 'number' && Number.isFinite(quality) ? quality : null);
      }
    };
    window.addEventListener('vis-ocr:updated', handleVisOcrUpdated as EventListener);
    return () => window.removeEventListener('vis-ocr:updated', handleVisOcrUpdated as EventListener);
  }, []);

  // D2: tag:drag-dropped — accept tag drops from document overlay (T5b)
  useEffect(() => {
    const handleTagDragDropped = async (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { tagId, tagName, color, bbox, page } = detail as {
        tagId?: number;
        tagName?: string;
        color?: string;
        bbox?: unknown;
        page?: number;
      };
      if (tagId == null) return;

      // Add tag to local selection
      handleAddTag(tagId);

      // Persist region annotation to visual-overlays API
      try {
        await fetch('/api/visual-overlays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: currentDocumentId,
            fieldId: `tag:${tagId}`,
            bbox,
            pageNumber: page
          })
        });
      } catch (err) {
        console.error('[SmartMetadata] Failed to save tag overlay:', err);
      }

      console.info(`[SmartMetadata] Tag '${tagName}' pinned to page ${page}`);
    };
    window.addEventListener('tag:drag-dropped', handleTagDragDropped as EventListener);
    return () => window.removeEventListener('tag:drag-dropped', handleTagDragDropped as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocumentId]);

  // D3: custom-field:draw-complete — add user-drawn field from document (T6)
  useEffect(() => {
    const handleDrawComplete = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const { tempFieldId, bbox, page, imageBase64 } = detail as {
        tempFieldId?: string;
        bbox?: unknown;
        page?: number;
        imageBase64?: string;
      };
      if (!tempFieldId) return;

      setOptionalFieldsAndRef(prev => [
        ...prev,
        {
          id: tempFieldId,
          fieldId: tempFieldId,
          label: '',
          value: '',
          bbox,
          pageNumber: page ?? null,
          imageBase64: imageBase64 || null,
          source: 'user_draw',
          pendingName: true
        } as unknown as SmartField
      ]);
    };
    window.addEventListener('custom-field:draw-complete', handleDrawComplete as EventListener);
    return () => window.removeEventListener('custom-field:draw-complete', handleDrawComplete as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLocate = (fieldId: string | number): void => {
    // T7: Visual ring feedback
    const fieldKey = String(fieldId);
    setLocatingFieldId(fieldKey);
    setTimeout(() => setLocatingFieldId(null), 2000);
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
    if (key === 'correspondent') {
      correspondentManuallyEdited.current = true;
    }

    const next = { ...localMetadata, [key]: val };

    // Apply "Personal Note" rule during manual typing if correspondent is still empty
    // and the user hasn't manually edited the correspondent field
    if (key === 'title' && !correspondentManuallyEdited.current && !next.correspondent && props.metadata?.currentUser && val.toLowerCase().includes('personal note')) {
      next.correspondent = props.metadata.currentUser;
    }

    setLocalMetadataAndRef(next);
    validateAndMarkDirty(next, requiredFields, optionalFields, localTags);
  };

  const handleAddTag = (tagId: number): void => {
    const tagToAdd = (Array.isArray(availableTagsState) ? availableTagsState : [])
      .find((t: SmartTag) => t.id === tagId);
    if (!tagToAdd || localTags.some((t: SmartTag) => t.id === tagId)) return;
    const nextTags = [...localTags, tagToAdd];
    setLocalTagsAndRef(nextTags);
    // T5: Mark as manually added
    setTagSourceMap(prev => new Map(prev).set(tagId, 'manual'));
    validateAndMarkDirty(localMetadata, requiredFields, optionalFields, nextTags);
    dispatchEventSafe('tags:updated', { documentId: currentDocumentId, tags: nextTags });
  };

  const handleRemoveTag = (tagId: number): void => {
    const nextTags = localTags.filter((t: SmartTag) => t.id !== tagId);
    setLocalTagsAndRef(nextTags);
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

  // F: Correspondent suggestion via OCR analysis (T2c)
  const fetchAndSuggestCorrespondents = async (): Promise<void> => {
    setIsSuggestingCorrespondent(true);
    setCorrespondentSuggestions([]);
    try {
      const res = await fetch('/api/documents/correspondents');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.correspondents)) return;

      const allNames: string[] = data.correspondents
        .map((c: unknown) => (typeof c === 'string' ? c : (c as Record<string, unknown>)?.name as string))
        .filter((n): n is string => Boolean(n));

      // Analyze OCR content + title for domain-specific patterns
      const ocrText = (props.metadata?.ocrContent || '') +
        ' ' + (localMetadata?.title || '');
      const domain = normalizeDomain(
        (props.metadata as Record<string, unknown>)?.domain as string ||
        (props.metadata as Record<string, unknown>)?.documentDomain as string ||
        resolvedProfile.domain
      );

      let patterns: RegExp[] = [];
      if (domain === 'financial') {
        patterns = [
          /Absender[:\s]+([^\n,]+)/i,
          /Von[:\s]+([^\n,]+)/i,
          /([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\s+(?:GmbH|AG|KG|SE|GbR|eV|e\.V\.))/g
        ];
      } else if (domain === 'medical') {
        patterns = [
          /(Dr\.\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/g,
          /(?:Praxis|Klinik|Krankenhaus)\s+([^\n,]+)/i
        ];
      } else if (domain === 'legal') {
        patterns = [
          /(?:Kanzlei|Rechtsanwalt)\s+([^\n,]+)/i
        ];
      } else {
        patterns = [
          /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/m
        ];
      }

      const extracted = new Set<string>();
      for (const pat of patterns) {
        const source = pat.flags.includes('g') ? pat : new RegExp(pat.source, 'gi');
        const matches = ocrText.matchAll(source);
        for (const m of matches) {
          const candidate = (m[1] || m[0]).trim();
          if (candidate.length > 2) extracted.add(candidate);
        }
      }

      // Fuzzy-match extracted candidates against real correspondent names
      const suggestions = allNames
        .filter(name => {
          const nameLower = name.toLowerCase();
          return Array.from(extracted).some(e =>
            nameLower.includes(e.toLowerCase()) || e.toLowerCase().includes(nameLower)
          );
        })
        .slice(0, 3);

      setCorrespondentSuggestions(suggestions.length > 0 ? suggestions : allNames.slice(0, 3));
    } catch (err) {
      console.error('[SmartMetadata] fetchAndSuggestCorrespondents error:', err);
    } finally {
      setIsSuggestingCorrespondent(false);
    }
  };

  const updateFieldValue = (fieldId: string, val: string) => {
    const nextRequired = requiredFields.map((field) => (
      String(field.id) === fieldId ? { ...field, value: val, isAiGenerated: false } : field
    ));
    const nextOptional = optionalFields.map((field) => (
      String(field.id) === fieldId ? { ...field, value: val, isAiGenerated: false } : field
    ));
    setRequiredFieldsAndRef(nextRequired);
    setOptionalFieldsAndRef(nextOptional);
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
        const mergedTags = (() => {
          const existingIds = new Set(localTagsRef.current.map((t: SmartTag) => t.id));
          const tagsToAdd = newTags.filter((t: SmartTag) => !existingIds.has(t.id));
          return [...localTagsRef.current, ...tagsToAdd];
        })();
        setLocalTagsAndRef(mergedTags);
        // T5: Mark AI-sourced tags
        setTagSourceMap(prev => {
          const next = new Map(prev);
          newTags.forEach((t: SmartTag) => {
            if (!next.has(t.id)) next.set(t.id, 'ai');
          });
          return next;
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
      const willSave = isDirtyRef.current;
      console.info(`[SmartMetadataIsland] onSaveRequest: saveId=${saveId}, willSave=${willSave}`);

      dispatchEventSafe('workspace:save-ack', { saveId, participantId, willSave });
      if (!willSave) return;

      const onSaveBegin = async (beginEvent: Event) => {
        const beginDetail = (beginEvent as CustomEvent<{ saveId?: string }>)?.detail || {};
        if (beginDetail.saveId !== saveId) return;

        console.info(`[SmartMetadataIsland] Committing metadata changes for doc ${currentDocumentId}`);

        try {
          if (validationError) throw new Error(validationError);

          // Read current values from refs to avoid stale closure captures.
          // These refs are updated synchronously alongside every state setter call.
          const currentMetadata = localMetadataRef.current;
          const currentTags = localTagsRef.current;
          const currentRequiredFields = requiredFieldsRef.current;
          const currentOptionalFields = optionalFieldsRef.current;

          // 1. Format updates for the orchestrator
          const document_updates: any = {
            title: currentMetadata.title,
            correspondent: currentMetadata.correspondent || null,
            created: currentMetadata.createdDate || null,
            tags: currentTags.map((t: SmartTag) => t.id),
            custom_fields: []
          };
          console.info('[SmartMetadata] document_updates:', JSON.stringify(document_updates));

          // Combine required and optional fields
          [...currentRequiredFields, ...currentOptionalFields].forEach((field: SmartField) => {
            if (field.paperlessField && field.paperlessField.startsWith('custom_field:')) {
              const fieldName = field.paperlessField.split(':')[1];
              document_updates.custom_fields.push({
                name: fieldName,
                value: field.value
              });
            }
          });

          // 2. Call orchestrator
          const response = await fetch('/api/processing/update-document', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Request-Id': saveId
            },
            body: JSON.stringify({
              documentId: currentDocumentId,
              document_updates,
              transactional: true
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update document in Paperless-ngx');
          }

          // 3. Success state
          isDirtyRef.current = false;
          try { 
            window.__smart_metadata_dirty = false; 
            if (typeof window !== 'undefined') {
              (window as any).__workspaceState = (window as any).__workspaceState || {};
              const key = String(currentDocumentId);
              (window as any).__workspaceState[key] = (window as any).__workspaceState[key] || {};
              (window as any).__workspaceState[key].isDirty = false;
            }
          } catch (err) { /* ignore */ }
          dispatchEventSafe('workspace:save-partial-complete', { saveId, participantId, success: true });
          
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[SmartMetadataIsland] Save failed:', msg, err);
          dispatchEventSafe('workspace:save-partial-complete', { saveId, participantId, success: false, message: msg });
        } finally {
          window.removeEventListener('workspace:save-begin', onSaveBegin as EventListener);
        }
      };

      window.addEventListener('workspace:save-begin', onSaveBegin as EventListener);
    }

    window.addEventListener('workspace:save-request', onSaveRequest as EventListener);
    return () => window.removeEventListener('workspace:save-request', onSaveRequest as EventListener);
  }, [currentDocumentId, props.saveDelayMs, validationError]);

  const domainMeta = resolveDomainMeta(resolvedProfile.domain);
  const availableTags: SmartTag[] = Array.isArray(availableTagsState) ? availableTagsState : [];
  const cappedAvailableTags = useMemo(
    () => selectTop20Tags(availableTags, localTags, resolvedProfile.domain),
    [availableTags, localTags, resolvedProfile.domain]
  );
  const domainHintCount = useMemo(
    () => {
      const priorities = getDomainPriorities(resolvedProfile.domain);
      return cappedAvailableTags.filter(t =>
        priorities.some(kw => t.name.toLowerCase().includes(kw.toLowerCase()))
      ).length;
    },
    [cappedAvailableTags, resolvedProfile.domain]
  );
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
  const overlayPortalTarget = typeof document !== 'undefined'
    ? document.body
    : null;
  const reprocessOverlay = showReprocessOverlay ? (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in"
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
  ) : null;

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
                <div className="flex items-center gap-1">
                  <label htmlFor="smart-correspondent-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correspondent</label>
                  {/* T2c: Wand button to trigger correspondent suggestion */}
                  <button
                    type="button"
                    data-testid="suggest-correspondent-btn"
                    onClick={fetchAndSuggestCorrespondents}
                    disabled={isSuggestingCorrespondent}
                    title="Suggest correspondents from document"
                    className="ml-1 text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSuggestingCorrespondent
                      ? <i className="fas fa-spinner fa-spin text-[10px]"></i>
                      : <i className="fas fa-magic text-[10px]"></i>}
                  </button>
                </div>
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
              {/* T2c: Correspondent suggestion chips */}
              {correspondentSuggestions.length > 0 && (
                <div data-testid="correspondent-suggestions" className="flex flex-wrap gap-1 mt-1">
                  {correspondentSuggestions.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setLocalMetadataAndRef({ ...localMetadata, correspondent: name });
                        correspondentManuallyEdited.current = true;
                        setCorrespondentSuggestions([]);
                      }}
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCorrespondentSuggestions([])}
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
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
            {/* T5: Selected tag chips — with color dot, AI badge, draggable, hover-remove */}
            {localTags.map((tag: SmartTag) => {
              const tagSource = tagSourceMap.get(tag.id);
              return (
                <div
                  key={tag.id}
                  draggable={true}
                  onDragStart={(e: DragEvent) => {
                    e.dataTransfer?.setData('application/paperless-tag', JSON.stringify({
                      id: tag.id, name: tag.name, color: tag.color
                    }));
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                  }}
                  data-testid={`tag-chip-${tag.id}`}
                  className="group flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all"
                  style={{
                    borderColor: tag.color || '#e2e8f0',
                    backgroundColor: tag.color ? `${tag.color}22` : undefined
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || '#94a3b8' }}
                  />
                  <span style={{ color: tag.color || '#475569' }}>{tag.name}</span>
                  {tagSource === 'ai' && (
                    <span className="text-[7px] font-black text-orange-500 border border-orange-200 rounded px-0.5">AI</span>
                  )}
                  <button
                    type="button"
                    draggable={false}
                    data-testid={`tag-remove-${tag.id}`}
                    onClick={(e: MouseEvent) => { e.stopPropagation(); handleRemoveTag(tag.id); }}
                    onMouseDown={(e: MouseEvent) => e.stopPropagation()}
                    className="hidden group-hover:inline text-slate-400 hover:text-rose-500 ml-0.5 leading-none transition-colors"
                    title={`Remove ${tag.name}`}
                  >×</button>
                </div>
              );
            })}
          </div>

          {/* T5 (Section J): Available tags pill cloud */}
          {cappedAvailableTags.length > 0 && (
            <div>
              {/* Filter input when there are more than 4 unselected tags */}
              {cappedAvailableTags.length > 4 && (
                <input
                  type="text"
                  placeholder="Filter tags..."
                  value={tagFilter}
                  onInput={(e: Event) => setTagFilter((e.target as HTMLInputElement).value)}
                  className="w-full text-[10px] px-2 py-1 rounded border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-300 mb-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                />
              )}
              {domainHintCount > 0 && (
                <div
                  data-testid="tag-cloud-domain-hint"
                  className="text-[9px] text-slate-400 dark:text-slate-500 mb-0.5 font-medium"
                >
                  {domainHintCount} tag{domainHintCount !== 1 ? "s" : ""} for {resolvedProfile.displayName || resolvedProfile.domain || "this domain"}
                </div>
              )}
              {/* Available tags as pill cloud */}
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {cappedAvailableTags
                  .filter((t: SmartTag) => !tagFilter || t.name.toLowerCase().includes(tagFilter.toLowerCase()))
                  .map((t: SmartTag) => (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`add-tag-pill-${t.id}`}
                      onClick={() => handleAddTag(t.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] border border-slate-200 bg-white hover:border-current transition-colors dark:bg-slate-900 dark:border-slate-700"
                      style={{ color: t.color || '#64748b' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color || '#94a3b8' }} />
                      {t.name}
                    </button>
                  ))
                }
                {/* Ghost chip domain default when no tags selected */}
                {localTags.length === 0 && (() => {
                  const ghostName = resolvedProfile.domain === 'financial' ? 'Rechnung'
                    : resolvedProfile.domain === 'medical' ? 'Attest'
                    : resolvedProfile.domain === 'legal' ? 'Vertrag'
                    : 'Dokument';
                  const ghostTag = availableTags.find((t: SmartTag) => t.name === ghostName);
                  if (!ghostTag || localTags.some((lt: SmartTag) => lt.id === ghostTag.id)) return null;
                  return (
                    <button
                      key="ghost-default"
                      type="button"
                      onClick={() => handleAddTag(ghostTag.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                    >
                      {ghostName}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {visOcrPages.length > 0 && (
          <div
            className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800"
            data-testid="vis-ocr-pages-panel"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <i className="fas fa-file-signature text-[10px] text-cyan-600 dark:text-cyan-400"></i>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  VIS OCR Pages
                </label>
              </div>
              <div
                className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-[9px] font-black text-cyan-700"
                data-testid="vis-ocr-page-count"
              >
                {visOcrPages.length}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {visOcrSource && (
                <span
                  className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-600 uppercase"
                  data-testid="vis-ocr-source"
                >
                  source: {visOcrSource}
                </span>
              )}
              {visOcrQuality !== null && (
                <span
                  className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-600 uppercase"
                  data-testid="vis-ocr-quality"
                >
                  quality: {visOcrQuality <= 1
                    ? `${Math.round(visOcrQuality * 100)}%`
                    : visOcrQuality}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {visOcrPages.map((page) => (
                <details
                  key={`vis-ocr-page-${page.pageNumber}`}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/60"
                  data-testid={`vis-ocr-page-${page.pageNumber}`}
                  open={page.pageNumber === 1}
                >
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <span>Page {page.pageNumber}</span>
                    <span className={page.success ? 'text-emerald-600' : 'text-rose-600'}>
                      {page.success ? 'Extracted' : 'Needs Review'}
                    </span>
                  </summary>
                  <pre
                    className="px-3 pb-3 text-[11px] leading-5 whitespace-pre-wrap break-words font-mono text-slate-600 dark:text-slate-300"
                    data-testid={`vis-ocr-page-text-${page.pageNumber}`}
                  >
                    {page.text || '[No text extracted for this page]'}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}
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
            // M: Locate ring feedback
            const isLocating = locatingFieldId === fieldKey;
            return (
              <div
                key={fieldKey}
                className={`group rounded-xl border transition-all p-4 ${error ? 'border-rose-200 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50'} ${isLocating ? 'ring-2 ring-cyan-400' : ''}`}
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
                    <i className={`fas fa-crosshairs text-xs ${isLocating ? 'fa-spin text-cyan-500' : ''}`}></i>
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
            const fieldAny = field as unknown as Record<string, unknown>;
            const isPending = Boolean(fieldAny.pendingName);

            // L: User-drawn custom field pending a name
            if (isPending) {
              return (
                <div
                  key={fieldKey}
                  data-testid={`pending-field-${toTestId(fieldKey)}`}
                  className="p-2 rounded-lg border-2 border-dashed border-cyan-300 bg-cyan-50/40"
                >
                  <input
                    type="text"
                    placeholder="Enter field name..."
                    className="w-full text-[11px] font-bold bg-transparent border-b border-cyan-300 focus:outline-none mb-1 text-cyan-800"
                    onBlur={(e: FocusEvent) => {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        setOptionalFieldsAndRef(prev => prev.map(f =>
                          f.id === field.id
                            ? { ...f, label: val, pendingName: false } as unknown as SmartField
                            : f
                        ));
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 text-[9px] text-cyan-600">
                    {fieldAny.bbox && (
                      <button
                        type="button"
                        onClick={() => onLocate(field.id)}
                        className="hover:text-cyan-800 flex items-center gap-1"
                      >
                        <i className="fas fa-crosshairs mr-1"></i>Locate
                      </button>
                    )}
                    <button type="button" className="hover:text-emerald-600"><i className="fas fa-thumbs-up"></i></button>
                    <button type="button" className="hover:text-rose-600"><i className="fas fa-thumbs-down"></i></button>
                  </div>
                </div>
              );
            }

            const error = validationErrors.get(fieldKey);
            const confidenceValue = typeof field.confidence === 'number' ? field.confidence : (field.mappingConfidence ?? null);
            const confidencePercent = confidenceValue !== null ? Math.round(confidenceValue * 100) : null;
            const matchType = (field.matchType as MatchType) || 'none';
            // M: Locate ring feedback
            const isLocating = locatingFieldId === fieldKey;
            return (
              <div
                key={fieldKey}
                className={`group rounded-xl border transition-all p-4 ${error ? 'border-rose-200 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50'} ${isLocating ? 'ring-2 ring-cyan-400' : ''}`}
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
                    <i className={`fas fa-crosshairs text-xs ${isLocating ? 'fa-spin text-cyan-500' : ''}`}></i>
                  </button>
                </div>
              </div>
            );
          })}

          {/* L: "Add Field from Document" draw button */}
          <button
            type="button"
            data-testid="add-custom-field-draw-btn"
            onClick={() => {
              const tempId = `custom_field_draw_${Date.now()}`;
              window.dispatchEvent(new CustomEvent('custom-field:draw-request', {
                detail: { documentId: currentDocumentId, tempFieldId: tempId }
              }));
            }}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-dashed border-cyan-300 text-cyan-600 hover:bg-cyan-50 mt-2 transition-colors"
          >
            <i className="fas fa-draw-polygon"></i> Add Field from Document
          </button>
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
          {/* K: Empty state — when no visual fields AND no vis-ocr pages, show CTA */}
          {mappedVisualFields.length === 0 && visOcrPages.length === 0 && (
            <div data-testid="no-visual-fields" className="text-center py-6 space-y-3">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No visual analysis available</div>
              <button
                type="button"
                data-testid="generate-high-res-cta"
                onClick={() => window.dispatchEvent(new CustomEvent('vis-ocr:request-generate', {
                  detail: { documentId: currentDocumentId }
                }))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <i className="fas fa-dna"></i> Generate High-Res Analysis
              </button>
            </div>
          )}

          {/* K: VIS_OCR accordion when vis-ocr pages exist but no overlay fields */}
          {mappedVisualFields.length === 0 && visOcrPages.length > 0 && (
            <div data-testid="vis-ocr-inline-pages" className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {visOcrPages.map(page => (
                <details
                  key={`vis-insights-page-${page.pageNumber}`}
                  open={page.pageNumber === 1}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-700"
                >
                  <summary className="cursor-pointer px-3 py-2 flex justify-between text-[10px] font-black uppercase text-slate-600">
                    <span>Page {page.pageNumber}</span>
                    <span className={page.success ? 'text-emerald-600' : 'text-rose-600'}>
                      {page.success ? 'Extracted' : 'Needs Review'}
                    </span>
                  </summary>
                  <pre className="px-3 pb-3 text-[11px] leading-5 whitespace-pre-wrap font-mono text-slate-600 dark:text-slate-300">
                    {page.text || '[No text for this page]'}
                  </pre>
                </details>
              ))}
            </div>
          )}
          {mappedVisualFields.map((field) => {
            const fieldKey = String(field.id);
            const matchType = (field.matchType as MatchType) || 'none';
            const isLocating = locatingFieldId === fieldKey;
            return (
              <div
                key={fieldKey}
                className={`group rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50 transition-all p-4${isLocating ? ' ring-2 ring-cyan-400' : ''}`}
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
                    <i className={`fas fa-crosshairs text-[10px]${isLocating ? ' fa-spin text-cyan-500' : ''}`}></i>
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

      {reprocessOverlay && (
        overlayPortalTarget
          ? createPortal(reprocessOverlay, overlayPortalTarget)
          : reprocessOverlay
      )}
    </div>
  );
}
