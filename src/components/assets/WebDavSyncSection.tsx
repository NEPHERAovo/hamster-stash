import React, { useEffect, useState } from 'react';
import { CloudIcon as Cloud, ArrowsClockwiseIcon as RefreshCw, CaretDownIcon as ChevronDown, CaretUpIcon as ChevronUp, CheckIcon as Check, PlugsConnectedIcon as PlugZap } from '@phosphor-icons/react';
import { syncService } from '../../domain/sync/syncService';
import { webdavClient } from '../../domain/sync/webdavClient';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { toast } from '../../stores/useToastStore';
import { PaperButton } from '../ui/PaperButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperSwitch } from '../ui/PaperSwitch';
import { cn } from '../../utils/cn';
import { formatMonthDayTime } from '../../utils/date';

export const WebDavSyncSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [syncPath, setSyncPath] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [autoSyncDaily, setAutoSyncDaily] = useState(false);
  const [syncAttachments, setSyncAttachments] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { loadAccounts } = useAccountStore();
  const { loadCategories } = useCategoryStore();
  const { loadMonth, loadTransactions } = useLedgerStore();
  const { loadThemeFromDB } = useThemeStore();

  useEffect(() => {
    let mounted = true;
    void syncService
      .getWebDavConfig()
      .then(({ config, lastSyncAt: lastSync, autoSyncDaily: autoDaily, syncAttachments: syncAtt }) => {
        if (!mounted) return;
        if (config) {
          setUrl(config.url || '');
          setUsername(config.username || '');
          setPassword(config.password || '');
          setSyncPath(config.syncPath || '');
        }
        if (lastSync) {
          setLastSyncAt(lastSync);
        }
        setAutoSyncDaily(autoDaily);
        setSyncAttachments(syncAtt);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return '从未同步';
    return formatMonthDayTime(iso) || iso;
  };

  const currentConfig = {
    url: url.trim(),
    username: username.trim(),
    password: password.trim(),
    syncPath: syncPath.trim() || undefined,
  };

  const handleToggleAutoSync = async () => {
    const next = !autoSyncDaily;
    if (next && (!currentConfig.url || !currentConfig.username || !currentConfig.password)) {
      toast.warning('请先填写并保存 WebDAV 配置后再开启自动同步');
      setIsOpen(true);
      return;
    }
    setAutoSyncDaily(next);
    try {
      await syncService.setAutoSyncDaily(next);
    } catch {
      setAutoSyncDaily(!next);
      toast.error('保存自动同步设置失败');
    }
  };

  const handleToggleSyncAttachments = async () => {
    const next = !syncAttachments;
    if (next && (!currentConfig.url || !currentConfig.username || !currentConfig.password)) {
      toast.warning('请先填写并保存 WebDAV 配置后再开启附件备份');
      setIsOpen(true);
      return;
    }
    setSyncAttachments(next);
    try {
      await syncService.setSyncAttachments(next);
    } catch {
      setSyncAttachments(!next);
      toast.error('保存附件备份设置失败');
    }
  };

  const handleSave = async () => {
    if (!currentConfig.url || !currentConfig.username || !currentConfig.password) {
      toast.error('请填写完整的 WebDAV 地址、账号与密码');
      return;
    }

    setIsSaving(true);
    try {
      await syncService.saveWebDavConfig(currentConfig, { autoSyncDaily, syncAttachments });
      toast.success('WebDAV 配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!currentConfig.url || !currentConfig.username || !currentConfig.password) {
      toast.error('请先填写服务器地址、账号和密码');
      return;
    }

    setIsTesting(true);
    try {
      await webdavClient.testConnection(currentConfig);
      toast.success('WebDAV 连接成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '连接失败，请检查配置与网络');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    if (!currentConfig.url || !currentConfig.username || !currentConfig.password) {
      toast.error('请先配置 WebDAV 服务器信息');
      setIsOpen(true);
      return;
    }

    setIsSyncing(true);
    try {
      await syncService.saveWebDavConfig(currentConfig, { autoSyncDaily, syncAttachments });
      const res = await syncService.syncWithWebDav(currentConfig, { syncAttachments });

      await Promise.all([
        loadAccounts(),
        loadCategories(),
        loadMonth(),
        loadTransactions(),
        loadThemeFromDB(),
      ]);

      const now = new Date().toISOString();
      setLastSyncAt(now);
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'WebDAV 同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="px-1 pt-1 font-mono text-xs tracking-wider text-(--ink-tertiary)">
        <span>云端同步</span>
      </div>

      <div className="paper-card overflow-hidden rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) px-3.5 py-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 select-none"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
              <Cloud className="stroke-1.75 size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-(--ink-primary)">云端备份</span>
                <span className="py-0.2 rounded bg-(--paper-sunken) px-1.5 font-mono text-[9px] font-medium text-(--ink-tertiary)">
                  WebDAV
                </span>
                <span className="font-mono text-[10px] text-(--ink-tertiary)">
                  {formatSyncTime(lastSyncAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <PaperButton
              variant="secondary"
              size="xs"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-1 font-mono text-[11px]"
            >
              <RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? '同步中' : '立即同步'}</span>
            </PaperButton>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex size-6 cursor-pointer items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary)"
            >
              {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 space-y-2.5 border-t border-dashed border-(--rule-hairline)/60 pt-3.5">
            <div className="space-y-1">
              <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">服务器地址</label>
              <PaperInput
                placeholder="https://dav.jianguoyun.com/dav/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">账号</label>
                <PaperInput
                  placeholder="账号 / 邮箱"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">应用密码</label>
                <PaperInput
                  type="password"
                  placeholder="授权密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">同步目录</label>
              <PaperInput
                placeholder="默认为 /hamsterstash"
                value={syncPath}
                onChange={(e) => setSyncPath(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <PaperButton
                variant="ghost"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || isSyncing}
                leftIcon={<PlugZap className="size-3.5" />}
              >
                {isTesting ? '测试中...' : '测试连接'}
              </PaperButton>

              <PaperButton
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isSyncing}
                leftIcon={<Check className="size-3.5" />}
              >
                {isSaving ? '保存中...' : '保存配置'}
              </PaperButton>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-(--rule-hairline)/60 pt-2.5 select-none">
          <span className="text-[13px] font-medium text-(--ink-primary)">每日自动同步</span>
          <PaperSwitch
            checked={autoSyncDaily}
            onChange={handleToggleAutoSync}
            aria-label="每日自动同步"
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-(--rule-hairline)/60 pt-2.5 select-none">
          <span className="text-[13px] font-medium text-(--ink-primary)">备份凭证附件</span>
          <PaperSwitch
            checked={syncAttachments}
            onChange={handleToggleSyncAttachments}
            aria-label="备份凭证附件"
          />
        </div>
      </div>
    </div>
  );
};
