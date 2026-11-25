import React from 'react';
import { ArrowsClockwiseIcon as RefreshCw, XIcon as X } from '@phosphor-icons/react';
import { usePwaStore } from '../../stores/usePwaStore';
import { PaperCard } from './PaperCard';

export const PwaUpdateBanner: React.FC = () => {
  const { needRefresh, dismissed, isUpdating, applyUpdate, dismissPrompt } = usePwaStore();

  if (!needRefresh || dismissed) return null;

  return (
    <div
      className="fixed left-1/2 z-60 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 select-none"
      style={{ bottom: 'calc(76px + var(--safe-bottom))' }}
      role="status"
      aria-live="polite"
    >
      <PaperCard rounded="lg" padding="none" className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 shadow-lg">
        <div className="flex min-w-0 items-center gap-2">
          <div className="paper-icon-box size-7 text-(--color-income)">
            <RefreshCw className={`size-3.5 stroke-2 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-(--ink-primary)">
              发现新版本资源
            </div>
            <div className="truncate text-[10px] text-(--ink-tertiary)">
              点击更新以加载最新离线缓存
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => void applyUpdate()}
            className="h-7 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) px-3 text-[11px] font-semibold text-(--btn-primary-fg) transition-all active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? '更新中...' : '立即更新'}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="flex size-7 cursor-pointer items-center justify-center rounded-(--btn-radius) text-(--ink-tertiary) transition-colors hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
            title="稍后提醒"
            aria-label="稍后提醒"
          >
            <X className="size-3.5 stroke-2" />
          </button>
        </div>
      </PaperCard>
    </div>
  );
};

export default PwaUpdateBanner;
