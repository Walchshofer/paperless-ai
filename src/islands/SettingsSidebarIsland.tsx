import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { SettingsSidebar } from '../ui/contracts/Settings.Sidebar.contract';
import { SettingsSidebarSchema } from '../ui/contracts/Settings.Sidebar.contract';

const STORAGE_KEY_DEVELOPER_MODE = 'settings:developerMode';
const STORAGE_KEY_LAST_CATEGORY = 'settings:lastCategory';

interface Category {
  id: string;
  label: string;
  icon?: string;
  requiresDeveloperMode?: boolean;
}

const CATEGORIES: Category[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'connection', label: 'Connection', icon: '🔌' },
  { id: 'ai-provider', label: 'AI Provider', icon: '🤖' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  { id: 'developer', label: 'Developer', icon: '👨‍💻', requiresDeveloperMode: true },
  { id: 'prompts', label: 'Prompts', icon: '📝', requiresDeveloperMode: true },
];

/**
 * SettingsSidebarIsland - Navigation sidebar for settings page
 *
 * Provides category navigation and developer mode toggle with localStorage persistence.
 */
export default function SettingsSidebarIsland(
  props: Partial<SettingsSidebar>
) {
  // Validate and merge props with defaults
  const validated = SettingsSidebarSchema.parse(props);

  // Initialize developer mode from localStorage (overrides props)
  const [developerMode, setDeveloperMode] = useState(() => {
    if (typeof localStorage === 'undefined') return Boolean(validated.developerModeEnabled || false);
    const stored = localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE);
    return stored ? stored === 'true' : Boolean(validated.developerModeEnabled || false);
  });

  // Initialize active category from localStorage or props
  const [activeCategory, setActiveCategory] = useState(() => {
    if (typeof localStorage === 'undefined') return validated.activeCategory || 'overview';
    const stored = localStorage.getItem(STORAGE_KEY_LAST_CATEGORY);
    return stored || validated.activeCategory || 'overview';
  });

  const toggleRef = useRef(null as HTMLButtonElement | null);

  useEffect(() => {
    if (toggleRef.current) toggleRef.current.setAttribute('aria-checked', String(developerMode));
  }, [developerMode]);

  const dispatchSettingsEvent = (name: string, detail: Record<string, unknown>) => {
    if (typeof document === 'undefined') return;
    const CustomEventCtor =
      typeof window !== 'undefined' && typeof window.CustomEvent === 'function'
        ? window.CustomEvent
        : null;
    if (!CustomEventCtor) return;
    document.dispatchEvent(new CustomEventCtor(name, { detail }));
  };

  // Persist developer mode to localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_DEVELOPER_MODE, String(developerMode));
  }, [developerMode]);

  // Persist active category to localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_LAST_CATEGORY, activeCategory);
  }, [activeCategory]);

  // Listen to navigation events from other islands
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.category) {
        setActiveCategory(customEvent.detail.category);
      }
    };

    document.addEventListener('settings:navigate', handleNavigate);
    return () => document.removeEventListener('settings:navigate', handleNavigate);
  }, []);

  // Listen to URL hash changes for direct navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window;
    const handleHashChange = () => {
      const hash = win.location.hash.slice(1);
      if (hash && CATEGORIES.some((cat) => cat.id === hash)) {
        setActiveCategory(hash);
      }
    };

    win.addEventListener('hashchange', handleHashChange);

    // Check initial hash
    handleHashChange();

    return () => win.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);

    dispatchSettingsEvent('settings:category-changed', { category: categoryId });

    // Update URL hash
    if (typeof window !== 'undefined') {
      window.location.hash = categoryId;
    }
  };

  const handleDeveloperToggle = () => {
    const newValue = !developerMode;
    setDeveloperMode(newValue);

    // Dispatch developer mode toggle event
    dispatchSettingsEvent('developer:toggled', {
      enabled: newValue,
    });

    // If disabling developer mode and currently on developer category, switch to overview
    if (!newValue && (activeCategory === 'developer' || activeCategory === 'prompts')) {
      handleCategoryClick('overview');
    }
  };

  // Filter categories based on developer mode
  const visibleCategories = CATEGORIES.filter((cat) => {
    return !cat.requiresDeveloperMode || developerMode;
  });

  return (
    <div className="settings-sidebar" data-testid="settings-sidebar-root">
      {/* Header */}
      <div className="settings-sidebar-header">
        <h2 className="settings-sidebar-title">Settings</h2>
      </div>

      {/* Category Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visibleCategories.map(category => (
            <li key={category.id}>
              <button
                onClick={() => handleCategoryClick(category.id)}
                className={`settings-category-btn ${
                  activeCategory === category.id
                    ? 'active'
                    : ''
                }`}
                data-testid={`category-${category.id}`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer: Developer Mode Toggle */}
      <div className="settings-sidebar-footer">
        <div className="flex items-center justify-between">
          <label htmlFor="developer-toggle" className="text-sm text-gray-700 cursor-pointer dark:text-gray-300">
            Developer Mode
          </label>
          <button
            id="developer-toggle"
            role="switch"
            aria-checked="false"
            ref={(el: HTMLButtonElement | null) => { toggleRef.current = el; }}
            onClick={handleDeveloperToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              developerMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            data-testid="developer-toggle"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                developerMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {developerMode && (
          <p className="mt-2 text-xs text-gray-500">
            👨‍💻 Developer category enabled
          </p>
        )}
      </div>
    </div>
  );
}
