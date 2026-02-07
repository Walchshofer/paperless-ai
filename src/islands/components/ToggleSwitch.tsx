import { h } from 'preact';

interface ToggleSwitchProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}

/**
 * Reusable toggle switch with spring-snap animation.
 * Uses CSS classes from settings.css (.toggle-track, .toggle-knob).
 */
export function ToggleSwitch({ id, label, description, checked, onChange, testId }: ToggleSwitchProps) {
  return (
    <div className="flag-row">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={String(checked)}
        className="toggle-track"
        data-checked={String(checked)}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}
