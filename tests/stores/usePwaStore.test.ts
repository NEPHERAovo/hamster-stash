import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePwaStore, type BeforeInstallPromptEvent } from '../../src/stores/usePwaStore';

describe('usePwaStore', () => {
  beforeEach(() => {
    usePwaStore.setState({
      needRefresh: false,
      dismissed: false,
      isChecking: false,
      isUpdating: false,
      isInstalled: false,
      installPrompt: null,
      updateHandler: null,
      registration: null,
    });
  });

  it('manages installPrompt and direct installation flow when accepted', async () => {
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = {
      platforms: ['android'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'android' }),
      prompt: promptMock,
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setInstallPrompt(mockEvent);
    expect(usePwaStore.getState().installPrompt).toBe(mockEvent);

    const result = await usePwaStore.getState().promptInstall();
    expect(result).toBe('accepted');
    expect(promptMock).toHaveBeenCalledOnce();
    expect(usePwaStore.getState().isInstalled).toBe(true);
    expect(usePwaStore.getState().installPrompt).toBeNull();
  });

  it('handles dismissed install choices gracefully', async () => {
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = {
      platforms: ['android'],
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'android' }),
      prompt: promptMock,
    } as unknown as BeforeInstallPromptEvent;

    usePwaStore.getState().setInstallPrompt(mockEvent);
    const result = await usePwaStore.getState().promptInstall();
    expect(result).toBe('dismissed');
    expect(usePwaStore.getState().isInstalled).toBe(false);
    expect(usePwaStore.getState().installPrompt).toBeNull();
  });

  it('returns unsupported when promptInstall is called without prompt event', async () => {
    const result = await usePwaStore.getState().promptInstall();
    expect(result).toBe('unsupported');
  });

  it('marks installed when appinstalled event occurs', () => {
    usePwaStore.getState().setInstallPrompt({} as BeforeInstallPromptEvent);
    usePwaStore.getState().markInstalled();
    expect(usePwaStore.getState().isInstalled).toBe(true);
    expect(usePwaStore.getState().installPrompt).toBeNull();
  });

  it('triggers reload fallback after exactly 3000ms when applying update', async () => {
    vi.useFakeTimers();
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });

    const updateHandlerMock = vi.fn().mockResolvedValue(undefined);
    const postMessageMock = vi.fn();
    const mockRegistration = {
      waiting: { postMessage: postMessageMock },
    } as unknown as ServiceWorkerRegistration;

    usePwaStore.getState().bindServiceWorker(updateHandlerMock, mockRegistration);
    const updatePromise = usePwaStore.getState().applyUpdate();
    await Promise.resolve();

    expect(usePwaStore.getState().isUpdating).toBe(true);
    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(updateHandlerMock).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(2999);
    expect(reloadMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(reloadMock).toHaveBeenCalledOnce();

    await updatePromise;
    vi.useRealTimers();
  });
});
