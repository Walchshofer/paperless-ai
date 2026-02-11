# Settings Architecture: Pure Island Shell

> **Status: COMPLETED** — The migration from monolithic `routes/settings.js` to the pure island architecture is done.

## Architecture (Current State)

| Feature | Implementation |
|---------|---------------|
| **Shell Route** | `routes/system.js` (GET `/settings`) — minimal vm: user, page, version |
| **Settings API** | `routes/api/settings.js` (GET/POST `/api/settings/*`) — all data & saves |
| **Data Fetching** | Preact islands fetch via `/api/settings/config` on mount |
| **Saving** | Granular `POST /api/settings/save` |
| **Header** | `SettingsHeaderIsland` (Preact) |
| **Category Logic** | `SettingsSidebarIsland` (Internal State) |
| **Sections** | Individual Preact islands per section (Connection, AI Provider, Developer, Prompts) |

## Key Files

| Purpose | File |
|---------|------|
| Shell route | `routes/system.js` |
| Settings API | `routes/api/settings.js` |
| Settings template | `views/settings.ejs` |
| Settings contract | `src/ui/contracts/Settings.contract.ts` |
| Sidebar island | `src/islands/SettingsSidebarIsland.tsx` |
| Header island | `src/islands/SettingsHeaderIsland.tsx` |
| Connection island | `src/islands/ConnectionSettingsIsland.tsx` |
| AI Provider island | `src/islands/AIProviderIsland.tsx` |
| Developer island | `src/islands/DeveloperSettingsIsland.tsx` |
| Prompts island | `src/islands/PromptsSettingsIsland.tsx` |

## Completed Migration Steps

1. `routes/settings.js` deleted — shell route moved to `routes/system.js`.
2. All settings data served via `routes/api/settings.js` REST endpoints.
3. Preact islands fetch their own data on mount (no EJS `data-props` injection for config).
4. All saves go through `/api/settings/save`.
5. `SettingsHeaderIsland` handles API key display, blurring, copying, regeneration.
6. `SettingsSidebarIsland` handles category switching (internal state + `localStorage`).
