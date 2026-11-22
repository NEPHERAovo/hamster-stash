export const DB_NAME_PRODUCTION = 'hamsterStash_db';
export const DB_NAME_SANDBOX = 'hamsterStash_sandbox_db';

export const isSandboxModeActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sandbox') === 'true' || urlParams.get('debug') === 'true') {
      return true;
    }
    return localStorage.getItem('hamsterstash_sandbox_mode') === 'true';
  } catch {
    return false;
  }
};

export const getActiveDbName = (): string => {
  return isSandboxModeActive() ? DB_NAME_SANDBOX : DB_NAME_PRODUCTION;
};

export const setSandboxMode = (active: boolean): void => {
  if (typeof window === 'undefined') return;
  if (active) {
    localStorage.setItem('hamsterstash_sandbox_mode', 'true');
  } else {
    localStorage.removeItem('hamsterstash_sandbox_mode');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('sandbox');
      url.searchParams.delete('debug');
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch {
      void 0;
    }
  }
  window.location.reload();
};

export const resetSandboxData = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  const { deleteDB } = await import('idb');
  await deleteDB(DB_NAME_SANDBOX);
  window.location.reload();
};

export const DB_NAME = DB_NAME_PRODUCTION;
export const DB_VERSION = 6;

export const STORES = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
  PLUGIN_DATA: 'plugin_data',
  PLUGIN_SETTINGS: 'plugin_settings',
  ATTACHMENTS: 'attachments',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];
