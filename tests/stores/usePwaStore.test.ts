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
});
