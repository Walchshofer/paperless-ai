### 📄 Final content (copy & paste verbatim)


# Schema Evolution Guide

This document governs how schemas may evolve in the paperless-ai system.

Schemas are shared contracts across services. Changes must be deliberate,  
compatible, and auditable.

This document is authoritative and must be followed for any schema change.

---

## Covered Schemas

This guide applies to changes in:

- SYS_ROUTER_V1 output  
- ValidationEngine output  
- PromptRegistry output schemas  
- Guidance template variables and outputs  
- Visual RAG overlay schemas  
- Pipeline `primary_output` structures  
- Paperless PATCH payloads

---

## Core Rules

1. **No breaking changes by default**  
2. **Additive changes are preferred**  
3. **Absence-tolerant consumers are mandatory**  
4. **Feature flags before behavior changes**  
5. **Rollback must be possible**

If a change violates any rule above, it must be versioned explicitly.

---

## Versioning Strategy

### Allowed (Preferred)
- Add new optional fields  
- Extend objects with backward-compatible data  
- Dual-read logic

### Required (If Breaking)
- Schema version field (e.g. `schema_version`)  
- Parallel V1 / V2 fields  
- Feature-flagged rollout

---

## Example: Router Page-Level Signals

**Current**

```json
{
  "primary_domain": "financial",
  "quality_assessment": {
    "needs_rotation": false
  }
}
```

**Future (Additive)**

```json
{
  "primary_domain": "financial",
  "quality_assessment": {
    "needs_rotation": false
  },
  "pages": [
    {
      "page_number": 1,
      "has_table": true,
      "confidence": 0.92
    }
  ]
}
```

Rules:

- `pages` must be optional  
- Executor must fall back to document-level logic if absent  
- Targeted OCR must be feature-flagged

---

## Guidance Template Evolution (V1 → V2)

- V2 templates may change internal schema  
- PromptRegistry fallback remains V1-compatible  
- Executor must not assume V2 presence  
- Validation must accept both outputs

---

## Validation Schema Changes

- Field-level confidence extensions are allowed  
- Page-level attribution requires schema versioning  
- Retry semantics must not change implicitly

---

## Visual RAG Schema Changes

- Overlays must remain evidence-only  
- No extraction or OCR fields may be added  
- Missing overlays must not fail pipelines

---

## Required Process for Schema Changes

1. Update this document (or relevant section)  
2. Update `EXPERT_PIPELINE_DECISION_TABLE.md`  
3. Add or update tests  
4. Add migration / rollback notes  
5. Use the Schema Evolution Agent for implementation

---

## Non-Negotiable Guarantees

- Consumers must tolerate missing fields  
- Producers must not assume new fields are used  
- All schema changes must be documented
