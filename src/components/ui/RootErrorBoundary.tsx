import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled app error in RootErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCachesAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch {
      void 0;
    } finally {
      window.location.reload();
    }
  };

  private handleResetLocalData = async () => {
    if (!window.confirm('重置将清除当前设备上的全部本地缓存与记账数据，请确认是否继续？')) {
      return;
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('hamsterStash_db');
        indexedDB.deleteDatabase('hamsterStash_sandbox_db');
      }
    } catch {
      void 0;
    } finally {
      await this.handleClearCachesAndReload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-(--paper-base) p-6 text-(--ink-primary) select-none">
          <div className="w-full max-w-sm space-y-4 rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) p-5 shadow-lg">
            <div className="flex items-center gap-2 text-(--color-expense)">
              <span className="flex size-7 items-center justify-center rounded-full bg-(--color-expense-bg) font-mono text-xs font-bold">
                !
              </span>
              <h2 className="text-sm font-bold">应用运行遇到异常</h2>
            </div>

            <p className="text-xs leading-relaxed text-(--ink-secondary)">
              新版本资源更新或本地数据解析异常导致页面中断，请尝试以下修复方式：
            </p>

            {this.state.error && (
              <div className="max-h-24 overflow-y-auto rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/60 p-2 font-mono text-[11px] text-(--ink-tertiary)">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="h-9 w-full cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) transition-all active:scale-98"
              >
                重新加载
              </button>

              <button
                type="button"
                onClick={this.handleClearCachesAndReload}
                className="h-9 w-full cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) transition-all hover:text-(--ink-primary) active:scale-98"
              >
                清理新版本缓存并重试
              </button>

              <button
                type="button"
                onClick={this.handleResetLocalData}
                className="h-8 w-full cursor-pointer rounded-(--btn-radius) text-[11px] font-semibold text-(--color-expense) hover:underline"
              >
                重置本地所有数据
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
