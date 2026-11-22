import React, { useState } from 'react';
import { DownloadSimpleIcon as Download, CheckIcon as Check, ListIcon as Menu, DotsThreeVerticalIcon as MoreVertical, ShareNetworkIcon as Share, PlusSquareIcon as PlusSquare, ShieldCheckIcon as ShieldCheck, InfoIcon as Info, DeviceMobileIcon as Smartphone } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { PaperChip } from '../ui/PaperChip';
import { usePwaStore } from '../../stores/usePwaStore';
import { detectBrowserFamily, type BrowserFamily } from '../../utils/browser';
import { toast } from '../../stores/useToastStore';

export interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  number: string;
  title: string;
  description: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BROWSER_OPTIONS: Array<{ key: BrowserFamily; label: string }> = [
  { key: 'xiaomi', label: '小米浏览器' },
  { key: 'firefox', label: '火狐 Firefox' },
  { key: 'safari', label: '苹果 Safari' },
  { key: 'chrome', label: 'Chrome / 通用' },
];

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstalled, installPrompt, promptInstall } = usePwaStore();
  const [selectedFamily, setSelectedFamily] = useState<BrowserFamily>(() => {
    const detected = detectBrowserFamily();
    return detected === 'other' ? 'chrome' : detected;
  });
  const [isPrompting, setIsPrompting] = useState(false);

  const handleDirectInstall = async () => {
    if (!installPrompt || isPrompting) return;
    setIsPrompting(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        onClose();
      }
    } catch {
      toast.error('唤起安装对话框失败');
    } finally {
      setIsPrompting(false);
    }
  };

  const renderSteps = (): GuideStep[] => {
    switch (selectedFamily) {
      case 'xiaomi':
        return [
          {
            number: '01',
            title: '授权桌面快捷方式权限',
            description: '进入系统「设置」→「应用设置」→「应用管理」→「小米浏览器」→「权限管理」→「桌面快捷方式」，确认为「允许」。',
            hint: 'HyperOS / MIUI 默认可能拦截第三方网页的快捷方式创建。',
            icon: ShieldCheck,
          },
          {
            number: '02',
            title: '唤起浏览器工具菜单',
            description: '在小米浏览器底部工具栏中，轻触居中的「三道杠」菜单按钮。',
            icon: Menu,
          },
          {
            number: '03',
            title: '添加至手机桌面',
            description: '在工具面板中找到并点击「工具箱」或「添加至」，选择「手机桌面」即可生成独立图标。',
            icon: PlusSquare,
          },
        ];
      case 'firefox':
        return [
          {
            number: '01',
            title: '轻触地址栏快捷图标',
            description: '在顶部或底部 URL 地址栏最右侧，若出现带有加号的小房子图标，直接轻触即可完成安装。',
            hint: '火狐基于防骚扰规范禁止网页脚本主动弹窗，需使用浏览器内置入口。',
            icon: PlusSquare,
          },
          {
            number: '02',
            title: '或点击浏览器菜单',
            description: '若地址栏未显示快捷图标，点击地址栏旁边的三点菜单按钮。',
            icon: MoreVertical,
          },
          {
            number: '03',
            title: '选择安装到主屏幕',
            description: '在弹出的菜单列表中点击「安装」或「添加到主屏幕」即可。',
            icon: Smartphone,
          },
        ];
      case 'safari':
        return [
          {
            number: '01',
            title: '点击底部分享按钮',
            description: '在 Safari 底部操作栏居中位置，点击带有向上箭头的「分享」按钮。',
            icon: Share,
          },
          {
            number: '02',
            title: '滑动选择添加到主屏幕',
            description: '在系统操作面板中向下滑动，找到并轻触「添加到主屏幕」项。',
            icon: PlusSquare,
          },
          {
            number: '03',
            title: '确认并完成添加',
            description: '在右上角点击「添加」，即可在 iOS 桌面上生成无浏览器地址栏的独立手帐应用。',
            icon: Check,
          },
        ];
      case 'chrome':
      default:
        return [
          {
            number: '01',
            title: '打开浏览器菜单',
            description: '点击浏览器右上角的三点菜单图标。',
            icon: MoreVertical,
          },
          {
            number: '02',
            title: '选择安装选项',
            description: '在下拉列表中找到并点击「安装应用」或「添加到主屏幕」。',
            icon: PlusSquare,
          },
          {
            number: '03',
            title: '确认添加完成',
            description: '在弹出的确认对话框中点击「安装」，即可在桌面生成独立应用图标。',
            icon: Smartphone,
          },
        ];
    }
  };

  const steps = renderSteps();

  const renderBanner = () => {
    if (isInstalled) {
      return (
        <div className="flex items-center gap-3 rounded-(--radius-md) border border-(--color-income)/20 bg-(--color-income-bg) p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--color-income) text-white">
            <Check className="size-4 stroke-2" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-(--ink-primary)">
              当前已在桌面独立应用模式中
            </div>
            <div className="text-[11px] text-(--ink-secondary)">
              享受全屏沉浸记账体验，无浏览器地址栏干扰
            </div>
          </div>
        </div>
      );
    }
    if (installPrompt) {
      return (
        <div className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sunken) p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--color-income-bg) text-(--color-income)">
              <Download className="size-4 stroke-2" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-(--ink-primary)">
                检测到当前浏览器支持一键安装
              </div>
              <div className="truncate text-[11px] text-(--ink-secondary)">
                点击按钮即可直接唤起系统安装弹窗
              </div>
            </div>
          </div>
          <PaperButton
            variant="primary"
            size="compact"
            onClick={handleDirectInstall}
            disabled={isPrompting}
          >
            {isPrompting ? '唤起中...' : '立即安装'}
          </PaperButton>
        </div>
      );
    }
    return null;
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="添加到手机桌面"
    >
      <div className="space-y-4 p-4 pt-3 pb-[calc(18px+var(--safe-bottom))] select-none">
        {renderBanner()}

        <div>
          <div className="mb-1.5 px-0.5 text-[11px] font-medium text-(--ink-tertiary)">
            选择您的手机浏览器类型
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-(--radius-md) bg-(--paper-sunken) p-1 sm:grid-cols-4">
            {BROWSER_OPTIONS.map((item) => {
              const isActive = selectedFamily === item.key;
              return (
                <PaperChip
                  key={item.key}
                  selected={isActive}
                  onClick={() => setSelectedFamily(item.key)}
                >
                  {item.label}
                </PaperChip>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step) => {
            const IconComp = step.icon;
            return (
              <div
                key={step.number}
                className="flex items-start gap-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3"
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                  <IconComp className="stroke-1.75 size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-(--ink-tertiary)">
                      {step.number}
                    </span>
                    <span className="text-xs font-semibold text-(--ink-primary)">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-(--ink-secondary)">
                    {step.description}
                  </p>
                  {step.hint && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-(--color-expense)">
                      <Info className="size-3 shrink-0 stroke-2" />
                      <span>{step.hint}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-1.5 border-t border-dashed border-(--rule-hairline) px-1 pt-2 text-[11px] leading-relaxed text-(--ink-tertiary)">
          <Info className="stroke-1.75 mt-0.5 size-3.5 shrink-0 text-(--ink-tertiary)" />
          <span>
            安装后支持完全离线使用与秒级启动；数据保存在本机，卸载应用或清理浏览器数据将清空账本，请注意定期备份。
          </span>
        </div>
      </div>
    </PaperModal>
  );
};
