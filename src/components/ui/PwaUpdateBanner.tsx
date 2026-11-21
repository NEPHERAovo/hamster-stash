import React from 'react';
import { ArrowsClockwise as RefreshCw, X } from '@phosphor-icons/react';
import { usePwaStore } from '../../stores/usePwaStore';

export const PwaUpdateBanner: React.FC = () => {
  const { needRefresh, dismissed, isUpdating, applyUpdate, dismissPrompt } = usePwaStore();

  if (!needRefresh || dismissed) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-60 w-[calc(100%-32px)] max-w-[398px] select-none"
      style={{ bottom: 'calc(76px + var(--safe-bottom))' }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg) shadow-lg px-3.5 py-2.5 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) text-(--color-income) flex items-center justify-center shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 stroke-2 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-(--ink-primary) truncate">
              发现新版本资源
            </div>
            <div className="text-[10px] text-(--ink-tertiary) truncate">
              点击更新以加载最新离线缓存
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void applyUpdate()}
            className="h-7 px-3 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-[11px] font-semibold cursor-pointer active:scale-95 transition-all disabled:opacity-50"
          >
            {isUpdating ? '更新中...' : '立即更新'}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-pointer"
            title="稍后提醒"
            aria-label="稍后提醒"
          >
            <X className="w-3.5 h-3.5 stroke-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdateBanner;
