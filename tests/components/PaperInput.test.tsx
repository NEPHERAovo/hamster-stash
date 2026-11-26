import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperInput } from '../../src/components/ui/PaperInput';

describe('PaperInput', () => {
  it('defaults enterKeyHint to done and blurs on Enter', () => {
    render(<PaperInput placeholder="备注" />);
    const input = screen.getByPlaceholderText('备注') as HTMLInputElement;
    expect(input.getAttribute('enterkeyhint')).toBe('done');

    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).not.toBe(input);
  });

  it('respects custom enterKeyHint and skips blur during IME composition', () => {
    const onKeyDown = vi.fn();
    render(<PaperInput placeholder="搜索" enterKeyHint="search" onKeyDown={onKeyDown} />);
    const input = screen.getByPlaceholderText('搜索') as HTMLInputElement;
    expect(input.getAttribute('enterkeyhint')).toBe('search');

    input.focus();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });
});
