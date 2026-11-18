import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SubPageShell, SubPageBackButton } from '../../src/components/layout/SubPageShell';

describe('SubPageShell', () => {
  it('renders header and children when open', () => {
    render(
      <SubPageShell
        isOpen={true}
        onClose={vi.fn()}
        header={<div data-testid="test-header">Header Title</div>}
      >
        <div data-testid="test-body">Body Content</div>
      </SubPageShell>
    );

    expect(screen.getByTestId('test-header')).toBeDefined();
    expect(screen.getByTestId('test-body')).toBeDefined();
    expect(screen.getByText('Header Title')).toBeDefined();
    expect(screen.getByText('Body Content')).toBeDefined();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <SubPageShell
        isOpen={false}
        onClose={vi.fn()}
        header={<div>Header</div>}
      >
        <div>Content</div>
      </SubPageShell>
    );

    expect(container.firstChild).toBeNull();
  });

  it('triggers smooth close when SubPageBackButton is clicked', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <SubPageShell
        isOpen={true}
        onClose={handleClose}
        header={<SubPageBackButton label="Back" />}
      >
        <div>Content</div>
      </SubPageShell>
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
