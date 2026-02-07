import { h } from 'preact';

interface UsageBarProps {
  value: number;
  max: number;
  label?: string;
  unit?: string;
  thresholds?: { warn: number; danger: number };
}

/**
 * Horizontal usage/progress bar with color-coded fill levels.
 */
export function UsageBar({ value, max, label, unit = '', thresholds = { warn: 60, danger: 80 } }: UsageBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const level = percentage >= thresholds.danger ? 'danger' : percentage >= thresholds.warn ? 'warn' : 'ok';

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between items-baseline text-xs">
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span className="font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {value}{unit} / {max}{unit}
          </span>
        </div>
      )}
      <div className="usage-bar-track">
        <div
          className="usage-bar-fill"
          data-level={level}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
        {percentage}%
      </div>
    </div>
  );
}
