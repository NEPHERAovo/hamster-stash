import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { ItemDetailSubPage } from '../../src/plugins/owned-items/components/ItemDetailSubPage';
import { ItemListSubPage } from '../../src/plugins/owned-items/components/ItemListSubPage';
import { ItemFormModal } from '../../src/plugins/owned-items/components/ItemFormModal';
import { usePluginItemStore } from '../../src/plugins/owned-items/store/usePluginItemStore';
import { usePluginUIStore } from '../../src/core/plugin/SlotStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Item } from '../../src/plugins/owned-items/types';
import type { Transaction } from '../../src/plugin-sdk';

describe('OwnedItems Plugin Components', () => {
  const dummyItem: Item = {
    id: 'item_switch',
    name: 'Nintendo Switch',
    icon: 'gamepad',
    status: 'using',
    buyDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyTx: Transaction = {
    id: 'tx_switch_buy',
    type: 'expense',
    amount: 200000,
    accountId: 'acct_1',
    categoryId: 'cat_shop',
    date: '2026-01-01',
    ext: {
      'owned-items': {
        itemId: 'item_switch',
        itemRole: 'buy',
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    usePluginItemStore.setState({ items: [dummyItem], loading: false, sortOption: 'date-desc' });
    useLedgerStore.setState({ transactions: [dummyTx] });
    usePluginUIStore.setState({
      registeredSubPages: { 'item-list': () => React.createElement('div', null, 'ItemList') },
      registeredModals: { 'item-form': () => React.createElement('div', null, 'ItemForm') },
      activeSubPage: null,
      activeModal: null,
    });
  });

  it('renders generic "物品详情" for physical items and "订阅详情" for subscriptions', () => {
    const { rerender } = render(
      <ItemDetailSubPage onClose={() => {}} params={{ itemId: 'item_switch' }} />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('物品详情');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nintendo Switch');

    const subItem: Item = {
      ...dummyItem,
      id: 'sub_netflix',
      name: 'Netflix',
      kind: 'subscription',
      billingCycle: 'month',
    };
    act(() => {
      usePluginItemStore.setState({ items: [subItem] });
    });

    act(() => {
      rerender(
        <ItemDetailSubPage onClose={() => {}} params={{ itemId: 'sub_netflix' }} />
      );
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('订阅详情');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Netflix');
  });

  it('groups 支出/收益 under 关联账单 and 售出/闲置/赠送/报废 under 处置 with date support', async () => {
    const existingIncome: Transaction = {
      id: 'tx_existing_inc',
      type: 'income',
      amount: 150000,
      accountId: 'acct_1',
      categoryId: 'cat_other_in',
      date: '2026-06-15',
      note: '闲鱼出卡带',
      createdAt: '2026-06-15T10:00:00.000Z',
      updatedAt: '2026-06-15T10:00:00.000Z',
    };
    const existingExpense: Transaction = {
      id: 'tx_existing_exp',
      type: 'expense',
      amount: 5000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-06-16',
      note: '普通支出不应出现在售出中',
      createdAt: '2026-06-16T10:00:00.000Z',
      updatedAt: '2026-06-16T10:00:00.000Z',
    };

    const updateSpy = vi.fn().mockResolvedValue(existingIncome);
    const changeStatusSpy = vi.fn().mockResolvedValue({ ...dummyItem, status: 'sold' });
    usePluginItemStore.setState({ items: [dummyItem], changeStatus: changeStatusSpy });
    useLedgerStore.setState({
      transactions: [dummyTx, existingIncome, existingExpense],
      updateTransaction: updateSpy,
    });

    render(<ItemDetailSubPage onClose={() => {}} params={{ itemId: 'item_switch' }} />);

    expect(screen.getByRole('button', { name: '关联账单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '处置' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '闲置' })).toBeNull();
    expect(screen.queryByRole('button', { name: '报废' })).toBeNull();
    expect(screen.queryByRole('button', { name: '赠送' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '关联账单' }));
    expect(screen.getByRole('button', { name: '支出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收益' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收益' }));
    expect(screen.getByText('闲鱼出卡带')).toBeInTheDocument();
    expect(screen.queryByText('普通支出不应出现在售出中')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '处置' }));
    expect(screen.getByRole('button', { name: '售出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '闲置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '赠送' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '报废' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '闲置' }));
    expect(screen.getByText('闲置日期')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => {
      expect(changeStatusSpy).toHaveBeenCalledWith(
        'item_switch',
        'idle',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '处置' }));
    fireEvent.click(screen.getByRole('button', { name: '售出' }));
    fireEvent.click(screen.getByRole('button', { name: '已有收入' }));

    expect(screen.getByText('闲鱼出卡带')).toBeInTheDocument();
    expect(screen.queryByText('普通支出不应出现在售出中')).toBeNull();

    fireEvent.click(screen.getByText('闲鱼出卡带'));
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'tx_existing_inc',
        expect.objectContaining({
          ext: expect.objectContaining({
            'owned-items': expect.objectContaining({
              itemId: 'item_switch',
              itemRole: 'sell',
            }),
          }),
        })
      );
    });
    expect(changeStatusSpy).toHaveBeenCalledWith('item_switch', 'sold', '2026-06-15');
  });

  it('displays item filter counts without parentheses using compact sizing in ItemListSubPage', () => {
    const soldItem: Item = {
      ...dummyItem,
      id: 'item_camera',
      name: 'Sony Camera',
      status: 'sold',
      endDate: '2026-06-01',
    };

    act(() => {
      usePluginItemStore.setState({ items: [dummyItem, soldItem], loading: false });
    });

    render(<ItemListSubPage />);

    const usingBtn = screen.getByRole('button', { name: '在用1' });
    const soldBtn = screen.getByRole('button', { name: '已出1' });
    expect(usingBtn).toHaveTextContent('在用1');
    expect(soldBtn).toHaveTextContent('已出1');
    expect(usingBtn.textContent).not.toMatch(/\(|\)|（|）/);
    expect(usingBtn.className).toContain('px-1.5');

    fireEvent.click(soldBtn);
    expect(screen.getByText('Sony Camera')).toBeInTheDocument();
    expect(screen.queryByText('Nintendo Switch')).toBeNull();
  });

  it('reorders items in ItemListSubPage when selecting time, cost, and daily cost sort options', () => {
    const itemA: Item = {
      ...dummyItem,
      id: 'item_a',
      name: '物品A_最贵但早买',
      buyDate: '2026-01-01',
      endDate: '2026-01-20',
    };
    const itemB: Item = {
      ...dummyItem,
      id: 'item_b',
      name: '物品B_最便宜最新',
      buyDate: '2026-11-01',
      endDate: '2026-11-02',
    };
    const itemC: Item = {
      ...dummyItem,
      id: 'item_c',
      name: '物品C_日均最高',
      buyDate: '2026-06-01',
      endDate: '2026-06-02',
    };

    const txs: Transaction[] = [
      { ...dummyTx, id: 'tx_a', amount: 300000, ext: { 'owned-items': { itemId: 'item_a', itemRole: 'buy' } } },
      { ...dummyTx, id: 'tx_b', amount: 10000, ext: { 'owned-items': { itemId: 'item_b', itemRole: 'buy' } } },
      { ...dummyTx, id: 'tx_c', amount: 100000, ext: { 'owned-items': { itemId: 'item_c', itemRole: 'buy' } } },
    ];

    act(() => {
      usePluginItemStore.setState({ items: [itemA, itemB, itemC], loading: false, sortOption: 'date-desc' });
      useLedgerStore.setState({ transactions: txs });
    });

    const { container } = render(<ItemListSubPage />);

    const getCardNames = () =>
      Array.from(container.querySelectorAll('[role="button"] span.font-semibold.truncate')).map(
        (el) => el.textContent
      );

    expect(getCardNames()).toEqual(['物品B_最便宜最新', '物品C_日均最高', '物品A_最贵但早买']);

    const sortPill = screen.getByRole('combobox', { name: '排序方式' });
    expect(sortPill.textContent).toContain('时间 ↓');

    fireEvent.click(sortPill);
    fireEvent.click(screen.getByRole('option', { name: '按费用 · 从高到低' }));
    expect(sortPill.textContent).toContain('费用 ↓');
    expect(getCardNames()).toEqual(['物品A_最贵但早买', '物品C_日均最高', '物品B_最便宜最新']);

    fireEvent.click(sortPill);
    fireEvent.click(screen.getByRole('option', { name: '按日均 · 从高到低' }));
    expect(sortPill.textContent).toContain('日均 ↓');
    expect(getCardNames()).toEqual(['物品C_日均最高', '物品A_最贵但早买', '物品B_最便宜最新']);
  });

  it('links an existing unlinked expense in-place when creating a new item in ItemFormModal', async () => {
    const existingExpense: Transaction = {
      id: 'tx_unlinked_buy',
      type: 'expense',
      amount: 129900,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-24',
      note: 'AirPods Pro',
      createdAt: '2026-11-24T14:00:00.000Z',
      updatedAt: '2026-11-24T14:00:00.000Z',
    };

    const recordSpy = vi.fn();
    const updateSpy = vi.fn().mockResolvedValue(existingExpense);
    const createItemSpy = vi.fn().mockResolvedValue({
      ...dummyItem,
      id: 'item_airpods',
      name: 'AirPods Pro',
      buyDate: '2026-11-24',
    });

    usePluginItemStore.setState({
      items: [],
      createItem: createItemSpy,
    });
    useLedgerStore.setState({
      transactions: [existingExpense],
      recordTransaction: recordSpy,
      updateTransaction: updateSpy,
    });

    const onClose = vi.fn();
    render(<ItemFormModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '关联已有账单' }));
    fireEvent.click(screen.getByText('AirPods Pro'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认添加' }));
    });

    expect(createItemSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'AirPods Pro',
        buyDate: '2026-11-24',
      })
    );
    expect(updateSpy).toHaveBeenCalledWith(
      'tx_unlinked_buy',
      expect.objectContaining({
        ext: expect.objectContaining({
          'owned-items': {
            itemId: 'item_airpods',
            itemRole: 'buy',
            kind: 'physical',
          },
        }),
      })
    );
    expect(recordSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
