import React, { useState } from 'react';
import {
  Download,
  Check,
  Menu,
  MoreVertical,
  Share,
  PlusSquare,
  ShieldCheck,
  Info,
  Smartphone,
} from 'lucide-react';
import { PaperModal } from '../ui/PaperModal';
import { usePwaStore } from '../../stores/usePwaStore';
import { detectBrowserFamily, type BrowserFamily } from '../../utils/browser';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

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
        toast.success('已加入桌面安装任务');
        onClose();
      } else if (outcome === 'dismissed') {
        toast.info('已取消安装');
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

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="添加到手机桌面"
      subtitle="独立应用 · 离线全量可用"
    >
      <div className="p-4 pt-3 pb-[calc(18px+var(--safe-bottom))] space-y-4 select-none">
        {isInstalled ? (
          <div className="p-3 rounded-(--radius-md) bg-(--color-income-bg) border border-(--color-income)/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-(--color-income) text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-2" />
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
        ) : installPrompt ? (
          <div className="p-3 rounded-(--radius-md) bg-(--paper-sunken) border border-(--rule-hairline) flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-(--badge-radius) bg-(--color-income-bg) text-(--color-income) flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 stroke-2" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-(--ink-primary)">
                  检测到当前浏览器支持一键安装
                </div>
                <div className="text-[11px] text-(--ink-secondary) truncate">
                  点击按钮即可直接唤起系统安装弹窗
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDirectInstall}
              disabled={isPrompting}
              className="px-3 py-1.5 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer active:scale-95 transition-all shrink-0 disabled:opacity-50"
            >
              {isPrompting ? '唤起中...' : '立即安装'}
            </button>
          </div>
        ) : null}

        <div>
          <div className="text-[11px] font-medium text-(--ink-tertiary) mb-1.5 px-0.5">
            选择您的手机浏览器类型
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 p-1 rounded-(--radius-md) bg-(--paper-sunken)">
            {BROWSER_OPTIONS.map((item) => {
              const isActive = selectedFamily === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedFamily(item.key)}
                  className={cn(
                    'py-1.5 px-2 text-xs font-medium rounded-(--radius-sm) transition-all text-center truncate cursor-pointer',
                    isActive
                      ? 'bg-(--paper-sheet) text-(--ink-primary) shadow-xs font-semibold'
                      : 'text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  {item.label}
                </button>
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
                className="p-3 rounded-(--radius-md) bg-(--paper-sheet) border border-(--rule-hairline) flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-(--badge-radius) bg-(--paper-sunken) flex items-center justify-center shrink-0 text-(--ink-secondary) mt-0.5">
                  <IconComp className="w-3.5 h-3.5 stroke-[1.75]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[10px] text-(--ink-tertiary) font-semibold">
                      {step.number}
                    </span>
                    <span className="text-xs font-semibold text-(--ink-primary)">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-(--ink-secondary) leading-relaxed">
                    {step.description}
                  </p>
                  {step.hint && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-(--color-expense) font-medium">
                      <Info className="w-3 h-3 stroke-2 shrink-0" />
                      <span>{step.hint}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-dashed border-(--rule-hairline) text-[11px] text-(--ink-tertiary) flex items-start gap-1.5 px-1 leading-relaxed">
          <Info className="w-3.5 h-3.5 stroke-[1.75] shrink-0 mt-0.5 text-(--ink-tertiary)" />
          <span>
            仓鼠囤囤采用 Local-First 本地优先架构，安装到桌面后所有账单数据均安全存储于设备本地，断网亦可秒级启动与流畅记账。
          </span>
        </div>
      </div>
    </PaperModal>
  );
};
