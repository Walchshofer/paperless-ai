The ADR has now been **fully updated to adopt *all* recommended options** and is internally consistent with the direction you’ve converged on.

### What changed (important highlights)

The updated ADR now explicitly commits to:

1. **Expert-oriented architecture**

   * Medical, financial, legal, technical, personal, general are first-class concepts.
   * Each expert has:

     * a dedicated schema profile
     * curated custom fields
     * domain-specific extraction rules.

2. **Field Profiler as a core component**

   * Inserted as a **mandatory step** between planning and extraction.
   * Backend-controlled, deterministic.
   * AI may assist *only* in selecting a profile ID from an allowlist.
   * Field names are never invented at runtime.

3. **Strict small-model discipline**

   * Short, directive prompts only.
   * JSON-only output everywhere.
   * Low temperature defaults.
   * No chain-of-thought or reasoning leakage.

4. **Vision planner → profiler → extractor pipeline**

   * Planner: classification + routing only.
   * Profiler: chooses minimal field set.
   * Extractor: fills fields, nothing else.

5. **Hard guarantees**

   * Text-only fallback is unconditional.
   * Visual-first must never block ingestion.
   * No persistent images.
   * No agents.
   * No external APIs.

This turns the ADR from a “design idea” into a **governance document** that future contributors can’t easily misinterpret.

---

### Why this is now a very strong position

You’ve effectively built a **software equivalent of a real office workflow**:

* Receptionist → *planner*
* Senior assistant → *field profiler*
* Specialist → *extractor*
* Clerk → *filename + storage rules*

But unlike agent systems, this is:

* debuggable,
* auditable,
* predictable,
* and safe for medical/legal automation.

---

### Suggested next concrete steps (no new design decisions needed)

1. **Freeze this ADR**
   Treat it as the authoritative spec for Visual-First routing.

2. **Implement the Field Profiler**

   * Start rule-based.
   * Add optional AI-assisted *profile selection only*.

3. **Extract schemas into dedicated files**

   * `fieldRegistry.json`
   * `profiles.json`
   * version them (`_v1`).

4. **Refactor `ollamaService.js`**

   * Split into:

     * router
     * profiler
     * extractor (text / vision)
   * Keep it in one file if you prefer—logical separation is enough.

If you want, next I can:

* design the **exact `FieldProfiler` class API + pseudo-code**,
* produce **ready-to-paste JSON schema files**,
* or give you a **migration checklist** so you can refactor incrementally without breaking the current system.

At this point, your architecture is no longer experimental—it’s *production-defensible*.
