import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectBrowserFamily, checkIsStandalone } from '../../src/utils/browser';

describe('detectBrowserFamily', () => {
  it('detects Xiaomi browser from userAgent', () => {
    const miuiUa =
      'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23116PN5BC) AppleWebKit/537.36 Chrome/118.0.5993.80 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.8.40120';
    expect(detectBrowserFamily(miuiUa)).toBe('xiaomi');
  });

  it('detects Firefox on Android and iOS', () => {
    const firefoxAndroid = 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0';
    const firefoxIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) FxiOS/128.0 Mobile/15E148 Safari/605.1.15';
    expect(detectBrowserFamily(firefoxAndroid)).toBe('firefox');
    expect(detectBrowserFamily(firefoxIos)).toBe('firefox');
  });

  it('detects Safari on iOS excluding other browsers', () => {
    const safariIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    expect(detectBrowserFamily(safariIos)).toBe('safari');
  });

  it('detects Chrome on Android and desktop', () => {
    const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';
    expect(detectBrowserFamily(chromeAndroid)).toBe('chrome');
  });

  it('falls back to other when userAgent is unknown or empty', () => {
    expect(detectBrowserFamily('')).toBe('other');
    expect(detectBrowserFamily('CustomAgent/1.0')).toBe('other');
  });
});

describe('checkIsStandalone', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('returns true when display-mode is standalone', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(checkIsStandalone()).toBe(true);
  });

  it('returns false when browser is standard tab', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(checkIsStandalone()).toBe(false);
  });
});
