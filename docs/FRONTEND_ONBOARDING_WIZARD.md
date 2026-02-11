# Onboarding Wizard Architecture

## Overview
The Onboarding Wizard (`/setup`) is the initial entry point for Paperless-AI. It guides the user through creating an admin account, connecting to Paperless-ngx, and configuring AI providers.

## Audience
- New users performing initial installation.
- Users who need to re-configure after a reset.

## Aesthetic Direction
**Theme**: "Material-ish Modern"
- Consistent with the primary dashboard but simplified to a centered single-column card layout.
- Clear step-based navigation (tabs + next/prev buttons).

## Differentiator
**Guided Tour**: Integration with Shepherd.js to provide context-sensitive help for every field in the setup process.

## Architecture
### EJS Regions
- **Navigation**: Simplified nav with logo and version.
- **Progress Bar**: Visual indicator of setup completion.
- **Main Form Card**: A multi-tab container managing:
  - User Setup (Admin credentials)
  - Connection (Paperless-ngx API)
  - AI Configuration (Provider selection + specific fields)
  - Advanced (Pipeline settings, Tags, Custom Fields)

### Stateful Island Boundaries
Currently, the Setup page is primarily **Vanilla JS** (`public/js/setup.js`).
- **Islands**: It includes several "ghost" islands from the settings page (Sidebar, Dashboard) which are currently inappropriately included and should be evaluated for removal to ensure a clean onboarding state.

## VM Contract
Defined in `src/ui/contracts/Setup.contract.ts`.
- `page`: literal 'setup'
- `version`: string
- `config`: object containing all setup fields (matches `SettingsSchema` structure for consistency).

## Implementation
- **Validation**: Client-side validation in `FormManager` and `TabManager`.
- **Persistence**: `POST /setup` persists to `.env` and initializes the SQLite database.
- **Restarts**: Application triggers a 5-second countdown and restart upon successful setup.
