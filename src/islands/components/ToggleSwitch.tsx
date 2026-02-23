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
 */
export function ToggleSwitch({ id, label, description, checked, onChange, testId }: ToggleSwitchProps) {
  const handleClick = () => {
    onChange(!checked);
  };

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
        aria-checked={checked ? "true" : "false"}
        className="toggle-track"
        onClick={handleClick}
        data-testid={testId}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}
