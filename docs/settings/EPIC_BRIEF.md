# Epic Brief: Settings Page Modernization with Islands Architecture

## Problem Statement

The current settings page (file:views/settings.ejs) is functional but architecturally inconsistent with the recently completed Alpha-9 Native Protocol migration. While the Manual, History, and Playground routes now use modern Preact Islands architecture with Zod validation and event-driven communication, the settings page remains a monolithic EJS template with vanilla JavaScript.

### Core Problems

**1. Architectural Inconsistency**

- Settings page uses vanilla JavaScript classes (ThemeManager, FormManager, TagsManager)
- Other routes use Preact Islands with runtime mounting and Zod contracts
- Mixed patterns make maintenance harder and create knowledge silos
- New developers must learn two different frontend paradigms

**2. Limited Developer Experience**

- No developer-specific settings exposed in UI
- Critical configuration (timeouts, circuit breaker thresholds, feature flags) requires manual .env editing
- No visibility into runtime state (VRAM usage, circuit breaker status, Qdrant health)
- Debugging requires SSH access and log tailing

**3. Suboptimal UX Patterns**

- Long scrolling form with 50+ fields
- Poor information hierarchy (all settings at same level)
- Limited progressive disclosure (provider-specific settings hidden/shown)
- No preset configurations for common workflows
- No import/export for configuration backup/restore

**4. Maintenance Burden**

- 1,477 lines of EJS template with inline logic
- 949 lines of vanilla JavaScript with global classes
- No type safety or contract validation
- Adding new settings requires changes across 3 files (EJS, JS, CSS)

### Impact

**For Developers:**

- Cannot tune performance settings (circuit breaker, timeouts) without .env access
- Cannot toggle feature flags for testing
- Cannot inspect runtime state (VRAM, Qdrant, sidecar health)
- Slower iteration cycles (edit .env → restart → test)

**For Administrators:**

- Overwhelming settings page with poor organization
- No guidance for common configurations (Development, Production, Medical workflow)
- Risk of misconfiguration (no real-time validation)
- No backup/restore for settings

**For Maintainers:**

- Inconsistent architecture across routes
- Harder to onboard new developers (two frontend paradigms)
- Higher bug risk (no type safety, no contract validation)
- Slower feature development (manual DOM manipulation)

---

## Context & Background

### Current State

**Settings Page Implementation:**

- **Template**: file:views/settings.ejs (1,477 lines)
- **Client Script**: file:public/js/settings.js (949 lines)
- **Styling**: file:public/css/settings.css (825 lines)
- **Backend**: file:routes/setup.js (GET /settings, POST /settings)

**Settings Categories:**

1. **Connection**: Paperless-ngx API URL, token, username
2. **AI Provider**: OpenAI, Ollama, Custom, Azure with provider-specific settings
3. **Expert Models**: Medical, Financial, Legal domain experts with vision/analysis models
4. **Advanced**: Tags, AI restrictions, custom fields, system prompt
5. **Token Limits**: Context windows and response tokens for various models

**Current Tech Stack:**

- EJS templates with server-side rendering
- Vanilla JavaScript with class-based architecture
- Tailwind CSS via CDN (not built)
- SweetAlert2 for modals, Tippy.js for tooltips, Sortable.js for drag-and-drop

### Recent Architectural Evolution

**Alpha-9 Native Protocol Migration (Completed):**

- 61 tickets across 4 phases (6-7 months of work)
- Migrated Manual, History, Playground routes to Preact Islands
- Established Islands runtime (file:src/islands/runtime.js) with Zod validation
- Event bus for cross-island communication
- 6 islands: VisualAnnotation, FeedbackControls, ManualEditor, HistoryTabs, OverlayViewer, Playground

**Islands Architecture Benefits Proven:**

- ✅ Better state management and reactivity
- ✅ Type safety via Zod schemas
- ✅ Easier testing and validation
- ✅ Cleaner component isolation
- ✅ Event-driven cross-component communication

**Architectural Debt:**

- Settings page is the ONLY major route not using Islands
- Creates inconsistency and maintenance burden
- Missed opportunity to apply lessons learned from Alpha-9

### Strategic Drivers

**1. Architectural Consistency**

- Complete the Islands migration across all major routes
- Establish a single frontend paradigm for the entire application
- Reduce cognitive load for developers

**2. Developer Productivity**

- Expose developer settings in UI (no more .env editing)
- Enable rapid iteration (feature flags, performance tuning)
- Improve debugging (runtime state visibility)

**3. User Experience**

- Modern, intuitive settings interface
- Preset configurations for common workflows
- Import/export for backup/restore
- Real-time validation and feedback

**4. Maintainability**

- Type-safe components with Zod contracts
- Consistent patterns across codebase
- Easier to add new settings
- Better test coverage

---

## Stakeholders

### Primary Stakeholders

**1. Developers**

- **Needs**: Access to developer settings (feature flags, performance tuning, debug controls)
- **Pain Points**: Must edit .env files and restart app to change settings
- **Success Criteria**: Can toggle feature flags, adjust timeouts, and inspect runtime state via UI

**2. System Administrators**

- **Needs**: Easy configuration management, preset workflows, backup/restore
- **Pain Points**: Overwhelming settings page, risk of misconfiguration, no guidance
- **Success Criteria**: Can load presets (Development, Production, Medical), export/import configs, see validation errors immediately

**3. End Users (Indirect)**

- **Needs**: Stable, well-configured system
- **Pain Points**: System downtime from misconfigurations, slow performance from poor tuning
- **Success Criteria**: Fewer configuration-related issues, better system performance

### Secondary Stakeholders

**4. Maintainers**

- **Needs**: Consistent architecture, easy to extend, good test coverage
- **Pain Points**: Mixed frontend paradigms, hard to add new settings, no type safety
- **Success Criteria**: Single Islands architecture, Zod contracts, easier to add settings

**5. DevOps/Operations**

- **Needs**: Visibility into runtime state, performance metrics, health checks
- **Pain Points**: No UI for monitoring circuit breaker, VRAM usage, Qdrant health
- **Success Criteria**: Developer settings panel shows runtime state, health indicators

