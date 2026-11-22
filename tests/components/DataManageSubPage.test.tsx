import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataManageSubPage } from '../../src/components/assets/DataManageSubPage';

vi.mock('../../src/components/assets/WebDavSyncSection', () => ({
  WebDavSyncSection: () => <div data-testid="mock-cloud-sync">云端同步组件</div>,
}));

describe('DataManageSubPage', () => {
  it('renders cloud sync section and distinct backup and import options', () => {
    const handleOpenImport = vi.fn();
    render(<DataManageSubPage onOpenImport={handleOpenImport} />);

    expect(screen.getByTestId('mock-cloud-sync')).toBeInTheDocument();
    expect(screen.getByText('完整备份与恢复')).toBeInTheDocument();
    expect(screen.getByText('导出完整备份')).toBeInTheDocument();
    expect(screen.getByText('恢复完整备份')).toBeInTheDocument();
    expect(screen.getByText('账目导入与导出')).toBeInTheDocument();
    expect(screen.getByText('导入账本')).toBeInTheDocument();
    expect(screen.getByText('导出账本')).toBeInTheDocument();

    fireEvent.click(screen.getByText('导入账本'));
    expect(handleOpenImport).toHaveBeenCalledTimes(1);
  });

  it('opens export confirm modal when clicking export json row', () => {
    render(<DataManageSubPage />);

    fireEvent.click(screen.getByText('导出完整备份'));
    expect(screen.getByText('将导出包含所有账户、流水、分类和系统设置的 JSON 备份文件。')).toBeInTheDocument();
  });
});
