import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PaperSelect } from '../../src/components/ui/PaperSelect';

describe('PaperSelect', () => {
  it('renders with options and shows selected value', () => {
    const handleChange = vi.fn();

    render(
      <PaperSelect
        value="opt2"
        onChange={handleChange}
        options={[
          { value: 'opt1', label: '选项一' },
          { value: 'opt2', label: '选项二' },
          { value: 'opt3', label: '选项三' },
        ]}
      />
    );

    expect(screen.getByRole('combobox')).toHaveValue('opt2');
    // The combobox button should display the selected label
    expect(screen.getByRole('combobox').textContent).toContain('选项二');
  });

  it('renders with option children and extracts labels and values', () => {
    const handleChange = vi.fn();

    render(
      <PaperSelect value="banana" onChange={handleChange}>
        <option value="apple">苹果</option>
        <option value="banana">香蕉</option>
        <option value="orange">橙子</option>
      </PaperSelect>
    );

    expect(screen.getByRole('combobox').textContent).toContain('香蕉');
    expect(screen.getByRole('combobox')).toHaveValue('banana');
  });

  it('opens popup when clicked and allows selecting an option', () => {
    const handleChange = vi.fn();

    render(
      <PaperSelect
        value="apple"
        onChange={handleChange}
        options={[
          { value: 'apple', label: '苹果' },
          { value: 'banana', label: '香蕉' },
        ]}
      />
    );

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    // Listbox should be visible
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const bananaOption = screen.getByRole('option', { name: '香蕉' });
    fireEvent.click(bananaOption);

    expect(handleChange).toHaveBeenCalled();
    const [event, val] = handleChange.mock.calls[0];
    expect(event.target.value).toBe('banana');
    expect(val).toBe('banana');
  });

  it('does not open when disabled', () => {
    render(
      <PaperSelect
        disabled={true}
        value="opt1"
        options={[{ value: 'opt1', label: '选项一' }]}
      />
    );

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('adapts popup placement to top when bottom space is constrained', () => {
    const { container } = render(
      <PaperSelect
        value="opt1"
        options={[
          { value: 'opt1', label: '选项一' },
          { value: 'opt2', label: '选项二' },
        ]}
      />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 540,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 500,
      toJSON: () => {},
    });
    vi.stubGlobal('innerHeight', 600);

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toContain('bottom-full');
  });

  it('correctly handles optgroup children without concatenating child option labels', () => {
    const handleChange = vi.fn();

    render(
      <PaperSelect value="cat_food" onChange={handleChange}>
        <optgroup label="支出">
          <option value="cat_food">餐饮</option>
          <option value="cat_market">超市</option>
          <option value="cat_transit">交通</option>
        </optgroup>
        <optgroup label="收入">
          <option value="cat_salary">工资</option>
          <option value="cat_bonus">奖金</option>
        </optgroup>
      </PaperSelect>
    );

    const combobox = screen.getByRole('combobox');
    expect(combobox.textContent).toContain('餐饮');
    expect(combobox.textContent).not.toContain('餐饮超市交通');

    fireEvent.click(combobox);

    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('收入')).toBeInTheDocument();

    const transitOption = screen.getByRole('option', { name: '交通' });
    expect(transitOption).toBeInTheDocument();

    fireEvent.click(transitOption);

    expect(handleChange).toHaveBeenCalled();
    const [event, val] = handleChange.mock.calls[0];
    expect(event.target.value).toBe('cat_transit');
    expect(val).toBe('cat_transit');
  });
});