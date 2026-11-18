export const DB_NAME = 'hamsterStash_db';
export const DB_VERSION = 5;

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
