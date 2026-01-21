# Core Flows: Settings Page Navigation, Editing, and Developer Mode

This document defines the user flows for the modernized Settings Page with Islands architecture, shadcn/ui components, and developer settings panel.

---

## Flow 1: Initial Settings Access & Overview Dashboard

**Description**: User navigates to settings and sees an overview dashboard with quick actions.

**Entry Point**: User clicks "Settings" in sidebar navigation or navigates to `/settings`

**Steps**:

1. **Page Load**
  - Settings page loads with sidebar navigation on left
  - Main content area shows Overview dashboard
  - Sidebar shows categories: Overview, Connection, AI Provider, Expert Models, Advanced, Developer (if enabled)
  - Sidebar footer shows "🔧 Developer Mode" toggle (off by default)
2. **Overview Dashboard Display**
  - Summary cards for each category:
    - **Connection Card**: Shows API URL, connection status (✓ Connected / ✗ Not Connected), "Test Connection" button
    - **AI Provider Card**: Shows current provider (e.g., "OpenAI"), model name, "Switch Provider" dropdown
    - **Expert Pipeline Card**: Shows status (Enabled/Disabled), domain count (e.g., "3 domains configured"), "Configure Experts" link
    - **Advanced Card**: Shows key settings (Tags count, Custom fields count), "Manage Advanced" link
  - Quick action buttons at top: "Load Preset", "Export Config", "Import Config"
3. **Quick Actions from Overview**
  - User clicks "Test Connection" → inline validation, shows ✓ or ✗ with message
  - User clicks "Switch Provider" dropdown → selects provider → navigates to AI Provider category
  - User clicks "Load Preset" → opens preset selection modal (Flow 7)
  - User clicks "Export Config" → downloads .env file (Flow 8)
  - User clicks category link → navigates to that category
4. **Navigation to Category**
  - User clicks category in sidebar or quick link in card
  - Main content area transitions to selected category
  - Sidebar highlights active category
  - URL updates with hash (e.g., `/settings#ai-provider`)

**Exit Point**: User navigates to specific category or closes settings page

**Edge Cases**:

- If connection not configured, Connection card shows warning badge
- If expert pipeline disabled, Expert Pipeline card shows "Disabled" state
- If developer mode enabled, Developer category appears in sidebar

---

## Flow 2: Connection Settings Configuration

**Description**: User configures Paperless-ngx API connection with validation.

**Entry Point**: User navigates to Connection category from Overview or sidebar

**Steps**:

1. **Connection Category Display**
  - Main content shows Connection settings form
  - Fields: API URL (text input), API Token (password input with show/hide toggle), Username (text input, optional)
  - "Test Connection" button (primary action)
  - "Save Connection Settings" button (secondary action)
  - ⚠️ Restart Required badge visible on all fields
