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
  { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
  { id: 'connection', label: 'Connection', icon: 'fa-plug-circle-bolt' },
  { id: 'ai-provider', label: 'AI Provider', icon: 'fa-microchip' },
  { id: 'advanced', label: 'Advanced', icon: 'fa-sliders' },
  { id: 'developer', label: 'Developer', icon: 'fa-code-branch', requiresDeveloperMode: true },
  { id: 'prompts', label: 'Prompts', icon: 'fa-terminal', requiresDeveloperMode: true },
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
      const categoryId = customEvent.detail?.category;
      
      // OPTIMIZATION: Only update and re-dispatch if category actually changes
      // to prevent "UI getting stuck" due to rapid event cycles.
      if (categoryId && categoryId !== activeCategory) {
        setActiveCategory(categoryId);
        
        // Use a short delay to prevent event loops and allow state to settle
        setTimeout(() => {
          dispatchSettingsEvent('settings:category-changed', { 
            category: categoryId,
            focus: customEvent.detail.focus 
          });
        }, 50);
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
    if (categoryId === activeCategory) return;
    
    setActiveCategory(categoryId);

    // Update URL hash immediately for UI feedback
    if (typeof window !== 'undefined') {
      window.location.hash = categoryId;
    }

    // Delay event to allow Preact state to settle and prevent synchronous loops
    setTimeout(() => {
      dispatchSettingsEvent('settings:category-changed', { category: categoryId });
    }, 50);
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
    <div className="settings-sidebar h-full flex flex-col bg-white dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800" data-testid="settings-sidebar-root">
      {/* Precision Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">Control Center</h2>
        </div>
      </div>

      {/* Category Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ul className="space-y-2">
          {visibleCategories.map(category => (
            <li key={category.id}>
              <a
                href={`#${category.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.id);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeCategory === category.id
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
                data-testid={`category-${category.id}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  activeCategory === category.id 
                    ? 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700/50' 
                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700/50'
                }`}>
                  <i className={`fas ${category.icon} text-xs`}></i>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{category.label}</span>
                {activeCategory === category.id && (
                  <div className="ml-auto w-1 h-3 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer: Infrastructure Mode Toggle */}
      <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="fas fa-terminal text-[10px] text-slate-400"></i>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Dev Protocol</span>
          </div>
          <button
            id="developer-toggle"
            role="switch"
            aria-checked={developerMode}
            ref={(el: HTMLButtonElement | null) => { toggleRef.current = el; }}
            onClick={handleDeveloperToggle}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors outline-none focus:ring-2 focus:ring-cyan-500/20 ${
              developerMode ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-slate-200 dark:bg-slate-800'
            }`}
            data-testid="developer-toggle"
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                developerMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {developerMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <i className="fas fa-triangle-exclamation text-[10px] text-amber-500"></i>
            <p className="text-[9px] font-black uppercase tracking-tight text-amber-600 dark:text-amber-400">
              High-Privilege Mode
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
