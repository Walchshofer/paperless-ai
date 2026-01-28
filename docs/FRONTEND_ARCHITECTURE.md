# Frontend Architecture & Developer Guide

## Overview

The `paperless-ai` frontend is a **Multi-Page Application (MPA)** built on a traditional stack:

-   **Server-Side Rendering (SSR):** [Express.js](https://expressjs.com/) + [EJS (Embedded JavaScript)](https://ejs.co/).
-   **Client-Side Logic:** Vanilla JavaScript (ES6+) with a custom component pattern.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (CDN) + custom CSS files.
-   **No Build Step (Vanilla):** There is no build pipeline for legacy JS/CSS; files are served directly from `public/`. **Preact Islands** introduce a build step that outputs `public/js/dist/island-runtime.js` from `src/islands/`.

## Directory Structure

```text
paperless-ai/
├── views/                  # Server-side EJS templates
│   ├── layouts/            # Base HTML skeletons (if applicable)
│   ├── partials/           # Reusable EJS snippets (e.g., modals)
│   ├── chat.ejs            # Main Chat Interface
│   ├── dashboard.ejs       # Dashboard Page
│   ├── layout.ejs          # Global layout wrapper
│   └── ...                 # Other page templates
│
├── public/                 # Static Assets
│   ├── css/                # Stylesheets
│   │   ├── chat.css        # Chat-specific styles
│   │   ├── expert-components.css # Styles for JS components
│   │   └── ...
│   │
│   └── js/                 # Client-side Scripts
│       ├── chat.js         # Page controller for Chat
│       ├── dashboard.js    # Page controller for Dashboard
│       └── components/     # Reusable Vanilla JS classes
│           ├── ExpertMessage.js
│           ├── DocumentOverlay.js
│           ├── ThinkingAccordion.js
│           └── ...
```

## Core Technologies

1.  **EJS (Embedded JavaScript):**
    Used for composing HTML on the server. Data (like `documents` list, `user` info) is injected into templates at render time by Express controllers.

2.  **Tailwind CSS:**
    Loaded via CDN in `layout.ejs` (or individual page headers). Provides the utility-first styling framework.

3.  **Vanilla JS Component Pattern:**
    Since there is no bundler, "components" are implemented as **Global Classes** attached to the `window` object.
    
    *Example (`public/js/components/DocumentOverlay.js`):*
    ```javascript
    (function() {
      class DocumentOverlay {
        constructor(container) { ... }
        render(data) { ... }
      }
      window.DocumentOverlay = DocumentOverlay; // Export to global scope
    })();
    ```

## Page Architecture

Each major feature (Dashboard, Chat, Settings) corresponds to a specific **Route** -> **Controller** -> **View** flow.

### 1. Global Layout (`views/layout.ejs`)
The "shell" of the application. It typically handles:
-   `<html>`, `<head>`, `<body>` tags.
-   Global styles (Tailwind CDN).
-   Navigation Sidebar (often included directly or via partial).
-   `theme-toggle` logic.

### Settings Page (`views/settings.ejs` + `routes/settings.js`)
The Settings page is rendered server-side from `routes/settings.js` and must follow the **View Model Contract** rules in this document:
- The route should call `res.render('settings', { vm })` and expose a single `vm` object.
- The Zod contract for the settings page lives at `src/ui/contracts/Settings.contract.ts` and must be used as the parse gate before rendering.
- Templates should reference only `vm.*` fields and include `data-page="settings"` on the root element.

### 2. Chat Interface (`views/chat.ejs` + `public/js/chat.js`)
This is the most complex page, featuring the "Visual RAG" capabilities.

-   **Structure:**
    -   **Sidebar:** Navigation.
    -   **Main Area:**
        -   **Document Select:** Dropdown to switch contexts.
        -   **Chat Tab:** Conversation history and input.
        -   **Visual Tab:** High-res document preview with bounding box overlays.
-   **Key Components:**
    -   `ExpertMessage`: Renders AI responses, including "Thinking" blocks and citations.
    -   `ThinkingAccordion`: Collapsible UI for showing the AI's internal reasoning chain.
    -   `OverlayViewer`: Manages the image canvas for visual grounding.
    -   `DocumentOverlay`: Draws bounding boxes on top of the document image.
    -   `OrchestratorStatus`: Shows the real-time status of the AI pipeline (e.g., "Routing...", "Generating...").

### 3. Dashboard (`views/dashboard.ejs` + `public/js/dashboard.js`)
Displays system overview, recent documents, and stats.

## Component Reference (Vanilla JS)

These components are located in `public/js/components/`. They must be included via `<script>` tags in the EJS view *before* the main page script runs.

| Component | Description | Usage |
| :--- | :--- | :--- |
| **`ExpertMessage`** | Renders a rich chat bubble. Handles Markdown parsing (via `marked`), syntax highlighting (via `highlight.js`), and citation rendering. | `new ExpertMessage(data).render()` |
| **`ThinkingAccordion`** | A collapsible detail view for "Chain of Thought" or debug logs provided by the AI model. | `new ThinkingAccordion(container).addStep(...)` |
| **`DocumentOverlay`** | Low-level class for drawing bounding boxes (`x,y,w,h`) on a container. Handles coordinate normalization (0-1000 scale to %). | `new DocumentOverlay(el).render(boxes)` |
| **`OverlayViewer`** | Higher-level controller for the "Visual" tab. Manages the image loading and delegates drawing to `DocumentOverlay`. Adds built-in zoom & pan controls to assist precise selection and navigation. | `const viewer = new OverlayViewer(...)` |
| **`OrchestratorStatus`** | Displays a stepper or status indicator for the backend RAG pipeline stages. | `new OrchestratorStatus(el)` |
| **`FeedbackForm`** | (If implemented) Handles user thumbs up/down and text feedback for AI responses. | `new FeedbackForm(...)` |

## Styling Strategy

-   **Primary:** Tailwind CSS utility classes (e.g., `flex`, `p-4`, `bg-blue-500`).
-   **Custom:**
    -   `expert-components.css`: Specific complex styles for the Chat components (accordions, message bubbles) that are too verbose for inline Tailwind.
    -   `overlay-viewer.css`: Positioning logic for the document visualizer layers.
-   **CSS Modules (Islands Pilot):** For Preact islands, prefer locally-scoped CSS Modules (`*.module.css`) to avoid global leakage and enable deterministic builds. Use class name tokens and attribute selectors for ARIA-driven state (for example `button[aria-pressed="true"]`). Import CSS modules in TSX with a runtime-safe fallback during server/test runs (e.g., a `try { styles = require('./X.module.css') } catch {}` pattern) so server-side rendering & tests don't fail prior to bundling. Add a `src/types/css.d.ts` declaration for `*.module.css`.
-   **Theming:** Dark/Light mode is supported via a `data-theme` attribute on the `<html>` tag, toggled by local storage state.

## Data Flow & State

1.  **Initialization:**
    -   EJS templates render initial HTML state.
    -   Global variables (e.g., `documents`) are sometimes injected via `<script>` tags in the template: `const ALL_DOCS = <%- JSON.stringify(documents) %>;`.

2.  **Interactivity:**
    -   Page scripts (`chat.js`) attach event listeners to DOM elements.
    -   **API Calls:** `fetch()` is used to communicate with the backend (e.g., `/api/chat`, `/api/documents`).
    -   **State:** Managed in memory within the page script (e.g., `let currentDocumentId = null;`).

## Asset Management

-   **Images/Icons:** Stored in `public/` or `public/img/`.
-   **Font Awesome:** Loaded via CDN for icons.
-   **Markdown/Highlighting:** `marked.min.js` and `highlight.min.js` are loaded via CDN in `chat.ejs` and other relevant views.

## Development Workflow

1.  **Edit EJS:** Changes to `.ejs` files require a server restart (unless `nodemon` is handling the view engine reload, typically standard behavior).
2.  **Edit JS/CSS:** Changes to `public/` files are immediate on browser refresh (standard static file serving).
3.  **No Compilation:** You write standard ES6; no Babel or TypeScript transpilation is currently performed.

---

# Modernization: Preact Islands & Engineering Guardrails

To manage complexity while maintaining stability, we are adopting a strict "Islands" architecture coupled with formal engineering guardrails. This ensures the agent (and team) can build, verify, and maintain the UI without introducing stale fields or zombie code.

## 1. Engineering Policy: The "No Staleness" Mandate

To enable automated auditing and safe iteration, all UI development must adhere to three core constraints.

### A. View Model Contracts (No Stale Fields)
Instead of ad-hoc global injections, every page must render a single strict `vm` object validated by a Zod schema.

*   **Rule:** Server must render via `res.render("viewName", { vm })`.
*   **Rule:** Templates must only access data via `vm.*`.
    *   This includes `views/history-document.ejs`, which must not rely on
        ad-hoc locals like `title` or `documentId`.
*   **Implementation:**
    *   Define schemas in `src/ui/contracts/*.contract.ts` (using Zod).
    *   Validate data against the contract before rendering.
    *   Example: the history document page validates via
        `src/ui/contracts/HistoryDocument.contract.js` in
        `routes/history.js`.
    *   Example: the RAG page validates via
        `src/ui/contracts/RagPage.contract.js` in `server.js`
        (`/rag` route).
    *   Example: the dashboard page validates via
        `src/ui/contracts/Dashboard.contract.js` in `routes/setup.js`
        (`/dashboard` route).
    *   The RAG page must also mount islands via
        `/js/dist/island-runtime.js` (for the overlay island anchor).
    *   Island props may be intentionally nullable at first render
        (for example, `originalUrl: null` in the overlay viewer).
    *   **Build-Time Check:** Scripts must verify that EJS templates only reference fields defined in the contract.

### B. Element Identity (No Stale Elements)
To prevent "zombie buttons" and untestable UIs, every interactive element must be uniquely addressable.

*   **Rule:** Every page root must have `data-page="pageName"` (e.g., `data-page="chat"`).
*   **Rule:** Every interactive element (button, input, island anchor) must have `data-testid="feature-element"`.
*   **Naming Convention:** `kebab-case` (e.g., `chat-send-btn`, `doc-select-dropdown`).

### C. Automated Auditing (Runtime Verification)
An automated loop ensures the actual rendered UI matches expectations.

*   **Inventory Crawl:** A Playwright script visits pages and extracts all `data-testid`, form names, and `data-island` anchors.
*   **Snapshot Diffing:** This inventory is compared against a committed baseline (`tests/baselines/*.json`). Any unapproved drift triggers an alert.

## 2. Preact Islands Architecture

We use **Preact** for complex, stateful components (Chat, Visual Viewer) while keeping the EJS shell.

### Mounting Strategy: The Island Registry
Instead of manual script tags, we use a central registry to auto-mount islands. This allows the Auditor to verify that all intended islands are present.

**EJS Template:**
```html
<div data-page="chat">
  <!-- Island Anchor -->
  <div 
    data-island="thinking-accordion" 
    data-testid="thinking-accordion-island"
    data-props='<%- JSON.stringify(vm.thinkingProps) %>'
  ></div>

  <!-- Shared Island Runtime -->
  <script type="module">
    import { mountIslands } from '/js/dist/island-runtime.js'
    mountIslands(document.currentScript.parentElement)
  </script>
</div>
```

**Island Registry (`src/islands/runtime.browser.tsx`):**
```typescript
import { ThinkingAccordion } from './ThinkingAccordion.tsx'
/* ... imports ... */

const islandRegistry = {
  'thinking-accordion': ThinkingAccordion,
  /* ... mappings ... */
}

export function mountIslands(container: HTMLElement) {
  // Query [data-island], parse props, and render Preact components
}
```

### Build Configuration (Vite Library Mode)
We use Vite to generate deterministic bundles for each island, keeping bundle sizes small and predictable.

```typescript
// vite.config.ts
build: {
  lib: {
    entry: {
      'thinking-accordion': resolve(__dirname, 'src/islands/ThinkingAccordion.tsx'),
      'chat': resolve(__dirname, 'src/islands/Chat.tsx'),
      // ...
    },
    formats: ['es'],
    fileName: (format, entryName) => `${entryName}.island.js`,
  }
}
```

### Runtime Bundle Requirement (Alpha-9)
The islands runtime is built from `src/islands/runtime.browser.tsx` plus the
components in `src/islands/*`. The build output is served as
`public/js/dist/island-runtime.js` (ES module, Preact-based).

Pages that render `data-island` anchors must load the runtime once and call
`mountIslands()` (inline module script or a deferred loader). The runtime should
also auto-mount on `DOMContentLoaded` to cover full-page loads.

For document-scoped overlay clipping/search, pass `originalUrl` sourced from
`/manual/preview/:id` when available. Prefer
`normalized_original_url` (served by `/api/visual-rag/normalized/:docId?page=`
and rendered via `PDFRenderer`) so the visual tab uses the same page rendering
path as visual ingestion; fall back to `original_url` when normalization is
unavailable.

The Ollama model list endpoint (`/api/ollama/models`) must always return:
- installed models (`models`)
- configured placeholders (`placeholderModels`)
- configured expert aliases (`expertModels`)
even when the active provider is not `ollama`. Frontend dropdowns should
render placeholders with a clear "lazy load" or "not verified" affordance
instead of showing "Models unavailable".

Manual workflow contract:
- `ai:analysis-completed` may include `fields` and `documentType`.
- Manual workspace should dispatch both document metadata and document fields
  so sidebar tabs populate after analysis.
- Manual editor should mount within a dedicated "Manual Editor" card directly
  after document selection so metadata panels stay adjacent to the active
  document context.
- Manual metadata should not remain empty after a successful analysis pass.

Settings category gating:
- Settings sections should declare `data-settings-category="category-id"`.
- A single controller should listen for `settings:category-changed` and hide
  non-active sections, using `localStorage.settings:lastCategory` as the
  initial category fallback.

Settings page VM contract (doc-first guardrail):
- The settings route must render with a single parsed `vm` object:
  `res.render('settings', { vm })`.
- The root HTML element must include `data-page="settings"`.
- Interactive controls on the settings header must include stable test IDs:
  - API key container: `data-testid="settings-api-key"`
  - Regenerate button: `data-testid="settings-regenerate"`
- Settings templates must not read `config.*` directly. All template reads
  must go through `vm.*`, with a parse gate in the route.
- Recommended VM shape for settings:
  - `vm.config.disableGithubFetch`
  - `vm.settings.version`
  - `vm.settings.messages.success`
  - `vm.settings.messages.error`
  - `vm.settings.apiKey`
  - `vm.settings.aiProvider`
  - `vm.settings.connection.paperlessApiUrl`
  - `vm.settings.connection.paperlessUsername`
  - `vm.settings.ollama.apiUrl`
  - `vm.settings.ollama.model`
- Settings islands should receive their props via `vm.settings.*`:
  - Sidebar: `vm.settings.aiProvider`
  - Connection: `vm.settings.connection.*`
  - AI provider: `vm.settings.aiProvider`, `vm.settings.ollama.*`

Do not add duplicate inline scripts that manually dispatch
`overlay:document-changed` on page load; the island runtime and the overlay
viewer emit the authoritative events.

UI test policy (Docker/CI):
- Production builds should continue to omit devDependencies.
- UI tests require devDependencies (Vitest/Playwright). When building the
  `paperless-ai` image for tests, set `NPM_OMIT_DEV=0` and run Vitest in
  non-watch mode (for example, `npx vitest --run`).
- To avoid Vite's CJS deprecation noise in Vitest runs, set
  `VITE_CJS_IGNORE_WARNING=1` (the `test:ui` script should do this).

A minimal `public/js/island-runtime.js` fallback may exist for tests or
development scaffolding, but production pages must rely on the bundled runtime
as the source of truth.

Legacy `scripts/build-island-runtime.js` has been removed; use the islands
bundle build (Vite library mode) as the authoritative path.

## 3. Implementation Plan

### Phase 1: Infrastructure (Weeks 1-2)
*   **Goal:** Establish the build pipeline and contract validation.
*   **Actions:**
    *   Create `vite.config.ts` with library mode & named entry points.
    *   Create `src/ui/contracts/` and add Zod validation to Express controllers.
    *   Implement `src/islands/runtime.browser.tsx` (registry) and keep
        `src/islands/runtime.js` in sync for Node/tests.
    *   Add `scripts/check-contracts.js` for build-time verification.

### Phase 2: Pilot Island (Weeks 3-4)
*   **Goal:** Validate the workflow with `ThinkingAccordion`.
*   **Actions:**
    *   Convert `ThinkingAccordion.js` to `ThinkingAccordion.tsx`.
    *   Define `thinking-accordion.contract.ts`.
    *   Update `chat.ejs` to use `data-island`.
    *   Establish the Playwright audit baseline.

### Phase 3: Core Islands (Weeks 5-8)
*   **Goal:** Migrate Chat and Visual Viewer.
*   **Actions:**
    *   Create `Chat.tsx` and `VisualViewer.tsx`.
    *   Implement **Shared Signals** (`src/islands/shared-signals.ts`) for cross-island communication (e.g., hovering citations).
    *   Use Feature Flags (`vm.islands.chatEnabled`) for safe, percentage-based rollouts.

## 4. Agent Workflow

The AI Agent operates in three distinct modes to ensure quality:

### Mode A: Designer (Architect)
*   **Focus:** Information Architecture & System Design.
*   **Outputs:** EJS layout structure, Tailwind tokens, Page maps, Component interfaces (Props & Anchors).

### Mode B: Developer (Implementer)
*   **Focus:** Code Generation & Integration.
*   **Outputs:** Preact islands (`.tsx`), Zod contracts (`.contract.ts`), EJS templates with `data-island` anchors.

### Mode C: Auditor (Verifier)
*   **Focus:** Quality Assurance & Staleness Prevention.
*   **Actions:**
    *   **Contract Check:** Verifies `Template <-> Contract` alignment.
    *   **Inventory Crawl:** Runs Playwright to extract the runtime UI map.
    *   **Diff Analysis:** Compares current inventory against the baseline.