---

## Scope

### In Scope

**Phase 0: shadcn/ui Setup & Validation (2-3 days)**

- Install Tailwind CSS as build dependency (replace CDN)
- Install shadcn/ui and required components (Tabs, Card, Form, Input, Label, Switch, Select, Textarea)
- Configure Vite for Tailwind CSS compilation
- Test shadcn/ui components with Preact compatibility
- **Decision Gate**: If non-trivial incompatibilities found → pivot to Headless UI + Tailwind CSS
- Create `src/components/ui/` directory for shadcn components
- Validate TypeScript configuration with Preact compat

**Phase 1: Infrastructure (Week 1)**

- Create Zod schemas for all settings sections (Connection, AI, Expert, Advanced, Developer)
- Set up Islands runtime integration for settings page
- Create base SettingsSidebarIsland with tabbed/sidebar navigation
- Implement hot reload backend endpoint (`/api/settings/apply`)
- Define restart requirements for critical settings

**Phase 2: Core Settings Islands (Week 2-3)**

- **ConnectionSettingsIsland**: Paperless-ngx API configuration with connection test
- **AIProviderIsland**: Provider selector with progressive disclosure for provider-specific settings
- **ExpertModelsIsland**: Expert pipeline toggle with Medical/Financial/Legal domain configuration
- **AdvancedSettingsIsland**: Tags management, AI restrictions, custom fields (drag-and-drop), system prompt

**Phase 3: Developer Settings (Week 4)**

- **DeveloperSettingsIsland**: Toggle-gated panel (hidden by default, enabled via "Developer Mode" toggle)
- **Environment Variables UI**: Expose key env vars (API URLs, ports, feature flags) with validation
- **Debug/Logging Controls**: Log level selector, telemetry toggles
- **Feature Flags UI**: Toggle experimental features (Islands, visual RAG, expert pipeline)
- **Performance Tuning UI**: Adjust timeouts, circuit breaker thresholds, VRAM limits
- **Runtime State Visibility**: Display circuit breaker status, VRAM usage, Qdrant health, sidecar state

**Phase 4: Presets & Polish (Week 5)**

- **PresetsManagerIsland**: Load/save/export/import configurations
- **Predefined Presets**:
  - Development (Ollama, local services, debug logging)
  - Production (OpenAI, optimized settings, minimal logging)
  - Medical Workflow (Medical experts enabled, radiology models)
  - Financial Workflow (Financial experts enabled, VAT expert)
  - Legal Workflow (Legal experts enabled, orchestrator)
- **Export/Import**: JSON format with validation and conflict resolution
- **Animations & Transitions**: Smooth tab switching, progressive disclosure, loading states
- **Accessibility**: ARIA labels, keyboard navigation, focus management

### Out of Scope

**Not Included in This Epic:**

- Refactoring existing islands (Manual, History, Playground) to use shadcn/ui
- Migrating other routes (Dashboard, Chat) to Islands architecture
- Backend refactoring for hot reload (beyond `/api/settings/apply` endpoint)
- User authentication/authorization changes
- Database schema changes
- Multi-user settings (per-user configurations)

**Future Work:**

- Gradual migration of other routes to shadcn/ui (6-12 months)
- Advanced preset features (scheduled preset switching, A/B testing)
- Settings versioning and rollback
- Audit log for settings changes

---

## Success Criteria

### Functional Requirements

**1. Architectural Consistency** ✅

- Settings page uses Preact Islands architecture
- All islands have Zod contracts for validation
- Event bus for cross-island communication
- Consistent with Manual, History, Playground routes

**2. Developer Settings Exposed** ✅

- Environment variables editable via UI
- Feature flags toggleable without restart
- Performance tuning controls (timeouts, circuit breaker)
- Runtime state visibility (VRAM, circuit breaker, Qdrant health)
- Developer mode toggle-gated (hidden by default)

**3. Modern UX** ✅

- Tabbed/sidebar navigation with persistent state
- Real-time validation with inline error messages
- Progressive disclosure (show/hide based on context)
- Smooth animations and transitions
- Preset configurations (Development, Production, Medical, Financial, Legal)
- Export/import functionality

**4. Hot Reload** ✅

- Non-critical settings apply immediately (no restart)
- Critical settings (database, AI provider) show restart prompt
- Clear indication of which settings require restart
- Graceful restart flow with countdown

### Non-Functional Requirements

**Performance:**

- Settings page load time < 1 second
- Tab switching < 100ms
- Form validation < 50ms
- Bundle size < 150KB (optimized Tailwind + shadcn/ui)

**Accessibility:**

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactions
- Screen reader support (ARIA labels)
- Focus management (tab trapping in modals)

**Code Quality:**

- 80%+ test coverage (unit + integration)
- All Zod schemas validated
- ESLint passing (no warnings)
- TypeScript strict mode

**Maintainability:**

- Single source of truth for settings schema (Zod)
- Consistent patterns across all islands
- Easy to add new settings (add to schema + island)
- Comprehensive documentation

### Acceptance Criteria

**Phase 0 (shadcn/ui Validation):**

- [ ] Tailwind CSS installed as build dependency
- [ ] shadcn/ui components tested with Preact
- [ ] No blocking compatibility issues OR fallback to Headless UI decided
- [ ] Vite build pipeline working
- [ ] TypeScript compilation successful

**Phase 1 (Infrastructure):**

- [ ] Zod schemas defined for all settings sections
- [ ] SettingsSidebarIsland renders with navigation
- [ ] Hot reload endpoint (`/api/settings/apply`) implemented
- [ ] Restart requirements documented

**Phase 2 (Core Islands):**

- [ ] ConnectionSettingsIsland functional with connection test
- [ ] AIProviderIsland with progressive disclosure working
- [ ] ExpertModelsIsland with all domain experts configurable
- [ ] AdvancedSettingsIsland with tags, custom fields, system prompt

**Phase 3 (Developer Settings):**

