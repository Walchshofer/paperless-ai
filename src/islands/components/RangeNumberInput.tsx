import { h } from 'preact';

interface RangeNumberInputProps {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  testId: string;
}

/**
 * Linked range slider + number input that sync values.
 */
export function RangeNumberInput({
  id, label, description, value, min, max, step = 1, unit = '', onChange, testId
}: RangeNumberInputProps) {
  const handleInput = (e: Event) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) onChange(val);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
        {unit && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        )}
      </div>
      <div className="range-number-group">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleInput}
          aria-label={`${label} slider`}
        />
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleInput}
          data-testid={testId}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}
