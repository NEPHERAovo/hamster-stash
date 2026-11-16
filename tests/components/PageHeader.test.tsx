import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PageHeader } from '../../src/components/layout/PageHeader';

describe('PageHeader component', () => {
  it('renders clean title without meta-pill when metaPill is omitted', () => {
    render(<PageHeader title="November 2026" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('November 2026');
    expect(screen.queryByText(/GENERAL LEDGER/i)).toBeNull();
  });

  it('handles month stepper buttons properly', () => {
    const handlePrev = vi.fn();
    const handleNext = vi.fn();

    render(
      <PageHeader
        title="November 2026"
        showMonthStep={true}
        onPrevMonth={handlePrev}
        onNextMonth={handleNext}
      />
    );

    const prevBtn = screen.getByTitle('上个月');
    const nextBtn = screen.getByTitle('下个月');

    fireEvent.click(prevBtn);
    expect(handlePrev).toHaveBeenCalledTimes(1);

    fireEvent.click(nextBtn);
    expect(handleNext).toHaveBeenCalledTimes(1);
  });

  it('renders centered title for subpages when centerTitle is true', () => {
    render(
      <PageHeader
        title="招商银行卡"
        centerTitle={true}
        leftAction={<button data-testid="back-btn">返回</button>}
      />
    );

    expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('招商银行卡');
  });
});
