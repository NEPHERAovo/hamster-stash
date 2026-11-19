import React from 'react';
import { Check } from 'lucide-react';
import { useThemeStore, THEME_OPTIONS, type ThemeOption } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

export interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className }) => {
  const { isDark, colorMode, lightThemeId, darkThemeId, setTheme } = useThemeStore();

  const lightThemes = THEME_OPTIONS.filter((t) => !t.isDark);
  const darkThemes = THEME_OPTIONS.filter((t) => t.isDark);

  const handleSelect = (theme: ThemeOption) => {
    setTheme(theme.id);
  };

  const renderGroup = (
    title: string,
    statusLabel: string,
    themes: ThemeOption[],
    selectedId: string,
    isGroupActive: boolean
  ) => (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono text-(--ink-tertiary) tracking-wider mb-1.5">
        <span>{title}</span>
        <span className={cn(isGroupActive ? 'text-(--color-accent) font-semibold' : 'text-(--ink-faint)')}>
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {themes.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              className={cn(
                'flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-[3px] transition-all cursor-pointer text-center border',
                isSelected && isGroupActive
                  ? 'bg-(--paper-sunken) border-(--rule-hairline) shadow-2xs font-semibold text-(--ink-solid)'
                  : isSelected
                    ? 'bg-(--paper-sunken)/50 border-dashed border-(--rule-hairline) font-medium text-(--ink-primary)'
                    : 'border-transparent text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50'
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
  );

  return (
    <div className={cn('space-y-3 select-none', className)}>
      {renderGroup(
        '浅色纸张',
        !isDark ? '当前生效' : colorMode === 'auto' ? '自动浅色默认' : '浅色偏好',
        lightThemes,
        lightThemeId,
        !isDark
      )}
      {renderGroup(
        '深色纸张',
        isDark ? '当前生效' : colorMode === 'auto' ? '自动深色默认' : '深色偏好',
        darkThemes,
        darkThemeId,
        isDark
      )}
    </div>
  );
};

export default ThemeSelector;
