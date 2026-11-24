import React, { useEffect, useState } from 'react';
import { CloudIcon as Cloud, ArrowsClockwiseIcon as RefreshCw, CaretDownIcon as ChevronDown, CaretUpIcon as ChevronUp, CheckIcon as Check, PlugsConnectedIcon as PlugZap } from '@phosphor-icons/react';
import { syncService } from '../../domain/sync/syncService';
import { webdavClient, type WebDavProxyMode } from '../../domain/sync/webdavClient';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { toast } from '../../stores/useToastStore';
import { PaperButton } from '../ui/PaperButton';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperSwitch } from '../ui/PaperSwitch';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';
import { formatMonthDayTime } from '../../utils/date';

export const WebDavSyncSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [syncPath, setSyncPath] = useState('');
  const [proxyMode, setProxyMode] = useState<WebDavProxyMode>('builtin');
  const [customProxyUrl, setCustomProxyUrl] = useState('');
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
          setProxyMode(config.proxyMode || 'builtin');
          setCustomProxyUrl(config.customProxyUrl || '');
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
    proxyMode,
    customProxyUrl: proxyMode === 'custom' ? customProxyUrl.trim() : undefined,
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
              leftIcon={<RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />}
            >
              {isSyncing ? '同步中' : '立即同步'}
            </PaperButton>

            <PaperIconButton
              icon={isOpen ? ChevronUp : ChevronDown}
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(!isOpen)}
              title={isOpen ? '收起配置' : '展开配置'}
              aria-label={isOpen ? '收起配置' : '展开配置'}
            />
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

            <div className="space-y-1">
              <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">网络中转模式</label>
              <SegToggle
                size="sm"
                value={proxyMode}
                onChange={(val) => setProxyMode(val as WebDavProxyMode)}
                options={[
                  { value: 'builtin', label: '内置代理 (免跨域)' },
                  { value: 'direct', label: '直连模式' },
                  { value: 'custom', label: '自建代理' },
                ]}
              />
            </div>

            {proxyMode === 'custom' && (
              <div className="space-y-1">
                <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">自建代理接口地址</label>
                <PaperInput
                  placeholder="https://dav.naera.dev/"
                  value={customProxyUrl}
                  onChange={(e) => setCustomProxyUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/60 p-2.5 text-[11px] leading-relaxed text-(--ink-secondary)">
              <div className="mb-0.5 font-semibold text-(--ink-primary)">数据安全与隐私声明</div>
              {proxyMode === 'builtin' && (
                <div>
                  • <strong>流式中转</strong>：请求经当前站点的 Cloudflare Pages 边缘函数透传，不落盘、不留存任何账本数据与授权密码。<br />
                  • <strong>隐私提示</strong>：若访问他人托管的公有实例，密码及账本数据中途会流经该站点的 Cloudflare Edge。注重极致隐私建议自建 Pages 实例、自建 Worker 或使用局域网 Alist 直连。
                </div>
              )}
              {proxyMode === 'direct' && (
                <div>
                  • <strong>完全直连</strong>：浏览器直接请求目标 WebDAV，数据绝不经过任何第三方。<br />
                  • <strong>跨域要求</strong>：目标服务器必须配置 CORS 跨域允许头（如 Alist / Nextcloud / 自建 NAS），坚果云等公网云盘直连会被浏览器拦截。
                </div>
              )}
              {proxyMode === 'custom' && (
                <div>
                  • <strong>自建代理</strong>：请求将转发至你指定的私有反代网关（如绑定的 `dav.naera.dev` 或私人 Worker），数据仅在你信任的节点流转。
                </div>
              )}
            </div>

            {proxyMode === 'direct' && url.includes('jianguoyun.com') && (
              <div className="rounded-(--radius-sm) border border-dashed border-(--color-expense)/40 bg-(--color-expense-bg)/40 p-2 text-[11px] leading-relaxed text-(--color-expense)">
                坚果云未配置浏览器 CORS 跨域头，在「直连模式」下会被浏览器拦截。建议切换为「内置代理」或使用自建代理。
              </div>
            )}

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
