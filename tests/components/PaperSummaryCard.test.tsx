import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaperSummaryCard } from '../../src/components/ui/PaperSummaryCard';

describe('PaperSummaryCard', () => {
  it('renders receipt deckle card with washi tape and children', () => {
    const { container } = render(
      <PaperSummaryCard className="px-4" tapeClassName="-top-2">
        <span>Summary Content</span>
      </PaperSummaryCard>
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.className).toContain('paper-summary-card');
    expect(card.className).toContain('paper-deckle-bottom');
    expect(card.className).toContain('px-4');

    const tape = card.querySelector('.washi-tape');
    expect(tape).toBeInTheDocument();
    expect(tape?.className).toContain('-top-2');
    expect(screen.getByText('Summary Content')).toBeInTheDocument();
  });
});
