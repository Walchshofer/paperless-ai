# Audit Remediation Plan (2026-01-31)

This document tracks the remediation of high-priority findings from the 2026-01-31 Architecture & Security Audit.

## 🚨 Blockers / Critical (Immediate Action)

| ID | Component | Issue | Owner | Status |
|----|-----------|-------|-------|--------|
| **T-001** | `HistoryTabsIsland.tsx` | Fix `aria-*` invalid usages (e.g. `aria-controls` pointing to non-existent ID). Run axe tests. | Frontend | ✅ Done |
| **T-002** | `OverlayViewerIsland.tsx` | Fix TypeScript compile errors (verify build passes). | Frontend | ✅ Done |
| **T-003** | `python-coverage.yml` | Fix CI failure (pip install issues). | Infra | ✅ Done |
| **T-004** | `SettingsSidebarIsland.tsx` | Fix accessibility visibility logic (`aria-hidden` vs `display:none`). | Frontend | ✅ Done |

## 🔶 High / Medium (Stability & Correctness)

| ID | Component | Issue | Owner | Status |
|----|-----------|-------|-------|--------|
| **T-005** | CI Workflows | Fix env/secret context access warnings in `alpha9-fast-audit.yml` & `verification-fast.yml`. | Infra | ✅ Done |
| **T-006** | `src/islands/*.tsx` | Replace `any` types with Zod schemas or strict interfaces (Technical Debt). | Frontend | 🔴 Open |
| **T-007** | `OverlayViewerIsland.tsx` | Remove unused `eslint-disable` and refine types (lines ~741-999). | Frontend | 🔴 Open |

## 🔷 Low / Minor (Style & Housekeeping)

| ID | Component | Issue | Owner | Status |
|----|-----------|-------|-------|--------|
| **T-008** | `unified-workspace.events.test.js` | Fix `no-unused-vars` (variable `seen`). | QA | 🔴 Open |
| **T-009** | E2E Tests | Replace `any` types in test specifications. | QA | 🔴 Open |

---

## Remediation Log

*   **2026-01-31**: Audit completed. Plan created. T-002 and T-003 verified as resolved. Started work on T-005.
*   **2026-01-31**: Resolved T-005 (CI Secrets), T-001 (HistoryTabs A11y), and T-004 (SettingsSidebar A11y).