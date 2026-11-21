import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { PwaInstallGuideModal } from '../../src/components/assets/PwaInstallGuideModal';
import { usePwaStore, type BeforeInstallPromptEvent } from '../../src/stores/usePwaStore';

describe('PwaInstallGuideModal', () => {
  beforeEach(() => {
    usePwaStore.setState({
      isInstalled: false,
      installPrompt: null,
    });
  });

  it('renders guide steps and switches browser tabs', () => {
    render(<PwaInstallGuideModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('添加到手机桌面')).toBeInTheDocument();
    expect(screen.getByText('选择您的手机浏览器类型')).toBeInTheDocument();

    const xiaomiTab = screen.getByRole('button', { name: '小米浏览器' });
    fireEvent.click(xiaomiTab);
    expect(screen.getByText('授权桌面快捷方式权限')).toBeInTheDocument();

    const firefoxTab = screen.getByRole('button', { name: '火狐 Firefox' });
    fireEvent.click(firefoxTab);
    expect(screen.getByText('轻触地址栏快捷图标')).toBeInTheDocument();

    const safariTab = screen.getByRole('button', { name: '苹果 Safari' });
    fireEvent.click(safariTab);
    expect(screen.getByText('点击底部分享按钮')).toBeInTheDocument();
    expect(screen.getByText(/卸载应用或清理浏览器数据将清空账本/)).toBeInTheDocument();
  });

  it('renders direct install action when installPrompt is available', async () => {
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockPromptEvent = {
      platforms: ['android'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'android' }),
      prompt: promptMock,
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.setState({ installPrompt: mockPromptEvent });

    const onClose = vi.fn();
    render(<PwaInstallGuideModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('检测到当前浏览器支持一键安装')).toBeInTheDocument();
    const installBtn = screen.getByRole('button', { name: '立即安装' });

    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(promptMock).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays installed banner when isInstalled is true', () => {
    usePwaStore.setState({ isInstalled: true });

    render(<PwaInstallGuideModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('当前已在桌面独立应用模式中')).toBeInTheDocument();
  });
});
