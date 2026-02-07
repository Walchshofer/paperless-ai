import { h } from 'preact';

interface DiffItem {
  key: string;
  currentValue?: string | number | boolean | string[] | null;
  newValue: string | number | boolean | string[] | null;
  category?: string;
}

interface DiffTableProps {
  changes: DiffItem[];
}

/**
 * Monospaced diff table showing old->new values with color-coded highlighting.
 */
export function DiffTable({ changes }: DiffTableProps) {
  return (
    <table className="diff-table" data-testid="diff-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Current</th>
          <th />
          <th>New</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change, index) => (
          <tr key={index} data-testid={`diff-item-${index}`}>
            <td>
              <div className="font-medium">{change.key}</div>
              {change.category && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{change.category}</div>
              )}
            </td>
            <td>
              <span className="diff-value-old" data-testid={`current-value-${index}`}>
                {String(change.currentValue ?? 'not set')}
              </span>
            </td>
            <td style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '0 0.25rem' }}>
              →
            </td>
            <td>
              <span className="diff-value-new" data-testid={`new-value-${index}`}>
                {String(change.newValue)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