- [ ] DeveloperSettingsIsland toggle-gated and functional
- [ ] Environment variables editable via UI
- [ ] Feature flags toggleable
- [ ] Performance tuning controls working
- [ ] Runtime state visibility (VRAM, circuit breaker, Qdrant)

**Phase 4 (Presets & Polish):**

- [ ] 5 predefined presets available (Development, Production, Medical, Financial, Legal)
- [ ] Export/import functionality working
- [ ] All animations smooth (< 100ms)
- [ ] WCAG 2.1 AA compliance verified
- [ ] 80%+ test coverage achieved

---

## Risks & Mitigation

### Risk 1: shadcn/ui Preact Compatibility (MEDIUM)

**Risk**: shadcn/ui is built for React, may have compatibility issues with Preact.

**Impact**: Could block implementation, require fallback to alternative UI library.

**Probability**: Medium (30-40%)

**Mitigation**:

- **Phase 0 Testing**: Dedicated 2-3 days to test key components (Tabs, Card, Form, Input)
- **Preact Compat Alias**: Configure Vite to alias React → Preact compat
- **Documented Fallback**: If non-trivial issues found → pivot to Headless UI + Tailwind CSS
- **Early Decision Gate**: Phase 0 ends with go/no-go decision on shadcn/ui

**Fallback Plan**:

```
IF Phase 0 reveals blocking issues:
  THEN pivot to Headless UI + Tailwind CSS
  - Headless UI officially supports Preact
  - Smaller bundle size (~30KB vs ~60KB)
  - Same Tailwind CSS styling approach
  - +1 week for custom component styling
```

### Risk 2: Bundle Size Impact (LOW)

**Risk**: Adding shadcn/ui and Tailwind CSS build could increase bundle size significantly.

**Impact**: Slower page load, poor performance on slow connections.

**Probability**: Low (10-20%)

**Mitigation**:

- **Tailwind PurgeCSS**: Remove unused styles (reduces from 300KB CDN to ~10-15KB)
- **Code Splitting**: Vite automatically splits islands into separate bundles
- **Tree Shaking**: Only import used components from Radix UI
- **Performance Budget**: Monitor bundle size, target < 150KB total
- **Lazy Loading**: Load developer settings island only when enabled

**Monitoring**:

- Track bundle size in CI/CD pipeline
- Alert if bundle exceeds 150KB
- Lighthouse performance score > 90

### Risk 3: Hot Reload Complexity (MEDIUM)

**Risk**: Implementing hot reload for settings without restart is complex and may introduce bugs.

**Impact**: Settings changes don't apply correctly, require manual restart anyway.

**Probability**: Medium (30-40%)

**Mitigation**:

- **Phased Approach**: Start with simple hot reload (token limits, tags), add complex settings incrementally
- **Clear Restart Requirements**: Document which settings require restart (database, AI provider)
- **Fallback to Restart**: If hot reload fails, show restart prompt (current behavior)
- **Comprehensive Testing**: Test all settings combinations with hot reload

**Scope Reduction**:

- If hot reload proves too complex, fall back to current restart behavior
- Focus on UX improvements (navigation, validation, presets) instead

### Risk 4: Developer Settings Security (LOW)

**Risk**: Exposing developer settings in UI could allow unauthorized users to misconfigure the system.

**Impact**: System instability, security vulnerabilities, data loss.

**Probability**: Low (10-15%)

**Mitigation**:

- **Toggle-Gated**: Developer mode hidden by default, requires explicit enable
- **localStorage Persistence**: Developer mode state persisted per-browser (not global)
- **Audit Logging**: Log all developer settings changes with timestamp and user
- **Validation**: Strict Zod validation prevents invalid values
- **Restart Warnings**: Critical changes show clear warnings before applying

**Future Enhancement**:

- Add password protection for developer mode (Phase 5+)
- Role-based access control (admin vs. user)

### Risk 5: Migration Effort Underestimation (MEDIUM)

**Risk**: 5-week timeline may be insufficient for full implementation.

**Impact**: Delayed delivery, incomplete features, technical debt.

**Probability**: Medium (30-40%)

**Mitigation**:

- **Phased Delivery**: Each phase delivers working functionality (can stop at any phase)
- **MVP Scope**: Phase 2 delivers core value (modern UI, Islands architecture)
- **Optional Phases**: Phase 3 (Developer Settings) and Phase 4 (Presets) are enhancements
- **Buffer Time**: Add 1-2 weeks buffer for testing and polish

**Scope Flexibility**:

```
Minimum Viable Product (MVP): Phase 0 + Phase 1 + Phase 2 (3 weeks)
  → Modern UI with Islands architecture, core settings functional

Full Feature Set: Phase 0-4 (5 weeks)
  → Developer settings, presets, export/import

Extended Timeline: Phase 0-4 + Buffer (6-7 weeks)
  → Full feature set with comprehensive testing and polish
```

---

## Dependencies

### Technical Dependencies

**Required (Must Have):**

- ✅ Preact (already installed: `preact@10.28.2`)
- ✅ Zod (already installed: `zod@3.22.2`)
- ✅ TypeScript (already configured)
- ✅ Vite (already configured: file:vite.config.ts)
- ✅ Islands Runtime (already implemented: file:src/islands/runtime.js)

**To Install (Phase 0):**