2. **Edit Connection Settings**
  - User enters/modifies API URL
  - Real-time validation: URL format check (must start with http:// or https://)
  - Inline error if invalid format
  - User enters/modifies API Token
  - Password field with eye icon to toggle visibility
3. **Test Connection**
  - User clicks "Test Connection" button
  - Button shows loading spinner: "Testing..."
  - Backend validates connection to Paperless-ngx API
  - **Success**: Green checkmark appears next to URL field, toast notification "Connection successful ✓"
  - **Failure**: Red X appears, inline error message "Connection failed: [reason]"
4. **Save Connection Settings**
  - User clicks "Save Connection Settings" button
  - Button text changes to "Save & Restart" (restart required)
  - Confirmation modal: "Saving connection settings requires application restart. Continue?"
  - User confirms → settings saved → restart countdown modal (5 seconds)
  - Countdown completes → page reloads

**Exit Point**: Settings saved and application restarted, or user navigates away

**Edge Cases**:

- If user navigates away before saving, auto-save triggers (saves to backend)
- If connection test fails, save button remains enabled (user can save anyway)
- If backend is unreachable, show error toast with retry option

---

## Flow 3: AI Provider Configuration with Progressive Disclosure

**Description**: User selects AI provider and configures provider-specific settings using tabs.

**Entry Point**: User navigates to AI Provider category from Overview or sidebar

**Steps**:

1. **AI Provider Category Display**
  - Main content shows AI Provider settings with tabs: General, OpenAI, Ollama, Custom, Azure
  - General tab active by default
  - Sidebar highlights "AI Provider" category
2. **General Tab (Provider Selection)**
  - Provider selector dropdown: OpenAI, Ollama, Custom, Azure
  - Current selection highlighted
  - Token limits section (auto-save fields):
    - Context Window (number input)
    - Max Response Tokens (number input)
  - User changes token limits → auto-save triggers → toast notification "Settings saved ✓"
3. **Select Provider**
  - User selects provider from dropdown (e.g., "Ollama")
  - Corresponding tab becomes active automatically (switches to Ollama tab)
  - Provider-specific settings appear
  - ⚠️ Restart Required badge appears on provider selector
4. **Provider-Specific Settings (Example: Ollama Tab)**
  - Ollama API URL (text input with validation)
  - Ollama Model (text input)
  - Vision Model settings (context window, max tokens - auto-save)
  - Expert Model settings (context window, max tokens - auto-save)
  - Translation settings (context window, max tokens - auto-save)
5. **Save Provider Settings**
  - User clicks "Save AI Provider Settings" button
  - Button text: "Save & Restart" (restart required)
  - Settings saved → restart countdown modal
  - Application restarts with new provider

**Exit Point**: Settings saved and application restarted, or user navigates to another category

**Edge Cases**:

- If user switches provider without saving, auto-save triggers before navigation
- If provider requires credentials (API key) and none provided, show validation error
- Token limit changes auto-save immediately (no restart needed)

---

## Flow 4: Expert Models Configuration

**Description**: User configures domain-specific expert models (Medical, Financial, Legal) with token limits.

**Entry Point**: User navigates to Expert Models category from Overview or sidebar

**Steps**:

1. **Expert Models Category Display**
  - Main content shows Expert Models settings with tabs: Medical, Financial, Legal
  - Medical tab active by default
  - Expert Pipeline toggle at top (auto-save): "Enable Expert Pipeline"
  - If toggle off, all tabs show disabled state (opacity 50%)
2. **Enable Expert Pipeline**
  - User toggles "Enable Expert Pipeline" switch
  - Auto-save triggers immediately
  - Toast notification: "Expert Pipeline enabled ✓"
  - Tabs become active (opacity 100%)
3. **Configure Medical Experts (Medical Tab)**
  - Vision Model (text input) - manual save
  - Vision Context Window (number input) - auto-save
  - Vision Max Response Tokens (number input) - auto-save
  - Analysis Model (text input) - manual save
  - Analysis Context Window (number input) - auto-save
  - Analysis Max Response Tokens (number input) - auto-save
  - Radiology Model (text input) - manual save
  - Radiology Context Window (number input) - auto-save
  - Radiology Max Response Tokens (number input) - auto-save
4. **Auto-save Token Limits**
  - User changes context window value
  - Field shows "Saving..." indicator briefly
  - Auto-save triggers (debounced 500ms)
  - Toast notification: "Token limits saved ✓" (fades after 3s)
5. **Manual Save Model Names**
  - User changes model name (e.g., "llava-med-v1.6")
  - "Save Expert Models" button becomes enabled
  - User clicks save → settings saved → toast notification "Expert models saved ✓"
  - No restart required (models loaded on next request)
6. **Switch to Other Domains**
  - User clicks Financial or Legal tab
  - Same pattern: model names (manual save), token limits (auto-save)

**Exit Point**: Settings saved, or user navigates to another category

**Edge Cases**:

- If expert pipeline disabled, tabs show disabled state but settings remain editable
- If user navigates away with unsaved model names, auto-save triggers
- If invalid model name (empty), show validation error on save

---

## Flow 5: Advanced Settings Management

**Description**: User manages processing settings, restrictions, custom fields, and system prompt using tabs.

**Entry Point**: User navigates to Advanced category from Overview or sidebar

**Steps**:

1. **Advanced Category Display**
  - Main content shows Advanced settings with tabs: Processing, Restrictions, Custom Fields, System Prompt
  - Processing tab active by default
2. **Processing Tab**
  - Scan Interval (text input, cron format) - manual save
  - Show Tags dropdown (yes/no) - auto-save
  - If "yes", Tags input appears (comma-separated) - manual save
  - Add AI Processed Tag dropdown (yes/no) - auto-save
  - If "yes", Tag Name input appears - manual save
  - Use Prompt Tags dropdown (yes/no) - auto-save
  - If "yes", Prompt Tags input appears - manual save
3. **Auto-save Toggles**
  - User changes "Show Tags" to "yes"
  - Auto-save triggers immediately
  - Tags input section appears (progressive disclosure)
  - Toast notification: "Settings saved ✓"
4. **Restrictions Tab**
  - Restrict to Existing Tags (checkbox) - auto-save
  - Restrict to Existing Correspondents (checkbox) - auto-save
  - Restrict to Existing Document Types (checkbox) - auto-save
  - External API Enabled (checkbox) - auto-save
  - If enabled, External API settings appear (URL, method, headers, body, timeout) - manual save
5. **Custom Fields Tab**
  - List of existing custom fields (drag-and-drop to reorder)
  - Add Custom Field section:
    - Field Name (text input)
    - Field Type (dropdown: text, date, number, monetary)
    - If monetary, Currency Code dropdown appears
    - "Add Field" button
  - User adds field → field appears in list → auto-save triggers
  - User drags to reorder → auto-save triggers on drop
  - User clicks trash icon → confirmation modal → field removed → auto-save triggers
6. **System Prompt Tab**
  - Large textarea for system prompt
  - "Load Example Prompt" button (prefills with default)
  - Character count indicator
  - "Save System Prompt" button (manual save)
  - User edits prompt → button becomes enabled
  - User clicks save → settings saved → toast notification

**Exit Point**: Settings saved, or user navigates to another category

**Edge Cases**:

- If user adds duplicate custom field name, show validation error
- If custom field has invalid characters, show validation error
- If system prompt exceeds reasonable length (10,000 chars), show warning
- If user navigates away with unsaved system prompt, auto-save triggers

---

## Flow 6: Developer Settings (Toggle-Gated)

**Description**: User enables developer mode and accesses advanced developer settings with runtime state visibility.

**Entry Point**: User toggles "🔧 Developer Mode" in sidebar footer

**Steps**:

1. **Enable Developer Mode**
  - User clicks "🔧 Developer Mode" toggle in sidebar footer
  - Toggle switches to ON state
  - "Developer" category appears in sidebar (animated slide-in)
  - Badge appears on toggle: "Developer Mode Active"
  - State persisted to localStorage
2. **Navigate to Developer Category**
  - User clicks "Developer" in sidebar
  - Main content shows Developer settings with collapsible sections:
    - Environment Variables
    - Feature Flags
    - Performance Tuning
    - Runtime State
3. **Environment Variables Section**
  - Collapsed by default, user clicks to expand
  - Shows editable env vars: API URLs, ports, feature flags
  - Each field has ⚠️ Restart Required badge
  - User edits value → "Save Environment Variables" button enabled
  - User clicks save → settings saved → restart prompt
4. **Feature Flags Section**
  - Collapsed by default, user clicks to expand
  - Shows toggles for experimental features:
    - Enable Islands Architecture (on/off)
    - Enable Visual RAG (on/off)
    - Enable Expert Pipeline (on/off)
    - Enable Background Sync Job (on/off)
  - User toggles flag → auto-save triggers immediately
  - Toast notification: "Feature flag updated ✓"
  - If flag requires restart, ⚠️ badge appears and restart prompt shows
5. **Performance Tuning Section**
  - Collapsed by default, user clicks to expand
  - Shows tuning controls:
    - Request Timeout (number input, ms)
    - Circuit Breaker Threshold (number input, failure count)
    - Circuit Breaker Cooldown (number input, seconds)
    - VRAM Limit (number input, GB)
  - User changes value → auto-save triggers (debounced 500ms)
  - Toast notification: "Performance settings saved ✓"
6. **Runtime State Section**
  - Collapsed by default, user clicks to expand
  - Shows read-only runtime metrics grouped by component:
    - **Circuit Breaker**: Status (CLOSED/OPEN/HALF_OPEN), failure count, cooldown timer
    - **VRAM Usage**: Current usage (e.g., "3.5GB / 24GB"), visual gauge bar
    - **Qdrant Health**: Connection status, collection count, point count
    - **Sidecar State**: Status (200 OK / 503 Initializing), model name, warmup time
    - **Background Sync Job**: Last run time, pending events count, success/failure rate
  - "Refresh" button to update metrics
  - Auto-refresh every 10 seconds (optional)
7. **Disable Developer Mode**
  - User toggles "🔧 Developer Mode" off in sidebar footer
  - Developer category disappears from sidebar (animated slide-out)
  - If user was viewing Developer category, navigates to Overview
  - State persisted to localStorage

**Exit Point**: Developer settings configured, or user navigates to another category

**Edge Cases**:

- If developer mode disabled while viewing Developer category, auto-navigate to Overview
- If runtime state fetch fails, show "Unable to fetch metrics" with retry button
- If feature flag toggle fails, revert toggle state and show error toast

---

## Flow 7: Preset Loading with Diff Review

**Description**: User loads a predefined preset configuration and reviews changes before applying.

**Entry Point**: User clicks "Load Preset" from Overview dashboard or navigates to Presets section

**Steps**:

1. **Open Preset Selection Modal**
  - Modal appears with preset options:
    - Development (Ollama, local services, debug logging)
    - Production (OpenAI, optimized settings, minimal logging)
    - Medical Workflow (Medical experts enabled, radiology models)
    - Financial Workflow (Financial experts enabled, VAT expert)
    - Legal Workflow (Legal experts enabled, orchestrator)
  - Each preset shows description and icon
2. **Select Preset**
  - User clicks preset card (e.g., "Medical Workflow")
  - Loading indicator appears
  - Backend compares current settings with preset settings
  - Diff modal appears showing grouped changes
3. **Review Diff Modal**
  - Modal title: "Review Preset Changes: Medical Workflow"
  - Grouped changes by category (expandable sections):
    - **AI Provider** (5 changes) [collapsed]
    - **Expert Models** (12 changes) [collapsed]
    - **Advanced** (3 changes) [collapsed]
  - User clicks category to expand → shows field-level changes:
    - "AI Provider: openai → ollama"
    - "Medical Vision Model: qwen3-vl:8b → llava-med-v1.6"
    - "Expert Pipeline: Disabled → Enabled"
  - Summary at bottom: "20 settings will change, 3 require restart"
4. **Apply or Cancel**
  - User clicks "Apply Preset" → settings update across all islands
  - Auto-save triggers for non-critical settings
  - Manual save triggers for critical settings
  - Toast notifications for each category: "AI Provider updated ✓", "Expert Models updated ✓"
  - If restart required, restart prompt appears
  - User clicks "Cancel" → modal closes, no changes applied

**Exit Point**: Preset applied and settings updated, or user cancels

**Edge Cases**:

- If preset has no changes (already matches current settings), show "No changes needed"
- If preset conflicts with current state (e.g., invalid credentials), show validation errors
- If user has unsaved changes, warn before loading preset: "Unsaved changes will be lost"

---

## Flow 8: Export/Import Configuration

**Description**: User exports current settings to .env file or imports settings from .env file.

**Entry Point**: User clicks "Export Config" or "Import Config" from Overview dashboard

**Steps (Export)**:

1. **Export Configuration**
  - User clicks "Export Config" button
  - Backend generates .env file with all settings (~85+ lines)
  - File organized by category with comments:
    ```
    # Connection Settings
    PAPERLESS_API_URL=http://localhost:8000
    PAPERLESS_API_TOKEN=abc123

    # AI Provider Settings
    AI_PROVIDER=ollama
    OLLAMA_API_URL=http://localhost:11434
    ```
  - File downloads: `paperless-ai-settings-2024-01-18.env`
  - Toast notification: "Configuration exported ✓"

**Steps (Import)**:

1. **Import Configuration**
  - User clicks "Import Config" button
  - File picker modal appears
  - User selects .env file from local filesystem
2. **Validate Import**
  - Backend parses .env file
  - Validates all settings against Zod schemas
  - **Success**: Shows diff modal (same as Flow 7) with changes
  - **Failure**: Shows validation errors with line numbers and field names
3. **Review Import Diff**
  - Diff modal shows grouped changes (same as preset diff)
  - User reviews what will change
  - Summary: "45 settings will change, 8 require restart"
4. **Apply or Cancel**
  - User clicks "Apply Import" → settings update
  - Auto-save and manual save trigger as appropriate
  - Toast notifications for each category
  - Restart prompt if needed
  - User clicks "Cancel" → modal closes, no changes applied

**Exit Point**: Settings imported and applied, or user cancels

**Edge Cases**:

- If .env file has invalid format, show parsing errors with line numbers
- If .env file has unknown settings, show warning but allow import of valid settings
- If .env file missing required settings, show error and prevent import
- If import fails mid-process, rollback to previous settings

---

## Flow 9: Auto-save on Navigation

**Description**: User navigates between categories with unsaved changes, triggering auto-save.

**Entry Point**: User has unsaved changes in current category and clicks another category in sidebar

**Steps**:

1. **User Makes Changes**
  - User is in AI Provider category, General tab
  - User changes token limit (auto-save field) → auto-saves immediately
  - User changes model name (manual save field) → "Save AI Provider Settings" button enabled
  - Button shows unsaved indicator (e.g., orange dot)
2. **Navigate to Another Category**
  - User clicks "Expert Models" in sidebar
  - Auto-save triggers for unsaved changes in AI Provider
  - Brief loading indicator in sidebar: "Saving..."
  - Settings saved to backend
3. **Navigation Completes**
  - Toast notification: "AI Provider settings saved ✓" (fades after 3s)
  - Sidebar highlights "Expert Models" category
  - Main content transitions to Expert Models
  - URL updates: `/settings#expert-models`
4. **Return to Previous Category**
  - User clicks "AI Provider" in sidebar
  - Category loads with previously saved settings
  - No unsaved changes indicator

**Exit Point**: User navigates freely between categories with auto-save ensuring no data loss

**Edge Cases**:

- If auto-save fails (backend error), show error toast and prevent navigation
- If settings require restart, defer restart prompt until user explicitly saves or leaves settings page
- If multiple categories have unsaved changes, auto-save all before navigation

---

## Flow 10: Manual Save with Restart Indication

**Description**: User saves critical settings that require application restart.

**Entry Point**: User has modified critical settings (connection, AI provider, expert models, system prompt)

**Steps**:

1. **Edit Critical Setting**
  - User is in Connection category
  - User changes API URL
  - ⚠️ Restart Required badge visible on field
  - "Save Connection Settings" button enabled
2. **Save Button Indication**
  - Button text: "Save & Restart" (indicates restart will happen)
  - Button color: Orange/warning color (vs. normal blue)
  - Tooltip on hover: "Saving these settings requires application restart"
3. **Click Save**
  - User clicks "Save & Restart" button
  - Confirmation modal appears:
    - Title: "Restart Required"
    - Message: "Saving connection settings requires application restart. Continue?"
    - Buttons: "Save & Restart", "Cancel"
4. **Confirm Restart**
  - User clicks "Save & Restart"
  - Settings saved to backend
  - Restart countdown modal appears:
    - Title: "Restarting..."
    - Message: "Application will restart in 5 seconds"
    - Countdown timer: 5, 4, 3, 2, 1...
    - No cancel button (committed to restart)
5. **Application Restarts**
  - Page reloads after countdown
  - User returns to Overview dashboard
  - Toast notification: "Settings applied successfully ✓"

**Exit Point**: Application restarted with new settings applied

**Edge Cases**:

- If user clicks "Cancel" in confirmation modal, modal closes and no changes saved
- If save fails (backend error), show error toast and don't restart
- If restart fails (server doesn't come back), show error page with retry instructions

---

## Flow 11: Real-time Validation

**Description**: User receives immediate feedback on invalid inputs with inline error messages.

**Entry Point**: User enters invalid value in any settings field

**Steps**:

1. **Enter Invalid Value**
  - User is in Connection category
  - User enters invalid API URL (e.g., "not-a-url")
  - Field loses focus (blur event)
2. **Validation Triggers**
  - Zod schema validates input
  - Validation fails: URL format invalid
  - Inline error message appears below field: "Must be a valid URL starting with http:// or https://"
  - Field border turns red
  - Save button becomes disabled
3. **Correct Invalid Value**
  - User corrects URL (e.g., "[http://localhost:8000](http://localhost:8000)")
  - Validation triggers on blur
  - Validation passes
  - Error message disappears
  - Field border returns to normal
  - Save button becomes enabled
4. **Attempt Save with Invalid Fields**
  - If user somehow clicks save with invalid fields (shouldn't be possible)
  - Backend validation catches errors
  - Error toast appears: "Validation failed: [field names]"
  - Focus moves to first invalid field

**Exit Point**: User corrects all validation errors and can save successfully

**Edge Cases**:

- If validation is slow (async validation), show loading indicator
- If backend validation differs from client validation, show backend errors
- If multiple fields invalid, show all errors simultaneously (not one at a time)

---

## Flow 12: Theme Toggle (Existing Feature)

**Description**: User toggles between light and dark themes (existing feature, preserved in new UI).

**Entry Point**: User clicks theme toggle button in header

**Steps**:

1. **Toggle Theme**
  - User clicks sun/moon icon in header
  - Theme switches immediately (light ↔ dark)
  - Icon changes (sun → moon or moon → sun)
  - All UI components update colors (shadcn/ui theme support)
  - Preference saved to localStorage
2. **Theme Persistence**
  - Theme persists across page reloads
  - Theme applies to all routes (Dashboard, Manual, History, Settings)

**Exit Point**: Theme changed and persisted

**Edge Cases**:

- If localStorage unavailable, theme resets to light on reload
- If system prefers dark mode, default to dark on first visit

---

## Interaction Patterns

### Auto-save Behavior

**Triggers**:

- Field blur (for auto-save fields)
- Toggle switch change (immediate)
- Drag-and-drop reorder (on drop)
- Navigation to another category (saves all unsaved changes)

**Feedback**:

- Toast notification: "Settings saved ✓" (bottom-right, fades after 3s)
- Brief inline indicator: "Saving..." → "Saved ✓" (for specific field)

**Debouncing**:

- Text inputs: 500ms debounce (wait for user to stop typing)
- Number inputs: 500ms debounce
- Toggles/checkboxes: Immediate (no debounce)

### Manual Save Behavior

**Triggers**:

- User clicks "Save [Category] Settings" button
- Auto-save on navigation (if unsaved changes exist)

**Feedback**:

- Button shows loading state: "Saving..."
- Success toast: "[Category] settings saved ✓"
- If restart required, restart countdown modal

**Validation**:

- Client-side: Zod schema validation on blur
- Server-side: Backend validation on save
- Both must pass for save to succeed

### Restart Indication

**Visual Indicators**:

- ⚠️ Restart Required badge on fields that require restart
- Save button text changes to "Save & Restart"
- Button color changes to orange/warning color

**Restart Flow**:

1. Confirmation modal: "Restart required. Continue?"
2. User confirms → settings saved
3. Countdown modal: "Restarting in 5 seconds..."
4. Page reloads after countdown

### Progressive Disclosure

**Patterns**:

- Provider selection → provider-specific tab becomes active
- Toggle "yes" → related fields appear
- Enable feature → configuration options appear
- Expand section → details revealed

**Animation**:

- Smooth transitions (< 100ms)
- Fade in/out for appearing/disappearing elements
- Slide animations for sidebar category changes

---

## Edge Cases & Error Scenarios

### Connection Failures

**Scenario**: Paperless-ngx API unreachable during connection test

**Recovery**:

- Show inline error: "Connection failed: Unable to reach API"
- Suggest troubleshooting: "Check URL and network connectivity"
- "Retry" button to test again
- Allow save anyway (user may be configuring for later)

### Validation Errors

**Scenario**: User enters invalid settings (wrong format, missing required fields)

**Recovery**:

- Inline error messages with specific guidance
- Disable save button until errors resolved
- Highlight invalid fields with red border
- Focus first invalid field on save attempt

### Auto-save Failures

**Scenario**: Auto-save fails due to backend error

**Recovery**:

- Error toast: "Failed to save settings: [reason]"
- "Retry" button in toast
- Prevent navigation until saved or user explicitly discards changes
- Show unsaved indicator in sidebar

### Restart Failures

**Scenario**: Application doesn't restart after countdown

**Recovery**:

- Show error page: "Restart failed. Please refresh manually."
- "Refresh Now" button
- Link to troubleshooting documentation

### Import Validation Failures

**Scenario**: Imported .env file has invalid or incompatible settings

**Recovery**:

- Show validation errors with line numbers
- List invalid fields with reasons
- Allow partial import (valid settings only) or cancel
- Provide example .env format for reference

---

## Success Metrics

### Usability Metrics

- Time to find specific setting < 10 seconds (via sidebar navigation)
- Time to configure AI provider < 2 minutes (including test)
- Time to load preset < 30 seconds (including diff review)
- Settings save success rate > 99%

### Performance Metrics

- Page load time < 1 second
- Tab switching < 100ms
- Auto-save latency < 200ms
- Validation feedback < 50ms

### Adoption Metrics

- Developer mode usage rate (% of users who enable)
- Preset loading frequency (vs. manual configuration)
- Export/import usage (for backup/deployment)
- Connection test usage (before save)

---

## Wireframes

### Overview Dashboard

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
  .container { display: flex; height: 100vh; }
  .sidebar { width: 240px; background: #fff; border-right: 1px solid #e5e7eb; padding: 16px; }
  .sidebar-header { font-size: 18px; font-weight: 600; margin-bottom: 24px; }
  .sidebar-nav { list-style: none; padding: 0; margin: 0; }
  .sidebar-nav li { padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; }
  .sidebar-nav li.active { background: #3b82f6; color: white; }
  .sidebar-nav li:hover { background: #e5e7eb; }
  .sidebar-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .dev-toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .toggle { width: 40px; height: 20px; background: #d1d5db; border-radius: 10px; position: relative; cursor: pointer; }
  .toggle.on { background: #3b82f6; }
  .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.2s; }
  .toggle.on .toggle-knob { left: 22px; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .header { margin-bottom: 32px; }
  .header h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; }
  .header p { color: #6b7280; margin: 0; }
  .actions { display: flex; gap: 12px; margin-bottom: 32px; }
  .btn { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
  .btn:hover { background: #f3f4f6; }
  .btn-primary { background: #3b82f6; color: white; border-color: #3b82f6; }
  .btn-primary:hover { background: #2563eb; }
  .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
  .card-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; }
  .card-title { font-size: 16px; font-weight: 600; margin: 0; }
  .card-status { font-size: 12px; padding: 4px 8px; border-radius: 4px; }
  .status-success { background: #d1fae5; color: #065f46; }
  .status-error { background: #fee2e2; color: #991b1b; }
  .card-body { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
  .card-action { display: inline-block; color: #3b82f6; font-size: 14px; text-decoration: none; }
  .card-action:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <div class="sidebar-header">Settings</div>
      <ul class="sidebar-nav">
        <li class="active" data-element-id="nav-overview">📊 Overview</li>
        <li data-element-id="nav-connection">🔌 Connection</li>
        <li data-element-id="nav-ai-provider">🤖 AI Provider</li>
        <li data-element-id="nav-expert-models">🎓 Expert Models</li>
        <li data-element-id="nav-advanced">⚙️ Advanced</li>
      </ul>
      <div class="sidebar-footer">
        <div class="dev-toggle">
          <span>🔧 Developer Mode</span>
          <div class="toggle" data-element-id="dev-mode-toggle">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>
    </aside>
    
    <main class="main">
      <div class="header">
        <h1>Settings Overview</h1>
        <p>Quick access to configuration and system status</p>
      </div>
      
      <div class="actions">
        <button class="btn btn-primary" data-element-id="load-preset-btn">Load Preset</button>
        <button class="btn" data-element-id="export-config-btn">Export Config</button>
        <button class="btn" data-element-id="import-config-btn">Import Config</button>
      </div>
      
      <div class="cards">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Connection</h3>
            <span class="card-status status-success">✓ Connected</span>
          </div>
          <div class="card-body">
            <div>API: http://localhost:8000</div>
            <div>Token: ••••••••••••</div>
          </div>
          <button class="btn" data-element-id="test-connection-btn">Test Connection</button>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">AI Provider</h3>
            <span class="card-status status-success">OpenAI</span>
          </div>
          <div class="card-body">
            <div>Model: gpt-4o-mini</div>
            <div>Token Limit: 128,000</div>
          </div>
          <a href="#ai-provider" class="card-action" data-element-id="configure-ai-link">Configure AI Provider →</a>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Expert Pipeline</h3>
            <span class="card-status status-success">Enabled</span>
          </div>
          <div class="card-body">
            <div>3 domains configured</div>
            <div>Medical, Financial, Legal</div>
          </div>
          <a href="#expert-models" class="card-action" data-element-id="configure-experts-link">Configure Experts →</a>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Advanced</h3>
          </div>
          <div class="card-body">
            <div>5 tags configured</div>
            <div>3 custom fields</div>
          </div>
          <a href="#advanced" class="card-action" data-element-id="manage-advanced-link">Manage Advanced →</a>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
```

### AI Provider with Tabs

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
  .container { display: flex; height: 100vh; }
  .sidebar { width: 240px; background: #fff; border-right: 1px solid #e5e7eb; padding: 16px; }
  .sidebar-nav { list-style: none; padding: 0; margin: 0; }
  .sidebar-nav li { padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; }
  .sidebar-nav li.active { background: #3b82f6; color: white; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
  .tabs { display: flex; gap: 4px; border-bottom: 2px solid #e5e7eb; margin-bottom: 24px; }
  .tab { padding: 12px 20px; border: none; background: transparent; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; margin-bottom: -2px; }
  .tab.active { border-bottom-color: #3b82f6; color: #3b82f6; font-weight: 600; }
  .tab:hover { background: #f3f4f6; }
  .form-group { margin-bottom: 20px; }
  .label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; margin-left: 8px; }
  .input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
  .input:focus { outline: none; border-color: #3b82f6; }
  .select { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
  .help-text { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .btn { padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
  .btn-primary { background: #3b82f6; color: white; border-color: #3b82f6; }
  .btn-warning { background: #f59e0b; color: white; border-color: #f59e0b; }
</style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <ul class="sidebar-nav">
        <li>📊 Overview</li>
        <li>🔌 Connection</li>
        <li class="active">🤖 AI Provider</li>
        <li>🎓 Expert Models</li>
        <li>⚙️ Advanced</li>
      </ul>
    </aside>
    
    <main class="main">
      <div class="header">
        <h1>AI Provider Configuration</h1>
      </div>
      
      <div class="tabs">
        <button class="tab active" data-element-id="tab-general">General</button>
        <button class="tab" data-element-id="tab-openai">OpenAI</button>
        <button class="tab" data-element-id="tab-ollama">Ollama</button>
        <button class="tab" data-element-id="tab-custom">Custom</button>
        <button class="tab" data-element-id="tab-azure">Azure</button>
      </div>
      
      <div class="form-group">
        <label class="label">
          AI Provider
          <span class="badge">⚠️ Restart Required</span>
        </label>
        <select class="select" data-element-id="ai-provider-select">
          <option>OpenAI</option>
          <option>Ollama</option>
          <option>Custom</option>
          <option>Azure</option>
        </select>
        <div class="help-text">Select the AI provider for document analysis</div>
      </div>
      
      <div class="form-group">
        <label class="label">Context Window</label>
        <input type="number" class="input" value="128000" data-element-id="context-window-input" />
        <div class="help-text">Auto-saves on change</div>
      </div>
      
      <div class="form-group">
        <label class="label">Max Response Tokens</label>
        <input type="number" class="input" value="1000" data-element-id="max-tokens-input" />
        <div class="help-text">Auto-saves on change</div>
      </div>
      
      <button class="btn btn-warning" data-element-id="save-ai-btn">Save & Restart</button>
    </main>
  </div>
</body>
</html>
```

### Developer Settings Panel

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
  .container { display: flex; height: 100vh; }
  .sidebar { width: 240px; background: #fff; border-right: 1px solid #e5e7eb; padding: 16px; }
  .sidebar-nav { list-style: none; padding: 0; margin: 0; }
  .sidebar-nav li { padding: 8px 12px; margin-bottom: 4px; border-radius: 6px; cursor: pointer; }
  .sidebar-nav li.active { background: #3b82f6; color: white; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
  .header .badge { font-size: 12px; padding: 4px 8px; background: #fef3c7; color: #92400e; border-radius: 4px; }
  .section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; }
  .section-header { padding: 16px; border-bottom: 1px solid #e5e7eb; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .section-title { font-size: 16px; font-weight: 600; }
  .section-icon { color: #6b7280; }
  .section-body { padding: 16px; }
  .section-body.collapsed { display: none; }
  .form-group { margin-bottom: 16px; }
  .label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
  .input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: 14px; }
  .toggle { width: 40px; height: 20px; background: #d1d5db; border-radius: 10px; position: relative; cursor: pointer; }
  .toggle.on { background: #3b82f6; }
  .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.2s; }
  .toggle.on .toggle-knob { left: 22px; }
  .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
  .metric:last-child { border-bottom: none; }
  .metric-label { font-size: 14px; color: #6b7280; }
  .metric-value { font-size: 14px; font-weight: 600; }
  .gauge { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 4px; }
  .gauge-fill { height: 100%; background: #3b82f6; width: 15%; }
</style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <ul class="sidebar-nav">
        <li>📊 Overview</li>
        <li>🔌 Connection</li>
        <li>🤖 AI Provider</li>
        <li>🎓 Expert Models</li>
        <li>⚙️ Advanced</li>
        <li class="active">🔧 Developer</li>
      </ul>
    </aside>
    
    <main class="main">
      <div class="header">
        <h1>Developer Settings <span class="badge">Developer Mode Active</span></h1>
      </div>
      
      <div class="section">
        <div class="section-header" data-element-id="env-vars-header">
          <span class="section-title">Environment Variables</span>
          <span class="section-icon">▼</span>
        </div>
        <div class="section-body">
          <div class="form-group">
            <label class="label">Qdrant Host</label>
            <input type="text" class="input" value="localhost" data-element-id="qdrant-host-input" />
          </div>
          <div class="form-group">
            <label class="label">Qdrant Port</label>
            <input type="number" class="input" value="6333" data-element-id="qdrant-port-input" />
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" data-element-id="feature-flags-header">
          <span class="section-title">Feature Flags</span>
          <span class="section-icon">▼</span>
        </div>
        <div class="section-body">
          <div class="toggle-row">
            <span class="toggle-label">Enable Islands Architecture</span>
            <div class="toggle on" data-element-id="islands-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Enable Visual RAG</span>
            <div class="toggle on" data-element-id="visual-rag-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Enable Background Sync Job</span>
            <div class="toggle on" data-element-id="sync-job-toggle">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" data-element-id="runtime-state-header">
          <span class="section-title">Runtime State</span>
          <span class="section-icon">▼</span>
        </div>
        <div class="section-body">
          <div class="metric">
            <span class="metric-label">Circuit Breaker</span>
            <span class="metric-value">CLOSED ✓</span>
          </div>
          <div class="metric">
            <span class="metric-label">VRAM Usage</span>
            <span class="metric-value">3.5GB / 24GB</span>
          </div>
          <div class="gauge">
            <div class="gauge-fill"></div>
          </div>
          <div class="metric">
            <span class="metric-label">Qdrant Health</span>
            <span class="metric-value">Connected ✓</span>
          </div>
          <div class="metric">
            <span class="metric-label">Sidecar State</span>
            <span class="metric-value">200 OK</span>
          </div>
          <div class="metric">
            <span class="metric-label">Background Sync</span>
            <span class="metric-value">0 pending</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
```

### Preset Diff Modal

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; height: 100vh; }
  .modal { background: white; border-radius: 12px; width: 600px; max-height: 80vh; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
  .modal-title { font-size: 20px; font-weight: 700; margin: 0; }
  .modal-subtitle { font-size: 14px; color: #6b7280; margin: 4px 0 0 0; }
  .modal-body { padding: 24px; max-height: 400px; overflow-y: auto; }
  .diff-section { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .diff-header { padding: 12px 16px; background: #f9fafb; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .diff-title { font-size: 14px; font-weight: 600; }
  .diff-count { font-size: 12px; color: #6b7280; }
  .diff-icon { color: #6b7280; }
  .diff-body { padding: 16px; }
  .diff-body.collapsed { display: none; }
  .diff-item { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .diff-item:last-child { border-bottom: none; }
  .diff-field { font-size: 13px; color: #374151; }
  .diff-change { font-size: 13px; margin-top: 4px; }
  .diff-old { color: #dc2626; text-decoration: line-through; }
  .diff-new { color: #16a34a; font-weight: 500; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .summary { font-size: 14px; color: #6b7280; }
  .actions { display: flex; gap: 12px; }
  .btn { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
  .btn-primary { background: #3b82f6; color: white; border-color: #3b82f6; }
</style>
</head>
<body>
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">Review Preset Changes</h2>
      <p class="modal-subtitle">Medical Workflow</p>
    </div>
    
    <div class="modal-body">
      <div class="diff-section">
        <div class="diff-header" data-element-id="diff-ai-provider-header">
          <span class="diff-title">AI Provider</span>
          <div>
            <span class="diff-count">5 changes</span>
            <span class="diff-icon">▼</span>
          </div>
        </div>
        <div class="diff-body">
          <div class="diff-item">
            <div class="diff-field">Provider</div>
            <div class="diff-change">
              <span class="diff-old">openai</span> → <span class="diff-new">ollama</span>
            </div>
          </div>
          <div class="diff-item">
            <div class="diff-field">Model</div>
            <div class="diff-change">
              <span class="diff-old">gpt-4o-mini</span> → <span class="diff-new">sauerkraut-llama3.1:8b</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="diff-section">
        <div class="diff-header" data-element-id="diff-expert-models-header">
          <span class="diff-title">Expert Models</span>
          <div>
            <span class="diff-count">12 changes</span>
            <span class="diff-icon">▶</span>
          </div>
        </div>
        <div class="diff-body collapsed">
          <!-- Collapsed by default -->
        </div>
      </div>
      
      <div class="diff-section">
        <div class="diff-header" data-element-id="diff-advanced-header">
          <span class="diff-title">Advanced</span>
          <div>
            <span class="diff-count">3 changes</span>
            <span class="diff-icon">▶</span>
          </div>
        </div>
        <div class="diff-body collapsed">
          <!-- Collapsed by default -->
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <div class="summary">20 settings will change, 3 require restart</div>
      <div class="actions">
        <button class="btn" data-element-id="cancel-preset-btn">Cancel</button>
        <button class="btn btn-primary" data-element-id="apply-preset-btn">Apply Preset</button>
      </div>
    </div>
  </div>
</body>
</html>
```

### Export/Import Flow

```wireframe
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; padding: 32px; }
  .container { max-width: 800px; margin: 0 auto; }
  .header { margin-bottom: 32px; }
  .header h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
  .header p { color: #6b7280; margin: 0; }
  .card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
  .card-title { font-size: 18px; font-weight: 600; margin: 0 0 16px 0; }
  .card-body { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
  .btn { padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
  .btn-primary { background: #3b82f6; color: white; border-color: #3b82f6; }
  .code-preview { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; margin-top: 16px; }
  .code-line { margin-bottom: 4px; }
  .code-comment { color: #6b7280; }
  .file-input { display: none; }
  .file-label { display: inline-block; padding: 10px 20px; border: 2px dashed #d1d5db; border-radius: 6px; cursor: pointer; text-align: center; color: #6b7280; }
  .file-label:hover { border-color: #3b82f6; color: #3b82f6; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Export / Import Configuration</h1>
      <p>Backup and restore your settings as .env file</p>
    </div>
    
    <div class="card">
      <h3 class="card-title">Export Configuration</h3>
      <div class="card-body">
        Export all current settings to a .env file. This file can be used for backup, deployment, or sharing configurations.
      </div>
      <button class="btn btn-primary" data-element-id="export-btn">Export to .env File</button>
      
      <div class="code-preview">
        <div class="code-line code-comment"># Connection Settings</div>
        <div class="code-line">PAPERLESS_API_URL=http://localhost:8000</div>
        <div class="code-line">PAPERLESS_API_TOKEN=abc123def456</div>
        <div class="code-line code-comment"># AI Provider Settings</div>
        <div class="code-line">AI_PROVIDER=ollama</div>
        <div class="code-line">OLLAMA_API_URL=http://localhost:11434</div>
        <div class="code-line">OLLAMA_MODEL=sauerkraut-llama3.1:8b</div>
        <div class="code-line code-comment"># Expert Models</div>
        <div class="code-line">EXPERT_PIPELINE_ENABLED=yes</div>
        <div class="code-line">MEDICAL_VISION_MODEL=llava-med-v1.6</div>
        <div class="code-line code-comment">... (85+ lines total)</div>
      </div>
    </div>
    
    <div class="card">
      <h3 class="card-title">Import Configuration</h3>
      <div class="card-body">
        Import settings from a .env file. The file will be validated before applying changes.
      </div>
      <input type="file" class="file-input" id="file-input" accept=".env" data-element-id="import-file-input" />
      <label for="file-input" class="file-label" data-element-id="import-file-label">
        📁 Choose .env file to import
      </label>
    </div>
  </div>
</body>
</html>
```

---

## Interaction Patterns Summary

### Navigation Pattern

- **Sidebar**: Persistent left sidebar with category links
- **Tabs**: Within categories (AI Provider, Expert Models, Advanced)
- **URL Hash**: Deep-linking support (`/settings#ai-provider`)
- **Active State**: Highlighted category in sidebar, active tab in content

### Save Pattern

- **Auto-save**: Token limits, toggles, checkboxes, drag-and-drop reordering
- **Manual save**: Connection settings, AI provider, model names, custom fields, system prompt
- **Auto-save on navigation**: Triggers before switching categories
- **Debouncing**: 500ms for text/number inputs, immediate for toggles

### Feedback Pattern

- **Auto-save**: Subtle toast notification (bottom-right, fades after 3s)
- **Manual save**: Success toast + restart prompt if needed
- **Validation errors**: Inline error messages with red border
- **Loading states**: Spinner in buttons, "Saving..." indicators

### Restart Pattern

- **Indication**: ⚠️ Restart Required badge on fields
- **Save button**: Text changes to "Save & Restart", color changes to orange
- **Confirmation**: Modal asking user to confirm restart
- **Countdown**: 5-second countdown before page reload

### Progressive Disclosure Pattern

- **Provider selection**: Switches to provider-specific tab
- **Toggle "yes"**: Related fields appear
- **Enable feature**: Configuration options appear
- **Expand section**: Details revealed (collapsible sections)

---

## Decision Points

### When to Auto-save vs. Manual Save

**Auto-save (Non-Critical)**:

- Token limits (context windows, max response tokens)
- Toggles (expert pipeline, feature flags, AI restrictions)
- Checkboxes (show tags, add AI tag, external API enabled)
- Tags configuration (add/remove tags)
- Custom fields (add/remove/reorder)

**Manual Save (Critical)**:

- Connection settings (API URL, token, username)
- AI provider selection and credentials
- Expert model names
- External API configuration (URL, headers, body)
- System prompt

**Rationale**: Auto-save for settings that are low-risk and frequently adjusted. Manual save for settings that affect system stability or require validation.

### When to Require Restart

**Restart Required**:

- Connection settings (API URL, token)
- AI provider selection (OpenAI ↔ Ollama ↔ Custom ↔ Azure)
- Some environment variables (ports, hosts)

**Hot Reload (No Restart)**:

- Token limits
- Expert model names (loaded on next request)
- Tags configuration
- AI restrictions
- Feature flags (most)
- System prompt

**Rationale**: Restart only for settings that require re-initialization of core services (database connection, AI provider client).

---

## Success Criteria

### Flow Completeness

- ✅ All 8 primary flows documented with entry/exit points
- ✅ Decision points identified (auto-save vs. manual, restart vs. hot reload)
- ✅ Edge cases covered (validation errors, connection failures, import errors)
- ✅ Error scenarios with recovery approaches

### User Experience Quality

- ✅ Clear navigation (sidebar + tabs)
- ✅ Immediate feedback (validation, auto-save, loading states)
- ✅ Progressive disclosure (show/hide based on context)
- ✅ Graceful error handling (inline errors, retry options)

### Interaction Consistency

- ✅ Consistent save patterns across all islands
- ✅ Consistent validation feedback
- ✅ Consistent restart indication
- ✅ Consistent navigation behavior

---

## References

- **Epic Brief**: spec:6e0e0983-e5b6-41d3-98e0-9cd4d0ddb783/56121be3-201f-43d2-a410-592c99bbeaa8
- **Current Implementation**: file:views/settings.ejs, file:public/js/settings.js
- **Islands Runtime**: file:src/islands/runtime.js
- **Existing Islands**: file:src/islands/ (VisualAnnotation, FeedbackControls, ManualEditor, HistoryTabs, OverlayViewer, Playground)



## Flow 13: Backend Route Stability Validation (NEW)

**Description:** Ensure all application functionality works identically after backend route extraction.

**Steps:**
1. Verify authentication
2. Verify document handling
3. Verify chat
4. Verify history
5. Verify processing
6. Verify system routes
7. Verify settings
