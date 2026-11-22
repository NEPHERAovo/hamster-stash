import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  isExporting: boolean;
  copied: boolean;
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
    isExporting: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ componentStack: errorInfo.componentStack || null });
    console.error('Unhandled app error in RootErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyTrace = async () => {
    const { error, componentStack } = this.state;
    const details = [
      `Error: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      `Stack:\n${error?.stack || 'No stack trace'}`,
      `Component Stack:\n${componentStack || 'No component stack'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      void 0;
    }
  };

  private handleExportData = async () => {
    try {
      this.setState({ isExporting: true });
      const { openDB } = await import('idb');
      const dump: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        localStorage: { ...localStorage },
      };

      try {
        const db = await openDB('hamsterStash_db');
        const stores = Array.from(db.objectStoreNames);
        for (const store of stores) {
          dump[store] = await db.getAll(store);
        }
      } catch {
        void 0;
      }

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hamsterstash_emergency_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`数据导出失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.setState({ isExporting: false });
    }
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
    if (!window.confirm('确定要清空全部数据库并重置吗？此操作将抹去本地记账数据。建议先点击【导出当前数据】。')) {
      return;
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        const { deleteDB } = await import('idb');
        await deleteDB('hamsterStash_db');
        await deleteDB('hamsterStash_sandbox_db');
      }
    } catch {
      void 0;
    } finally {
      await this.handleClearCachesAndReload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { error, componentStack, isExporting, copied } = this.state;
      const fullTrace = [
        error?.stack || error?.message || 'No stack trace available',
        componentStack ? `\nComponent Stack:${componentStack}` : '',
      ].filter(Boolean).join('\n');

      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center overflow-y-auto bg-(--paper-base) p-4 text-(--ink-primary) select-none">
          <div className="my-auto w-full max-w-md space-y-3.5 rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline) pb-3">
              <div className="flex items-center gap-2 text-(--color-expense)">
                <span className="flex size-7 items-center justify-center rounded-full bg-(--color-expense-bg) font-mono text-xs font-bold">
                  !
                </span>
                <h2 className="text-sm font-bold">应用运行遇到异常</h2>
              </div>
              <button
                type="button"
                onClick={this.handleCopyTrace}
                className="cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2 py-1 font-mono text-[11px] text-(--ink-secondary) hover:text-(--ink-primary)"
              >
                {copied ? '已复制' : '复制报错与Trace'}
              </button>
            </div>

            <div className="space-y-1">
              <div className="font-mono text-xs font-semibold text-(--color-expense)">
                {error?.name || 'Error'}: {error?.message || '未知错误'}
              </div>
              <p className="text-xs text-(--ink-secondary)">
                应用已拦截运行异常。您可以直接导出当前未损坏的数据，或清空数据库重置。
              </p>
            </div>

            <details className="font-mono text-[11px]">
              <summary className="cursor-pointer text-(--ink-tertiary) hover:text-(--ink-primary)">
                查看错误堆栈与Trace详情
              </summary>
              <pre className="mt-2 max-h-36 overflow-auto rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/70 p-2 text-[10px] leading-relaxed whitespace-pre-wrap text-(--ink-tertiary) select-text">
                {fullTrace}
              </pre>
            </details>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleExportData}
                  disabled={isExporting}
                  className="h-9 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-primary) transition-all hover:bg-(--paper-hover) active:scale-98 disabled:opacity-50"
                >
                  {isExporting ? '正在导出...' : '导出当前数据 (JSON)'}
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="h-9 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) transition-all active:scale-98"
                >
                  重新加载
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleClearCachesAndReload}
                  className="h-8 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sheet) text-[11px] font-medium text-(--ink-secondary) transition-all hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-98"
                >
                  清除缓存并重载
                </button>
                <button
                  type="button"
                  onClick={this.handleResetLocalData}
                  className="h-8 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--color-expense)/30 bg-(--color-expense-bg)/20 text-[11px] font-medium text-(--color-expense) transition-all hover:bg-(--color-expense-bg)/40 active:scale-98"
                >
                  清空数据库并重置
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