- Tailwind CSS as build dependency (`tailwindcss`, `postcss`, `autoprefixer`)
- shadcn/ui dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`)
- Radix UI primitives (`@radix-ui/react-tabs`, `@radix-ui/react-label`, `@radix-ui/react-switch`, etc.)
- **OR** Headless UI (if shadcn/ui fallback: `@headlessui/react`)

**Optional (Nice to Have):**

- `react-hook-form` for advanced form validation
- `zustand` for shared state management (if event bus proves insufficient)

### External Dependencies

**Backend Services:**

- Express.js server (file:server.js)
- Setup service (services/setup.js)
- Paperless service (services/paperless.js)
- Config file (file:config/config.js)

**API Endpoints:**

- `GET /settings` - Render settings page
- `POST /settings` - Save settings (existing)
- `POST /api/settings/apply` - Hot reload endpoint (new)
- `GET /api/settings/presets` - List available presets (new)
- `POST /api/settings/preset/:name` - Load preset (new)
- `GET /api/settings/export` - Export current config (new)
- `POST /api/settings/import` - Import config (new)

**Infrastructure:**

- PostgreSQL (metadata storage)
- Qdrant (vector storage)
- Redis (optional, for settings cache)
- Visual RAG Sidecar (for runtime state visibility)

### Workflow Dependencies

**Completed Work (Prerequisites):**

- ✅ Alpha-9 Native Protocol Migration (61 tickets, 4 phases)
- ✅ Islands Runtime established (file:src/islands/runtime.js)
- ✅ Zod validation patterns proven
- ✅ Event bus for cross-island communication
- ✅ Hybrid SOT architecture (PostgreSQL + Qdrant)

**Blocking Dependencies:**

- None (settings page is independent of other routes)

**Parallel Work Opportunities:**

- Can proceed while other features are being developed
- No conflicts with ongoing work

---

## Timeline & Effort Estimate

### Phase Breakdown


| Phase                           | Duration | Effort         | Deliverables                                            |
| ------------------------------- | -------- | -------------- | ------------------------------------------------------- |
| **Phase 0: shadcn/ui Setup**    | 2-3 days | 1 developer    | Tailwind build, shadcn/ui tested, fallback decision     |
| **Phase 1: Infrastructure**     | 1 week   | 1 developer    | Zod schemas, sidebar navigation, hot reload endpoint    |
| **Phase 2: Core Islands**       | 2 weeks  | 1-2 developers | Connection, AI, Expert, Advanced islands functional     |
| **Phase 3: Developer Settings** | 1 week   | 1 developer    | Developer panel, env vars, feature flags, runtime state |
| **Phase 4: Presets & Polish**   | 1 week   | 1 developer    | Presets, export/import, animations, accessibility       |
| **Buffer**                      | 1 week   | -              | Testing, bug fixes, documentation                       |


**Total Timeline**: 6-7 weeks (with buffer)

**Minimum Viable Product (MVP)**: 3 weeks (Phase 0 + Phase 1 + Phase 2)

### Resource Requirements

**Development:**

- 1 senior frontend developer (full-time, 6-7 weeks)
- OR 2 developers (parallel work on Phases 2-3, 4-5 weeks)

**Design:**

- 0.5 designer (part-time, Weeks 1-2 for wireframes and UX review)

**QA:**

- 0.5 QA engineer (part-time, Weeks 4-6 for testing)

**DevOps:**

- 0.25 DevOps (part-time, Phase 0 for build pipeline setup)

---

## Success Metrics

### Quantitative Metrics

**Performance:**

- Settings page load time < 1 second (currently ~2-3 seconds)
- Tab switching latency < 100ms
- Form validation latency < 50ms
- Bundle size < 150KB (currently ~340KB with Tailwind CDN)

**Code Quality:**

- Test coverage ≥ 80% (unit + integration)
- ESLint warnings = 0
- TypeScript strict mode passing
- Zod validation coverage = 100% (all settings validated)

**Developer Productivity:**

- Time to change feature flag: < 10 seconds (currently ~2 minutes with .env edit + restart)
- Time to adjust circuit breaker threshold: < 10 seconds (currently ~2 minutes)
- Time to inspect VRAM usage: < 5 seconds (currently requires SSH + logs)

**User Experience:**

- Settings save success rate > 99%
- Real-time validation error rate < 1% (catch errors before save)
- Preset load success rate > 99%
- User satisfaction score > 4/5 (survey after deployment)

### Qualitative Metrics

**Architectural Consistency:**

- All major routes use Islands architecture (Manual, History, Playground, Settings)
- Single frontend paradigm across codebase
- Consistent patterns for new features

**Developer Experience:**

- Developers can tune performance settings via UI
- Feature flags enable rapid experimentation
- Runtime state visibility improves debugging
- Reduced context switching (no .env editing)

**Maintainability:**

- Adding new settings is straightforward (add to schema + island)
- Type safety prevents common bugs
- Easier onboarding for new developers
- Better test coverage reduces regression risk

---

## Constraints & Assumptions

### Technical Constraints

**1. Preact Compatibility**

- **Constraint**: Must work with Preact, not React
- **Assumption**: shadcn/ui components can be adapted via Preact compat
- **Validation**: Phase 0 testing confirms compatibility
- **Fallback**: Headless UI if shadcn/ui doesn't work

**2. No Breaking Changes**

- **Constraint**: Existing settings must continue to work
- **Assumption**: Backend `/settings` POST endpoint remains compatible
- **Validation**: Integration tests verify backward compatibility

**3. Single-Tenant Architecture**

- **Constraint**: Settings are global (not per-user)
- **Assumption**: Only one admin user configures the system
- **Impact**: No multi-user settings, no role-based access control

### Operational Constraints

**1. Development Environment**

- **Constraint**: Must work in Docker Compose environment
- **Assumption**: Vite dev server can run alongside Express server
- **Validation**: Test in docker-compose.yml setup

**2. Production Deployment**

- **Constraint**: Must support existing deployment process
- **Assumption**: Built assets can be served from `public/` directory
- **Validation**: Test production build and deployment

### Business Constraints

**1. Timeline**

- **Constraint**: 6-7 weeks maximum (with buffer)
- **Assumption**: 1 senior developer full-time
- **Flexibility**: Can deliver MVP in 3 weeks if needed

**2. Scope**

- **Constraint**: Settings page only (no other routes)
- **Assumption**: Other routes can be migrated incrementally later
- **Flexibility**: Can extend to other routes in future epics

---

## Fallback Strategy

### Decision Gate: End of Phase 0

**Evaluation Criteria:**

1. Can shadcn/ui Tabs component render with Preact?
2. Can shadcn/ui Form components (Input, Label, Select) work with Preact?
3. Are TypeScript types compatible with Preact?
4. Is bundle size acceptable (< 150KB)?
5. Are there any blocking runtime errors?

**Decision Matrix:**


| Criteria            | Pass | Action                              |
| ------------------- | ---- | ----------------------------------- |
| All 5 criteria pass | ✅    | Proceed with shadcn/ui (Phases 1-4) |
| 1-2 criteria fail   | ⚠️   | Investigate workarounds, re-test    |
| 3+ criteria fail    | ❌    | Pivot to Headless UI + Tailwind CSS |


### Fallback: Headless UI + Tailwind CSS

**If shadcn/ui doesn't work:**

**Changes to Plan:**

- Replace shadcn/ui components with Headless UI equivalents
- Use Tailwind CSS for styling (same as shadcn/ui approach)
- Build custom component variants (no class-variance-authority)
- **Timeline Impact**: +1 week for custom styling (6-8 weeks total)

**Headless UI Components:**

- `@headlessui/react` (officially supports Preact)
- Tabs → `<Tab.Group>`, `<Tab.List>`, `<Tab.Panels>`
- Forms → Custom components with Tailwind CSS
- Modals → `<Dialog>`
- Switches → `<Switch>`

**Benefits of Fallback:**

- ✅ Proven Preact compatibility
- ✅ Smaller bundle size (~30KB vs ~60KB)
- ✅ Same Tailwind CSS styling approach
- ✅ Still achieves "state of the art UI" goal

**Trade-offs:**

- ❌ No pre-built form components (more custom work)
- ❌ Less comprehensive than shadcn/ui
- ❌ Manual theme management (no CSS variables)

---

## References

### Authoritative Documentation

- file:docs/FRONTEND_ARCHITECTURE.md - Islands architecture and engineering guardrails
- file:docs/EXPERT_PIPELINE_DECISION_TABLE.md - Expert pipeline configuration
- file:docs/QDRANT_MIGRATION.md - Hybrid SOT architecture
- file:docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md - Hardware profile and VRAM constraints

### Existing Implementation

- file:views/settings.ejs - Current settings template (1,477 lines)
- file:public/js/settings.js - Current client script (949 lines)
- file:public/css/settings.css - Current styling (825 lines)
- file:routes/setup.js - Backend routes (GET /settings, POST /settings)
- file:src/islands/runtime.js - Islands runtime with Zod validation
- file:src/islands/ManualEditorIsland.tsx - Example island implementation

### External Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Headless UI Documentation](https://headlessui.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Preact Compatibility Guide](https://preactjs.com/guide/v10/switching-to-preact/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

## Appendix: Current Settings Inventory

### Settings Categories (50+ fields)

**Connection (3 fields):**

- Paperless-ngx API URL
- API Token
- Username

**AI Provider (20+ fields):**

- Provider selector (OpenAI, Ollama, Custom, Azure)
- OpenAI: API key, model
- Ollama: URL, model, context window, response tokens
- Custom: API key, base URL, model
- Azure: Endpoint, API key, deployment name, API version

**Expert Models (30+ fields):**

- Expert pipeline toggle
- General: Planner model, Router model, Orchestrator model
- Medical: Vision model, Analysis model, Radiology model (+ token limits)
- Financial: Vision model, Analysis model, VAT expert model (+ token limits)
- Legal: Vision model, Analysis model, Orchestrator model (+ token limits)

**Advanced (15+ fields):**

- Scan interval
- Tags (show/hide, AI-processed tag, prompt tags)
- AI restrictions (existing tags, correspondents, document types)
- External API integration (URL, method, headers, body, timeout)
- AI function toggles (tagging, correspondents, types, title, custom fields)
- Custom fields (drag-and-drop list)
- System prompt (textarea)

**Developer Settings (New, 20+ fields):**

- Environment variables (API URLs, ports, feature flags)
- Debug/logging (log level, telemetry toggles)
- Feature flags (Islands, visual RAG, expert pipeline)
- Performance tuning (timeouts, circuit breaker thresholds, VRAM limits)
- Runtime state (VRAM usage, circuit breaker status, Qdrant health, sidecar state)

**Total**: ~85 settings fields across 5 categories

---

## Wireframes

### Settings Page Layout (Sidebar Navigation)

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; display: flex; height: 100vh; background: #f8fafc; }
  
  .sidebar { width: 240px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; }
  .sidebar-header { padding: 20px; border-bottom: 1px solid #e2e8f0; }
  .sidebar-title { font-size: 18px; font-weight: 600; color: #0f172a; }
  .sidebar-nav { flex: 1; padding: 12px 0; }
  .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 20px; color: #64748b; cursor: pointer; transition: all 0.2s; }
  .nav-item:hover { background: #f1f5f9; color: #0f172a; }
  .nav-item.active { background: #eff6ff; color: #3b82f6; border-right: 3px solid #3b82f6; }
  .nav-icon { width: 20px; text-align: center; }
  .sidebar-footer { padding: 16px 20px; border-top: 1px solid #e2e8f0; }
  .dev-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; }
  .toggle-switch { width: 36px; height: 20px; background: #cbd5e1; border-radius: 10px; position: relative; cursor: pointer; }
  .toggle-switch.active { background: #3b82f6; }
  .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
  .toggle-switch.active .toggle-knob { left: 18px; }
  
  .main-content { flex: 1; overflow-y: auto; padding: 32px; }
  .content-header { margin-bottom: 24px; }
  .content-title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
  .content-subtitle { font-size: 14px; color: #64748b; }
  
  .settings-card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
  .card-title { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card-icon { color: #3b82f6; }
  
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 14px; font-weight: 500; color: #334155; margin-bottom: 6px; }
  .form-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
  .form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .form-help { font-size: 12px; color: #64748b; margin-top: 4px; }
  
  .btn-primary { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #f1f5f9; color: #334155; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; }
  .btn-secondary:hover { background: #e2e8f0; }
</style>
</head>
<body>
  <!-- Sidebar Navigation -->
  <div class="sidebar" data-element-id="settings-sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">Settings</div>
    </div>
    
    <nav class="sidebar-nav">
      <div class="nav-item active" data-element-id="nav-connection">
        <span class="nav-icon">🔌</span>
        <span>Connection</span>
      </div>
      <div class="nav-item" data-element-id="nav-ai-provider">
        <span class="nav-icon">🤖</span>
        <span>AI Provider</span>
      </div>
      <div class="nav-item" data-element-id="nav-expert-models">
        <span class="nav-icon">🎓</span>
        <span>Expert Models</span>
      </div>
      <div class="nav-item" data-element-id="nav-advanced">
        <span class="nav-icon">⚙️</span>
        <span>Advanced</span>
      </div>
      <div class="nav-item" data-element-id="nav-developer" style="opacity: 0.5;">
        <span class="nav-icon">🔧</span>
        <span>Developer</span>
      </div>
    </nav>
    
    <div class="sidebar-footer">
      <div class="dev-toggle" data-element-id="developer-mode-toggle">
        <div class="toggle-switch">
          <div class="toggle-knob"></div>
        </div>
        <span>Developer Mode</span>
      </div>
    </div>
  </div>
  
  <!-- Main Content Area -->
  <div class="main-content" data-element-id="settings-content">
    <div class="content-header">
      <h1 class="content-title">Connection Settings</h1>
      <p class="content-subtitle">Configure connection to Paperless-ngx instance</p>
    </div>
    
    <!-- Connection Settings Card -->
    <div class="settings-card" data-element-id="connection-card">
      <h2 class="card-title">
        <span class="card-icon">🔌</span>
        Paperless-ngx API
      </h2>
      
      <div class="form-group">
        <label class="form-label" for="paperless-url">API URL</label>
        <input 
          type="text" 
          id="paperless-url" 
          class="form-input" 
          placeholder="http://paperless.example.com:8000"
          data-element-id="paperless-url-input"
        />
        <p class="form-help">URL of your Paperless-ngx instance (without /api)</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="paperless-token">API Token</label>
        <input 
          type="password" 
          id="paperless-token" 
          class="form-input" 
          placeholder="Enter your API token"
          data-element-id="paperless-token-input"
        />
        <p class="form-help">Authentication token from Paperless-ngx settings</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="paperless-username">Username (Optional)</label>
        <input 
          type="text" 
          id="paperless-username" 
          class="form-input" 
          placeholder="admin"
          data-element-id="paperless-username-input"
        />
        <p class="form-help">Your Paperless-ngx username</p>
      </div>
      
      <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button class="btn-secondary" data-element-id="test-connection-btn">Test Connection</button>
        <button class="btn-primary" data-element-id="save-connection-btn">Save Changes</button>
      </div>
    </div>
    
    <!-- Status Indicator -->
    <div class="settings-card" style="background: #f0fdf4; border: 1px solid #86efac;" data-element-id="status-card">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">✓</span>
        <div>
          <div style="font-weight: 600; color: #166534;">Connection Successful</div>
          <div style="font-size: 13px; color: #15803d;">Connected to Paperless-ngx v2.4.1</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

### Developer Settings Panel (Toggle-Gated)

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; padding: 32px; background: #f8fafc; }
  
  .dev-header { margin-bottom: 24px; }
  .dev-title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
  .dev-subtitle { font-size: 14px; color: #64748b; }
  .dev-warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .dev-warning-icon { font-size: 20px; }
  .dev-warning-text { font-size: 13px; color: #92400e; }
  
  .settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .settings-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card-title { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card-icon { font-size: 18px; }
  
  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 13px; font-weight: 500; color: #334155; margin-bottom: 6px; }
  .form-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
  .form-select { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: white; }
  
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: 13px; color: #334155; }
  .toggle-switch { width: 36px; height: 20px; background: #cbd5e1; border-radius: 10px; position: relative; cursor: pointer; }
  .toggle-switch.active { background: #3b82f6; }
  .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
  .toggle-switch.active .toggle-knob { left: 18px; }
  
  .runtime-state { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .state-item { background: #f8fafc; border-radius: 6px; padding: 12px; }
  .state-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .state-value { font-size: 16px; font-weight: 600; color: #0f172a; }
  .state-status { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .state-status.healthy { background: #22c55e; }
  .state-status.warning { background: #f59e0b; }
  .state-status.error { background: #ef4444; }
</style>
</head>
<body>
  <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
    <div class="dev-header">
      <h1 class="dev-title">Developer Settings</h1>
      <p class="dev-subtitle">Advanced configuration for development and debugging</p>
    </div>
    
    <div class="dev-warning" data-element-id="dev-warning">
      <span class="dev-warning-icon">⚠️</span>
      <div class="dev-warning-text">
        <strong>Warning:</strong> These settings are for advanced users only. Incorrect values may cause system instability.
      </div>
    </div>
    
    <div class="settings-grid">
      <!-- Environment Variables -->
      <div class="settings-card" data-element-id="env-vars-card">
        <h2 class="card-title">
          <span class="card-icon">📝</span>
          Environment Variables
        </h2>
        
        <div class="form-group">
          <label class="form-label">QDRANT_HOST</label>
          <input type="text" class="form-input" value="localhost" data-element-id="qdrant-host-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">QDRANT_PORT</label>
          <input type="text" class="form-input" value="6333" data-element-id="qdrant-port-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">VISUAL_RAG_SIDECAR_URL</label>
          <input type="text" class="form-input" value="http://localhost:8001" data-element-id="sidecar-url-input" />
        </div>
      </div>
      
      <!-- Debug & Logging -->
      <div class="settings-card" data-element-id="debug-card">
        <h2 class="card-title">
          <span class="card-icon">🐛</span>
          Debug & Logging
        </h2>
        
        <div class="form-group">
          <label class="form-label">Log Level</label>
          <select class="form-select" data-element-id="log-level-select">
            <option>info</option>
            <option>debug</option>
            <option>warn</option>
            <option>error</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Telemetry</label>
          <div class="toggle-row">
            <span class="toggle-label">Enable Telemetry</span>
            <div class="toggle-switch active" data-element-id="telemetry-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Feature Flags -->
      <div class="settings-card" data-element-id="feature-flags-card">
        <h2 class="card-title">
          <span class="card-icon">🚩</span>
          Feature Flags
        </h2>
        
        <div class="toggle-row">
          <span class="toggle-label">Islands Architecture</span>
          <div class="toggle-switch active" data-element-id="islands-flag">
            <div class="toggle-knob"></div>
          </div>
        </div>
        
        <div class="toggle-row">
          <span class="toggle-label">Visual RAG</span>
          <div class="toggle-switch active" data-element-id="visual-rag-flag">
            <div class="toggle-knob"></div>
          </div>
        </div>
        
        <div class="toggle-row">
          <span class="toggle-label">Expert Pipeline</span>
          <div class="toggle-switch active" data-element-id="expert-pipeline-flag">
            <div class="toggle-knob"></div>
          </div>
        </div>
        
        <div class="toggle-row">
          <span class="toggle-label">Background Sync Job</span>
          <div class="toggle-switch active" data-element-id="sync-job-flag">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>
      
      <!-- Performance Tuning -->
      <div class="settings-card" data-element-id="performance-card">
        <h2 class="card-title">
          <span class="card-icon">⚡</span>
          Performance Tuning
        </h2>
        
        <div class="form-group">
          <label class="form-label">Circuit Breaker Threshold</label>
          <input type="number" class="form-input" value="3" data-element-id="circuit-threshold-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Circuit Breaker Cooldown (seconds)</label>
          <input type="number" class="form-input" value="30" data-element-id="circuit-cooldown-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Sidecar Timeout (ms)</label>
          <input type="number" class="form-input" value="5000" data-element-id="sidecar-timeout-input" />
        </div>
        
        <div class="form-group">
          <label class="form-label">VRAM Limit (GB)</label>
          <input type="number" class="form-input" value="20" data-element-id="vram-limit-input" />
        </div>
      </div>
      
      <!-- Runtime State (Full Width) -->
      <div class="settings-card" style="grid-column: span 2;" data-element-id="runtime-state-card">
        <h2 class="card-title">
          <span class="card-icon">📊</span>
          Runtime State
        </h2>
        
        <div class="runtime-state">
          <div class="state-item" data-element-id="vram-state">
            <div class="state-label">VRAM Usage</div>
            <div class="state-value">
              <span class="state-status healthy"></span>
              3.5 GB / 24 GB
            </div>
          </div>
          
          <div class="state-item" data-element-id="circuit-state">
            <div class="state-label">Circuit Breaker</div>
            <div class="state-value">
              <span class="state-status healthy"></span>
              CLOSED
            </div>
          </div>
          
          <div class="state-item" data-element-id="qdrant-state">
            <div class="state-label">Qdrant Status</div>
            <div class="state-value">
              <span class="state-status healthy"></span>
              Connected
            </div>
          </div>
          
          <div class="state-item" data-element-id="sidecar-state">
            <div class="state-label">Visual Sidecar</div>
            <div class="state-value">
              <span class="state-status healthy"></span>
              Ready
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
      <button class="btn-secondary" data-element-id="reset-btn">Reset to Defaults</button>
      <button class="btn-primary" data-element-id="save-dev-settings-btn">Save Developer Settings</button>
    </div>
  </div>
</body>
</html>
```

