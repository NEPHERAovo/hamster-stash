export type BrowserFamily = 'xiaomi' | 'firefox' | 'safari' | 'chrome' | 'other';

export const detectBrowserFamily = (userAgent?: string): BrowserFamily => {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return 'other';

  if (/MiuiBrowser|XiaoMi/i.test(ua)) {
    return 'xiaomi';
  }
  if (/Firefox|FxiOS/i.test(ua)) {
    return 'firefox';
  }
  if (/iPhone|iPad|iPod/i.test(ua) && !/Chrome|CriOS|Firefox|FxiOS|MiuiBrowser/i.test(ua)) {
    return 'safari';
  }
  if (/Chrome|CriOS/i.test(ua)) {
    return 'chrome';
  }
  return 'other';
};

export const checkIsStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = typeof navigator !== 'undefined' && 'standalone' in navigator && Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  return Boolean(isStandaloneMedia || isIosStandalone);
};
