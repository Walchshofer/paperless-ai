import { render, fireEvent, screen } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import ShadcnCompat from '../shadcn-compat';

describe('shadcn/ui compatibility smoke', () => {
  it('mounts without throwing and basic interactions work', async () => {
    const { container } = render(<ShadcnCompat />);
    expect(container).toBeTruthy();

    // Dialog: open -> content visible
    const openBtn = screen.getByText('Open Dialog');
    expect(openBtn).toBeTruthy();
    await fireEvent.click(openBtn);
    // After clicking, dialog title should be present
    expect(screen.getByText('Dialog Title')).toBeTruthy();

    // Switch: toggle
    const toggleLabel = screen.getByText(/Off|On/);
    expect(toggleLabel).toBeTruthy();
  });
});