### Presets Manager Modal

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; padding: 40px; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  
  .modal { background: white; border-radius: 12px; width: 600px; max-height: 80vh; overflow: hidden; box-shadow: 0 20px 25px rgba(0,0,0,0.15); }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
  .modal-title { font-size: 20px; font-weight: 600; color: #0f172a; }
  .modal-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
  .modal-content { padding: 24px; max-height: 500px; overflow-y: auto; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; gap: 12px; justify-content: flex-end; }
  
  .preset-list { display: flex; flex-direction: column; gap: 12px; }
  .preset-item { border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s; }
  .preset-item:hover { border-color: #3b82f6; background: #f8fafc; }
  .preset-item.selected { border-color: #3b82f6; background: #eff6ff; }
  .preset-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .preset-icon { font-size: 24px; }
  .preset-name { font-size: 16px; font-weight: 600; color: #0f172a; }
  .preset-badge { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .preset-description { font-size: 13px; color: #64748b; line-height: 1.5; }
  .preset-details { margin-top: 8px; font-size: 12px; color: #94a3b8; }
  
  .btn { padding: 10px 20px; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 14px; }
  .btn-cancel { background: #f1f5f9; color: #334155; }
  .btn-cancel:hover { background: #e2e8f0; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { background: #cbd5e1; cursor: not-allowed; }
</style>
</head>
<body>
  <div class="modal" data-element-id="presets-modal">
    <div class="modal-header">
      <h2 class="modal-title">Load Configuration Preset</h2>
      <p class="modal-subtitle">Choose a predefined configuration for your workflow</p>
    </div>
    
    <div class="modal-content">
      <div class="preset-list">
        <!-- Development Preset -->
        <div class="preset-item selected" data-element-id="preset-development">
          <div class="preset-header">
            <span class="preset-icon">💻</span>
            <span class="preset-name">Development</span>
            <span class="preset-badge">RECOMMENDED</span>
          </div>
          <p class="preset-description">
            Local development setup with Ollama, debug logging enabled, and relaxed validation. 
            Optimized for rapid iteration and testing.
          </p>
          <p class="preset-details">
            • Ollama (local) • Debug logging • Feature flags enabled • Low timeouts
          </p>
        </div>
        
        <!-- Production Preset -->
        <div class="preset-item" data-element-id="preset-production">
          <div class="preset-header">
            <span class="preset-icon">🚀</span>
            <span class="preset-name">Production</span>
          </div>
          <p class="preset-description">
            Production-ready configuration with OpenAI, optimized performance settings, 
            and minimal logging. Suitable for live deployments.
          </p>
          <p class="preset-details">
            • OpenAI (cloud) • Info logging • Strict validation • High timeouts
          </p>
        </div>
        
        <!-- Medical Workflow Preset -->
        <div class="preset-item" data-element-id="preset-medical">
          <div class="preset-header">
            <span class="preset-icon">🏥</span>
            <span class="preset-name">Medical Workflow</span>
          </div>
          <p class="preset-description">
            Specialized configuration for medical documents with medical expert models, 
            radiology vision, and healthcare-specific validation.
          </p>
          <p class="preset-details">
            • Medical experts enabled • Radiology model • HIPAA-compliant logging
          </p>
        </div>
        
        <!-- Financial Workflow Preset -->
        <div class="preset-item" data-element-id="preset-financial">
          <div class="preset-header">
            <span class="preset-icon">💰</span>
            <span class="preset-name">Financial Workflow</span>
          </div>
          <p class="preset-description">
            Optimized for financial documents with financial expert models, VAT expert, 
            and accounting-specific field extraction.
          </p>
          <p class="preset-details">
            • Financial experts enabled • VAT expert • Currency field support
          </p>
        </div>
        
        <!-- Legal Workflow Preset -->
        <div class="preset-item" data-element-id="preset-legal">
          <div class="preset-header">
            <span class="preset-icon">⚖️</span>
            <span class="preset-name">Legal Workflow</span>
          </div>
          <p class="preset-description">
            Configured for legal documents with legal expert models, contract analysis, 
            and compliance-focused processing.
          </p>
          <p class="preset-details">
            • Legal experts enabled • Contract analysis • Compliance logging
          </p>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-cancel" data-element-id="cancel-preset-btn">Cancel</button>
      <button class="btn btn-primary" data-element-id="load-preset-btn">Load Preset</button>
    </div>
  </div>
</body>
</html>
```

### AI Provider Settings (Progressive Disclosure)

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; padding: 32px; background: #f8fafc; }
  
  .settings-card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 700px; }
  .card-title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
  .card-icon { font-size: 22px; }
  
  .form-group { margin-bottom: 20px; }
  .form-label { display: block; font-size: 14px; font-weight: 500; color: #334155; margin-bottom: 6px; }
  .form-select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; }
  .form-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
  .form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .form-help { font-size: 12px; color: #64748b; margin-top: 4px; }
  
  .provider-section { background: #f8fafc; border-radius: 8px; padding: 20px; margin-top: 16px; border: 1px solid #e2e8f0; }
  .provider-section-title { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
  
  .provider-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  
  .info-banner { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: start; gap: 12px; }
  .info-icon { font-size: 18px; color: #1e40af; }
  .info-text { font-size: 13px; color: #1e3a8a; line-height: 1.5; }
</style>
</head>
<body>
  <div class="settings-card" data-element-id="ai-provider-card">
    <h2 class="card-title">
      <span class="card-icon">🤖</span>
      AI Provider Configuration
    </h2>
    
    <div class="form-group">
      <label class="form-label" for="ai-provider-select">Select AI Provider</label>
      <select id="ai-provider-select" class="form-select" data-element-id="ai-provider-select">
        <option value="openai">OpenAI</option>
        <option value="ollama" selected>Ollama (Local)</option>
        <option value="custom">Custom Provider</option>
        <option value="azure">Azure OpenAI</option>
      </select>
      <p class="form-help">Choose the AI provider for document analysis</p>
    </div>
    
    <!-- Ollama-Specific Settings (Progressive Disclosure) -->
    <div class="provider-section" data-element-id="ollama-settings">
      <div class="info-banner">
        <span class="info-icon">ℹ️</span>
        <div class="info-text">
          <strong>Ollama Configuration:</strong> Using local Ollama instance. 
          Ensure Ollama is running at the specified URL with required models installed.
        </div>
      </div>
      
      <div class="provider-section-title">Ollama Settings</div>
      
      <div class="form-group">
        <label class="form-label" for="ollama-url">Ollama API URL</label>
        <input 
          type="text" 
          id="ollama-url" 
          class="form-input" 
          value="http://host.docker.internal:11434"
          data-element-id="ollama-url-input"
        />
        <p class="form-help">URL of your Ollama instance</p>
      </div>
      
      <div class="provider-grid">
        <div class="form-group">
          <label class="form-label" for="ollama-model">Default Model</label>
          <input 
            type="text" 
            id="ollama-model" 
            class="form-input" 
            value="sauerkraut-llama3.1:8b"
            data-element-id="ollama-model-input"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="ollama-context">Context Window</label>
          <input 
            type="number" 
            id="ollama-context" 
            class="form-input" 
            value="128000"
            data-element-id="ollama-context-input"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="ollama-response">Max Response Tokens</label>
          <input 
            type="number" 
            id="ollama-response" 
            class="form-input" 
            value="4096"
            data-element-id="ollama-response-input"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="ollama-vision">Vision Model</label>
          <input 
            type="text" 
            id="ollama-vision" 
            class="form-input" 
            value="qwen3-vl:8b"
            data-element-id="ollama-vision-input"
          />
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## Architecture Overview

```mermaid
graph TD
    A[Settings Page EJS Shell] --> B[SettingsSidebarIsland]
    B --> C[ConnectionSettingsIsland]
    B --> D[AIProviderIsland]
    B --> E[ExpertModelsIsland]
    B --> F[AdvancedSettingsIsland]
    B --> G[DeveloperSettingsIsland]
    B --> H[PresetsManagerIsland]
    
    C --> I[Event Bus]
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I
    
    I --> J[Backend API]
    J --> K[/api/settings/apply]
    J --> L[/api/settings/presets]
    J --> M[/api/settings/export]
    J --> N[/api/settings/import]
    
    K --> O[Hot Reload or Restart]
    L --> P[Load Preset Config]
    M --> Q[Export JSON]
    N --> R[Import & Validate]
    
    style G fill:#fef3c7
    style H fill:#dbeafe
    style O fill:#fecaca
```

---

## Next Steps

After Epic Brief approval, proceed with:

1. **Core Flows**: Define user flows for settings navigation, editing, validation, presets, and developer mode
2. **Tech Plan**: Detail Islands architecture, Zod schemas, event bus, shadcn/ui integration, and backend endpoints
3. **Ticket Breakdown**: Create implementation tickets for Phases 0-4

Alternatively, begin implementation using Phases mode, Plan mode, or direct agent handoff once specs are complete.