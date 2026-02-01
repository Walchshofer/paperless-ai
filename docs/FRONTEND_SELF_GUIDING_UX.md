# Self-Guiding Islands UX (Manual, Chat, History)

## Purpose and audience
Paperless-AI's manual, chat, and history surfaces exist for operators who need to validate, correct, and explain documents quickly. The islands-first redesign turns these pages into guided workspaces that move users from selection → understanding → action without guesswork, while preserving expert pipeline outcomes and visual evidence.

## Aesthetic direction (one)
Archivist Atelier: warm ivory base, graphite text, copper accents, and a subtle grid texture that feels like a curated archive rather than a SaaS dashboard.

## Differentiator
A persistent “Guided Rail” that narrates the next best action (select document, review evidence, confirm changes) and updates live as the user progresses.

## Information architecture
### Layout map (EJS structure)
- Global shell (sidebar + header) unchanged.
- Manual:
  - Guided Rail (top banner)
  - Document selector block
  - Preview workspace (text + visual panes)
  - Action stack (AI analysis + tags)
- Chat:
  - Guided Rail (top banner)
  - Document selector + model picker
  - Workspace tabs (Chat, Document, Visual) in one island
- History:
  - Guided Rail (top banner)
  - Filters + search
  - History table with action row controls
  - Visual preview modal (island-driven)

### Interaction map (clickable/stateful/island)
- Manual:
  - ViewModeToggleIsland: toggles preview panes
  - AIAnalysisIsland: triggers analysis, emits tags suggestions
  - TagsManagerIsland: edits tags + save
  - OverlayViewerIsland: visual navigation + selection (now includes zoom & pan controls for precise navigation and selection)
- Chat:
  - ChatWorkspaceIsland: document selection, chat streaming, document preview, visual preview
- History:
  - HistoryManagerIsland: filters, pagination, select-all, reanalyze/reset actions, overlay preview modal
  - OverlayViewerIsland (composed inside modal)

> Note: The unified workspace now loads without a pre-selected document by default. The `DocumentContextBarIsland` provides a prominent document selector at the top of the workspace; legacy behavior (auto-opening the most recent document) is still available via `/document?latest=1` for compatibility. (See route: `routes/document.js`).

## vm contract shape (fields only, grouped)
### Manual vm
- manual: { documentId, metadata, content, fields, originalUrl, pageCount }
- viewMode: { documentId, mode, visualEnabled }
- tags: { documentId, currentTags, suggestedTags, availableTags }
- ai: { documentId, content, gpuState }

### Chat vm
- chat: { openDocumentId, documents, aiProvider, ollamaDefaultModel }

### History vm
- history: { filters: { tags, correspondents }, initialQuery: { search, tag, correspondent, sort, page, pageSize } }

## Build-feasible implementation notes
- Tailwind utilities cover layout, cards, typography spacing, and banner states.
- Custom CSS required for:
  - Guided Rail gradient + subtle grid texture
  - Tab underline animation and focus ring style
  - Copper accent badges for tags and overlays
- Legacy JS removed from manual/chat/history pages; islands handle all interactions.
- OverlayViewerIsland reused for visual preview; no legacy OverlayViewer.js usage in these routes.
