import { h } from 'preact';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
}

/**
 * Pill-button filter bar for preset categories.
 */
export function CategoryFilter({ categories, activeCategory, onSelect }: CategoryFilterProps) {
  return (
    <div className="category-filter-bar" data-testid="category-filter">
      <button
        className="category-pill"
        data-active={String(activeCategory === null)}
        onClick={() => onSelect(null)}
        data-testid="category-filter-all"
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          className="category-pill"
          data-active={String(activeCategory === cat)}
          onClick={() => onSelect(cat)}
          data-testid={`category-filter-${cat}`}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
  );
}
