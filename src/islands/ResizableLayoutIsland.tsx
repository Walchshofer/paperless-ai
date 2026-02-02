import { h } from 'preact';
import { useRef, useCallback, useEffect, useState } from 'preact/hooks';

/**
 * SidebarResizeHandle - Provides drag-to-resize functionality for workspace sidebar
 *
 * Features:
 * - Drag handle between viewer and sidebar
 * - Automatic persistence to localStorage
 * - Keyboard navigation for accessibility (Arrow Left/Right)
 * - Dispatches sidebar:resize events for other components
 * - Touch support for mobile/tablet
 * - Min/max constraints (300px - 600px)
 *
 * Architecture Reference: ticket:5fa2fc44-2ab2-42b3-b0b3-61cc70568b81
 */

export interface ResizableLayoutProps {
  /** Minimum sidebar width in pixels (default: 300) */
  minWidth?: number;
  /** Maximum sidebar width in pixels (default: 600) */
  maxWidth?: number;
  /** Default sidebar width in pixels (default: 400) */
  defaultWidth?: number;
  /** Storage key for persisting width (default: 'paperless-sidebar-width') */
  storageKey?: string;
}

const STORAGE_KEY_DEFAULT = 'paperless-sidebar-width';
const MIN_WIDTH_DEFAULT = 300;
const MAX_WIDTH_DEFAULT = 600;
const DEFAULT_WIDTH = 400;

export default function ResizableLayoutIsland(props: ResizableLayoutProps) {
  const {
    minWidth = MIN_WIDTH_DEFAULT,
    maxWidth = MAX_WIDTH_DEFAULT,
    defaultWidth = DEFAULT_WIDTH,
    storageKey = STORAGE_KEY_DEFAULT,
  } = props;

  const [isDragging, setIsDragging] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth);
  const [isMobile, setIsMobile] = useState(false);
  const handleRef = useRef(null as HTMLDivElement | null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Load persisted width from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setSidebarWidth(parsed);
        }
      }
    } catch (err) {
      console.warn('[ResizableLayout] Failed to load persisted width:', err);
    }
  }, [storageKey, minWidth, maxWidth]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Apply sidebar width to CSS variable
  useEffect(() => {
    if (isMobile) return;
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    
    // Dispatch resize event for other components
    window.dispatchEvent(new CustomEvent('sidebar:resize', {
      detail: {
        sidebarWidth,
        totalWidth: window.innerWidth,
      }
    }));
  }, [sidebarWidth, isMobile]);

  // Save width to localStorage
  const persistWidth = useCallback((width: number) => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch (err) {
      console.warn('[ResizableLayout] Failed to persist width:', err);
    }
  }, [storageKey]);

  // Clamp width to min/max bounds
  const clampWidth = useCallback((width: number) => {
    return Math.min(maxWidth, Math.max(minWidth, width));
  }, [minWidth, maxWidth]);

  // Mouse/touch handlers
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    // Moving left increases sidebar width, moving right decreases it
    const delta = startXRef.current - clientX;
    const newWidth = clampWidth(startWidthRef.current + delta);
    setSidebarWidth(newWidth);
  }, [isDragging, clampWidth]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    persistWidth(sidebarWidth);
    console.info(`[ResizableLayout] Sidebar resized to ${sidebarWidth}px`);
  }, [isDragging, sidebarWidth, persistWidth]);

  // Mouse event handlers
  const onMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  // Touch event handlers
  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    handleDragStart(e.touches[0].clientX);
  }, [handleDragStart]);

  // Global mouse/touch move and end handlers
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientX);
    };

    const onMouseUp = () => {
      handleDragEnd();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleDragMove(e.touches[0].clientX);
    };

    const onTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Keyboard resize handler for accessibility
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const step = 20; // 20px per keypress
    
    if (e.key === 'ArrowLeft') {
      // Make sidebar larger
      e.preventDefault();
      const newWidth = clampWidth(sidebarWidth + step);
      setSidebarWidth(newWidth);
      persistWidth(newWidth);
    } else if (e.key === 'ArrowRight') {
      // Make sidebar smaller
      e.preventDefault();
      const newWidth = clampWidth(sidebarWidth - step);
      setSidebarWidth(newWidth);
      persistWidth(newWidth);
    }
  }, [sidebarWidth, clampWidth, persistWidth]);

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  return (
    <div
      ref={handleRef}
      className={`
        resize-handle
        absolute top-0 bottom-0 w-1.5
        bg-[#e5e0d8] hover:bg-copper
        transition-colors cursor-col-resize
        flex items-center justify-center
        z-20
        ${isDragging ? 'bg-copper' : ''}
      `}
      style={{ right: `${sidebarWidth}px` }}
      data-testid="sidebar-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={sidebarWidth}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-label="Resize sidebar. Use left and right arrow keys to adjust."
      tabIndex={0}
      onMouseDown={onMouseDown as unknown as (e: MouseEvent) => void}
      onTouchStart={onTouchStart as unknown as (e: TouchEvent) => void}
      onKeyDown={handleKeyDown as unknown as (e: KeyboardEvent) => void}
    >
      {/* Visual indicator dots */}
      <div className={`flex flex-col gap-1 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="w-0.5 h-0.5 bg-white rounded-full" />
        <div className="w-0.5 h-0.5 bg-white rounded-full" />
        <div className="w-0.5 h-0.5 bg-white rounded-full" />
      </div>
    </div>
  );
}
