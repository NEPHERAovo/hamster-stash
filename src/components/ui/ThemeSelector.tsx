import React from 'react';
import { useThemeStore, THEME_OPTIONS } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';
import { Check } from 'lucide-react';

export interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className }) => {
  const { currentThemeId, setTheme } = useThemeStore();

  const lightThemes = THEME_OPTIONS.filter((t) => !t.isDark);
  const darkThemes = THEME_OPTIONS.filter((t) => t.isDark);

  return (
    <div className={cn('space-y-3 select-none', className)}>
      <div>
        <div className="text-[10px] font-mono text-(--ink-tertiary) uppercase tracking-wider mb-1.5">
          <span>浅色</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {lightThemes.map((t) => {
            const isSelected = currentThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-[3px] transition-all cursor-pointer text-center',
                  isSelected
                    ? 'bg-(--paper-sunken) -rotate-1 shadow-2xs font-semibold text-(--ink-solid)'
                    : 'text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50'
                )}
                title={t.name}
              >
                <span
                  className="w-5 h-5 rounded-full border border-(--rule-hairline) shrink-0 flex items-center justify-center shadow-2xs"
                  style={{ backgroundColor: t.colorDot }}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </span>
                <span className="text-[10px] leading-tight truncate w-full">
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-mono text-(--ink-tertiary) uppercase tracking-wider mb-1.5">
          <span>深色</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {darkThemes.map((t) => {
            const isSelected = currentThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-[3px] transition-all cursor-pointer text-center',
                  isSelected
                    ? 'bg-(--paper-sunken) -rotate-1 shadow-2xs font-semibold text-(--ink-solid)'
                    : 'text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50'
                )}
                title={t.name}
              >
                <span
                  className="w-5 h-5 rounded-full border border-(--rule-hairline) shrink-0 flex items-center justify-center shadow-2xs"
                  style={{ backgroundColor: t.colorDot }}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </span>
                <span className="text-[10px] leading-tight truncate w-full">
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;
