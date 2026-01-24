import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
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
  { id: 'expert-models', label: 'Expert Models', icon: '🎓' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  { id: 'developer', label: 'Developer', icon: '👨‍💻', requiresDeveloperMode: true },
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
  const [developerMode, setDeveloperMode] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return validated.developerModeEnabled || false;
    const stored = localStorage.getItem(STORAGE_KEY_DEVELOPER_MODE);
    return stored ? stored === 'true' : (validated.developerModeEnabled || false);
  });

  // Initialize active category from localStorage or props
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return validated.activeCategory;
    const stored = localStorage.getItem(STORAGE_KEY_LAST_CATEGORY);
    return stored || validated.activeCategory;
  });

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

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash && CATEGORIES.some(cat => cat.id === hash)) {
        setActiveCategory(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    // Check initial hash
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);

    // Dispatch category change event
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('settings:category-changed', {
        detail: { category: categoryId }
      }));
    }

    // Update URL hash
    if (typeof window !== 'undefined') {
      window.location.hash = categoryId;
    }
  };

  const handleDeveloperToggle = () => {
    const newValue = !developerMode;
    setDeveloperMode(newValue);

    // Dispatch developer mode toggle event
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('developer:toggled', {
        detail: { enabled: newValue }
      }));
    }

    // If disabling developer mode and currently on developer category, switch to overview
    if (!newValue && activeCategory === 'developer') {
      handleCategoryClick('overview');
    }
  };

  // Filter categories based on developer mode
  const visibleCategories = CATEGORIES.filter(cat =>
    !cat.requiresDeveloperMode || developerMode
  );

  return (
    <div className="settings-sidebar bg-gray-50 border-r border-gray-200 h-full flex flex-col" data-testid="settings-sidebar-root">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Settings</h2>
      </div>

      {/* Category Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visibleCategories.map(category => (
            <li key={category.id}>
              <button
                onClick={() => handleCategoryClick(category.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeCategory === category.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
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
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <label htmlFor="developer-toggle" className="text-sm text-gray-700 cursor-pointer">
            Developer Mode
          </label>
          <button
            id="developer-toggle"
            role="switch"
            aria-checked={developerMode}
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
