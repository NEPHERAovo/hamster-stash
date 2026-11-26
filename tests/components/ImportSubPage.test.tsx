import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import zlib from 'node:zlib';
import { ImportSubPage } from '../../src/components/settings/ImportSubPage';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

function encodeGbkMockAlipayCsv(text: string): Uint8Array {
  // Encode UTF-8 string bytes except we want a real GB18030 check; use ASCII + iconv? Instead build known GBK bytes for headers/fields
  const map: Record<string, number[]> = {
    交: [0xbd, 0xbb],
    易: [0xd2, 0xd7],
    时: [0xca, 0xb1],
    间: [0xbc, 0xe4],
    分: [0xb7, 0xd6],
    类: [0xc0, 0xe0],
    对: [0xb6, 0xd4],
    方: [0xb7, 0xbd],
    商: [0xc9, 0xcc],
    品: [0xc6, 0xb7],
    说: [0xcb, 0xb5],
    明: [0xc3, 0xf7],
    收: [0xca, 0xd5],
    支: [0xd6, 0xa7],
    金: [0xbd, 0xf0],
    额: [0xb6, 0xee],
    付: [0xb8, 0xb6],
    款: [0xbf, 0xee],
    式: [0xca, 0xbd],
    状: [0xd7, 0xb4],
    态: [0xcc, 0xac],
    订: [0xb6, 0xa9],
    单: [0xb5, 0xa5],
    号: [0xba, 0xc5],
    备: [0xb1, 0xb8],
    注: [0xd7, 0xa2],
    餐: [0xb2, 0xcd],
    饮: [0xd2, 0xfb],
    美: [0xc3, 0xc0],
    食: [0xca, 0xb3],
    出: [0xb3, 0xf6],
    花: [0xbb, 0xa8],
    呗: [0xdf, 0xc2],
    碰: [0xc5, 0xf6],
    一: [0xd2, 0xbb],
    下: [0xcf, 0xc2],
    立: [0xc1, 0xa2],
    减: [0xbc, 0xf5],
    成: [0xb3, 0xc9],
    功: [0xb9, 0xa6],
    关: [0xb9, 0xd8],
    闭: [0xb1, 0xd5],
    不: [0xb2, 0xbb],
    计: [0xbc, 0xc6],
    投: [0xcd, 0xb6],
    资: [0xd7, 0xca],
    理: [0xc0, 0xed],
    财: [0xb2, 0xc6],
    余: [0xd3, 0xe0],
    宝: [0xb1, 0xa6],
    益: [0xd2, 0xe6],
    发: [0xb7, 0xa2],
    放: [0xb7, 0xc5],
    午: [0xce, 0xe7],
    转: [0xd7, 0xaa],
    入: [0xc8, 0xeb],
  };
  const bytes: number[] = [];
  for (const ch of text) {
    if (map[ch]) {
      bytes.push(...map[ch]);
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function buildMinimalWeChatXlsx(): Uint8Array {
  const enc = new TextEncoder();
  const entries = [
    {
      name: 'xl/sharedStrings.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>交易时间</t></si><si><t>交易类型</t></si><si><t>交易对方</t></si><si><t>商品</t></si><si><t>收/支</t></si><si><t>金额(元)</t></si><si><t>支付方式</t></si><si><t>当前状态</t></si><si><t>交易单号</t></si><si><t>商户消费</t></si><si><t>美团</t></si><si><t>外卖午餐</t></si><si><t>支出</t></si><si><t>零钱</t></si><si><t>支付成功</t></si><si><t>已全额退款</t></si></sst>`
      ),
    },
    {
      name: 'xl/styles.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><cellXfs count="2"><xf numFmtId="0" xfId="0"/><xf numFmtId="164" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
      ),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c><c r="G1" t="s"><v>6</v></c><c r="H1" t="s"><v>7</v></c><c r="I1" t="s"><v>8</v></c></row><row r="2"><c r="A2" s="1"><v>46335.85625</v></c><c r="B2" t="s"><v>9</v></c><c r="C2" t="s"><v>10</v></c><c r="D2" t="s"><v>11</v></c><c r="E2" t="s"><v>12</v></c><c r="F2"><v>28.5</v></c><c r="G2" t="s"><v>13</v></c><c r="H2" t="s"><v>14</v></c><c r="I2" t="str"><v>wx_order_1</v></c></row><row r="3"><c r="A3" s="1"><v>46335.85625</v></c><c r="B3" t="s"><v>9</v></c><c r="C3" t="s"><v>10</v></c><c r="D3" t="s"><v>11</v></c><c r="E3" t="s"><v>12</v></c><c r="F3"><v>99.0</v></c><c r="G3" t="s"><v>13</v></c><c r="H3" t="s"><v>15</v></c><c r="I3" t="str"><v>wx_order_refund</v></c></row></sheetData></worksheet>`
      ),
    },
  ];

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const payload = new Uint8Array(zlib.deflateRawSync(entry.data));

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localParts.push(local, payload);
    centralParts.push(central);
    offset += local.length + payload.length;
  }

  const centralSize = centralParts.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

describe('ImportSubPage - Category Mapping & Bill Formats', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'utensils',
      color: 'var(--cat-food)',
      sortOrder: 1,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_market',
      name: '超市',
      type: 'expense',
      icon: 'basket',
      color: 'var(--cat-shop)',
      sortOrder: 2,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_transit',
      name: '交通',
      type: 'expense',
      icon: 'train-front',
      color: 'var(--cat-transit)',
      sortOrder: 3,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_shop',
      name: '购物',
      type: 'expense',
      icon: 'shopping-cart',
      color: 'var(--cat-shop)',
      sortOrder: 4,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'wallet',
      color: 'var(--color-income)',
      sortOrder: 1,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_invest',
      name: '理财',
      type: 'income',
      icon: 'trending-up',
      color: 'var(--color-income)',
      sortOrder: 2,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acct_1',
      name: '微信零钱',
      type: 'savings',
      balance: 100000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(() => {
    useCategoryStore.setState({
      categories: mockCategories,
      loadCategories: vi.fn().mockResolvedValue(undefined),
      createCategory: vi.fn(),
    });
    useAccountStore.setState({
      accounts: mockAccounts,
      loadAccounts: vi.fn().mockResolvedValue(undefined),
      createAccount: vi.fn().mockImplementation(async (inp) => ({
        id: `acct_${inp.name}`,
        name: inp.name,
        type: inp.type,
        balance: 0,
        currency: 'CNY',
        icon: 'wallet',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      })),
    });
    useLedgerStore.setState({
      transactions: [],
      importTransactions: vi.fn().mockResolvedValue({ importedCount: 0 }),
    });
  });

  it('maps raw category to discrete category without merged option strings', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 1 });
    useLedgerStore.setState({ importTransactions: importSpy });

    const csvContent = `"日期","分类名称","收支","金额","账户","备注"\r\n"2026-11-20","外卖","支出","35.00","微信零钱","午餐"`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));

    await waitFor(() => {
      expect(screen.getByText('外卖')).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole('combobox');
    const categorySelect = comboboxes[0];

    expect(categorySelect.textContent).not.toContain('餐饮超市交通购物');

    fireEvent.click(categorySelect);

    expect(screen.getByRole('option', { name: '餐饮' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '超市' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '购物' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '工资' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: '购物' }));
    expect(categorySelect.textContent).toContain('购物');

    fireEvent.click(screen.getByText(/下一步：确认导入/));
    fireEvent.click(screen.getByRole('button', { name: /确认导入/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId: 'cat_shop',
            amount: 3500,
            type: 'expense',
          }),
        ]),
        true
      );
    });
  });

  it('renders dropdown listbox via portal outside the table container when expanding category selection', async () => {
    const csvContent = `"日期","分类名称","收支","金额"\r\n"2026-11-20","打车","支出","20.00"`;
    const file = new File([csvContent], 'small.csv', { type: 'text/csv' });

    const { container } = render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('small.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));

    await waitFor(() => {
      expect(screen.getByText('打车')).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.click(categorySelect);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    expect(listbox.parentElement).toBe(document.body);
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.style.position).toBe('fixed');
  });

  it('renders full preset descriptions without truncation and supports wealth rollup and skipped inspection', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 2 });
    useLedgerStore.setState({ importTransactions: importSpy });

    const csvText = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,备注,',
      '2026-11-08 12:30:00,餐饮美食,A,午,支出,10.50,花呗&碰一下立减,交易成功,ali_1,,',
      '2026-11-08 12:00:00,餐饮美食,B,午,支出,20.00,花呗,交易关闭,ali_2,,',
      '2026-11-08 06:00:00,投资理财,C,余额宝-收益发放,不计收支,2.99,余额宝,交易成功,ali_3,,',
      '2026-11-07 08:00:00,投资理财,C,余额宝-转入,不计收支,100.00,余额宝,交易成功,ali_4,,',
    ].join('\r\n');
    const gbkBytes = encodeGbkMockAlipayCsv(csvText);
    const file = new File([gbkBytes.buffer as ArrayBuffer], 'alipay_wealth.csv', {
      type: 'text/csv',
    });

    render(<ImportSubPage onClose={vi.fn()} />);

    const wechatDesc = screen.getByText('支持 .xlsx / .csv，自动归类并过滤全额退款');
    expect(wechatDesc).not.toHaveClass('truncate');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：支付宝账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    expect(screen.getByText('理财日收益按月汇总入账')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 2 笔')).toBeInTheDocument();
      expect(screen.getByText('含理财月结 1 笔')).toBeInTheDocument();
      expect(screen.getByText('月度汇总')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /不计收支\/跳过/ }));
    expect(screen.getByText(/2026-11-07/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-08.*花呗.*交易关闭/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /确认导入 \(2 笔\)/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tx_imp_alipay_ali_1',
            type: 'expense',
            amount: 1050,
          }),
          expect.objectContaining({
            type: 'income',
            amount: 299,
            categoryId: 'cat_invest',
          }),
        ]),
        true
      );
    });
  });

  it('auto-detects Alipay GBK CSV, strips promo tags, skips closed/neutral rows, and creates credit account', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 1 });
    const createAccountSpy = vi.fn().mockResolvedValue({
      id: 'acct_huabei',
      name: '花呗',
      type: 'credit',
      balance: 0,
      currency: 'CNY',
      icon: 'credit-card',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    });
    useLedgerStore.setState({ importTransactions: importSpy });
    useAccountStore.setState({
      accounts: mockAccounts,
      loadAccounts: vi.fn().mockResolvedValue(undefined),
      createAccount: createAccountSpy,
    });

    const csvText = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,备注,',
      '2026-11-08 12:30:00,餐饮美食,A,午,支出,10.50,花呗&碰一下立减,交易成功,ali_1,,',
      '2026-11-08 12:00:00,餐饮美食,B,午,支出,20.00,花呗,交易关闭,ali_2,,',
      '2026-11-08 06:00:00,投资理财,C,余,不计收支,2.99,余额宝,交易成功,ali_3,,',
    ].join('\r\n');
    const gbkBytes = encodeGbkMockAlipayCsv(csvText);
    const file = new File([gbkBytes.buffer as ArrayBuffer], 'alipay.csv', { type: 'text/csv' });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：支付宝账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    expect(screen.getByText('过滤已关闭与全额退款')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 1 笔')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /确认导入 \(1 笔\)/ }));

    await waitFor(() => {
      expect(createAccountSpy).toHaveBeenCalledWith({
        name: '花呗',
        type: 'credit',
        initialBalance: 0,
      });
      expect(importSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            type: 'expense',
            amount: 1050,
            categoryId: 'cat_food',
            accountId: 'acct_huabei',
            ext: {
              importMeta: {
                source: 'alipay',
                orderId: 'ali_1',
              },
            },
          }),
        ],
        true
      );
    });
  });

  it('auto-detects WeChat XLSX, filters full refunds, and skips duplicate order IDs', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 0 });
    useLedgerStore.setState({
      transactions: [
        {
          id: 'tx_existing',
          type: 'expense',
          amount: 2850,
          categoryId: 'cat_food',
          accountId: 'acct_1',
          date: '2026-11-09',
          ext: {
            importMeta: {
              source: 'wechat',
              orderId: 'wx_order_1',
            },
          },
          createdAt: '',
          updatedAt: '',
        },
      ],
      importTransactions: importSpy,
    });

    const xlsxBytes = buildMinimalWeChatXlsx();
    const file = new File([xlsxBytes.buffer as ArrayBuffer], 'wechat.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：微信账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 0 笔')).toBeInTheDocument();
      expect(screen.getByText('重复 1 笔')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /确认导入 \(0 笔\)/ });
    expect(confirmBtn).toBeDisabled();
  });
});
