import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { OwnedItemsSummaryCard } from '../../src/plugins/owned-items/components/OwnedItemsSummaryCard';
import { ItemDetailSubPage } from '../../src/plugins/owned-items/components/ItemDetailSubPage';
import { usePluginItemStore } from '../../src/plugins/owned-items/store/usePluginItemStore';
import { usePluginUIStore } from '../../src/core/plugin/SlotStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Item } from '../../src/plugins/owned-items/types';
import type { Transaction } from '../../src/plugin-sdk';

describe('OwnedItemsSummaryCard (持有插件总览卡片)', () => {
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
    usePluginItemStore.setState({ items: [dummyItem], loading: false });
    useLedgerStore.setState({ transactions: [dummyTx], allTransactions: [dummyTx] });
    usePluginUIStore.setState({
      registeredSubPages: { 'item-list': () => React.createElement('div', null, 'ItemList') },
      registeredModals: { 'item-form': () => React.createElement('div', null, 'ItemForm') },
      activeSubPage: null,
      activeModal: null,
    });
  });

  it('展示正确的持有名称与在持统计', () => {
    render(<OwnedItemsSummaryCard />);

    expect(screen.getByText('物品')).toBeInTheDocument();
    expect(screen.getByText('1 件在用')).toBeInTheDocument();
    expect(screen.getByText('Nintendo Switch')).toBeInTheDocument();
    expect(screen.getByText('总投入')).toBeInTheDocument();
    expect(screen.getByText('日均成本')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(usePluginUIStore.getState().activeSubPage?.id).toBe('item-list');
  });

  it('空列表时展示手帐风占位文案且不显示冗余新建按钮', () => {
    usePluginItemStore.setState({ items: [], loading: false });
    useLedgerStore.setState({ transactions: [], allTransactions: [] });

    render(<OwnedItemsSummaryCard />);

    expect(screen.getByText('暂无记录')).toBeInTheDocument();
    expect(screen.queryByText('新建')).not.toBeInTheDocument();
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
});
