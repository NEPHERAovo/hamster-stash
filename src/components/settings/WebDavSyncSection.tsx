import React, { useEffect, useState } from 'react';
import {
  CloudIcon as Cloud,
  ArrowsClockwiseIcon as RefreshCw,
  CaretDownIcon as ChevronDown,
  CaretUpIcon as ChevronUp,
  CheckIcon as Check,
  PlugsConnectedIcon as PlugZap,
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
} from '@phosphor-icons/react';
import { syncService } from '../../domain/sync/syncService';
import type { SyncDiffPlan, SyncResolutionChoice } from '../../domain/sync/diffMerger';
import { webdavClient, type WebDavConfig, type WebDavProxyMode } from '../../domain/sync/webdavClient';
import { useAccountStore } from '../../stores/useAccountStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { toast } from '../../stores/useToastStore';
import { SyncReviewModal } from './SyncReviewModal';
import { PaperButton } from '../ui/PaperButton';
import { PaperChip } from '../ui/PaperChip';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperSwitch } from '../ui/PaperSwitch';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';
import { formatMonthDayTime } from '../../utils/date';

interface WebDavPreset {
  name: string;
  url: string;
  syncPath: string;
  proxyMode: WebDavProxyMode;
}

const WEBDAV_PRESETS: WebDavPreset[] = [
  {
    name: '坚果云',
    url: 'https://dav.jianguoyun.com/dav/',
    syncPath: 'hamsterstash',
    proxyMode: 'builtin',
  },
  {
    name: 'Alist',
    url: 'http://localhost:5244/dav/',
    syncPath: 'hamsterstash',
    proxyMode: 'direct',
  },
  {
    name: 'InfiniCLOUD',
    url: 'https://ACCOUNT.teracloud.jp/dav/',
    syncPath: 'hamsterstash',
    proxyMode: 'builtin',
  },
  {
    name: 'Nextcloud',
    url: 'https://cloud.example.com/remote.php/dav/files/USER/',
    syncPath: 'hamsterstash',
    proxyMode: 'direct',
  },
  {
    name: '群晖 NAS',
    url: 'https://nas-ip:5006/home/',
    syncPath: 'hamsterstash',
    proxyMode: 'direct',
  },
];

function parseHeaders(text: string): Record<string, string> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const json = JSON.parse(trimmed);
    if (typeof json === 'object' && json !== null) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        if (k.trim() && v) result[k.trim()] = String(v).trim();
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
  } catch {
    const result: Record<string, string> = {};
    for (const line of trimmed.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k && v) result[k] = v;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return undefined;
}

export const WebDavSyncSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [syncPath, setSyncPath] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [proxyMode, setProxyMode] = useState<WebDavProxyMode>('builtin');
  const [customProxyUrl, setCustomProxyUrl] = useState('');
  const [customHeadersText, setCustomHeadersText] = useState('');
  const [showWorkerSnippet, setShowWorkerSnippet] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [autoSyncDaily, setAutoSyncDaily] = useState(false);
  const [syncAttachments, setSyncAttachments] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewPlan, setReviewPlan] = useState<SyncDiffPlan | null>(null);

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
          if (config.customHeaders && Object.keys(config.customHeaders).length > 0) {
            setCustomHeadersText(
              Object.entries(config.customHeaders)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')
            );
          }
        }
        if (lastSync) {
          setLastSyncAt(lastSync);
        }
        setAutoSyncDaily(autoDaily);
        setSyncAttachments(syncAtt);
        const pending = syncService.getPendingReview?.();
        if (pending?.plan) {
          setReviewPlan(pending.plan);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return '从未同步';
    return formatMonthDayTime(iso) || iso;
  };

  const currentConfig: WebDavConfig = {
    url: url.trim(),
    username: username.trim(),
    password: password.trim(),
    syncPath: syncPath.trim() || undefined,
    proxyMode,
    customProxyUrl: proxyMode === 'custom' ? customProxyUrl.trim() : undefined,
    customHeaders: proxyMode === 'custom' ? parseHeaders(customHeadersText) : undefined,
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
      const ok = await webdavClient.testConnection(currentConfig);
      if (ok) {
        toast.success('WebDAV 连接成功');
      } else {
        toast.error('WebDAV 连接失败，请检查配置与网络');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '连接失败，请检查配置与网络');
    } finally {
      setIsTesting(false);
    }
  };

  const reloadAllStoresAfterSync = async () => {
    await Promise.all([
      loadAccounts(),
      loadCategories(),
      loadMonth(),
      loadTransactions(),
      loadThemeFromDB(),
      usePreferenceStore.getState().loadPreferencesFromDB(),
    ]);
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
      const prep = await syncService.prepareWebDavSync(currentConfig, { syncAttachments });

      if (prep.status === 'needs_review' && prep.plan) {
        setReviewPlan(prep.plan);
        return;
      }

      if (prep.stats && (prep.stats.addedLocal + prep.stats.updatedLocal + prep.stats.deletedLocal) > 0) {
        await reloadAllStoresAfterSync();
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      toast.success(prep.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'WebDAV 同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmReview = async (resolutions: Record<string, SyncResolutionChoice>) => {
    if (!reviewPlan) return;
    const res = await syncService.commitWebDavSync(reviewPlan, resolutions, currentConfig, {
      syncAttachments,
    });
    setReviewPlan(null);
    if (res.changedLocal) {
      await reloadAllStoresAfterSync();
    }
    setLastSyncAt(new Date().toISOString());
    toast.success(res.message);
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
            <div className="space-y-1.5">
              <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">服务器地址</label>
              <div className="flex flex-wrap gap-1 pb-0.5">
                {WEBDAV_PRESETS.map((preset) => {
                  const rootPart = preset.url.replace(/ACCOUNT|USER|cloud\.example\.com|nas-ip/g, '');
                  const isSelected = url.includes(rootPart);
                  return (
                    <PaperChip
                      key={preset.name}
                      type="button"
                      size="xs"
                      selected={isSelected}
                      onClick={() => {
                        setUrl(preset.url);
                        setProxyMode(preset.proxyMode);
                        if (!syncPath.trim()) {
                          setSyncPath(preset.syncPath);
                        }
                      }}
                    >
                      {preset.name}
                    </PaperChip>
                  );
                })}
              </div>
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
                  { value: 'builtin', label: '内置代理' },
                  { value: 'direct', label: '直连模式' },
                  { value: 'custom', label: '自建代理' },
                ]}
              />
            </div>

            {proxyMode === 'custom' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">自建代理接口地址</label>
                  <PaperInput
                    placeholder="https://dav.naera.dev/ 或 https://my-proxy.workers.dev/"
                    value={customProxyUrl}
                    onChange={(e) => setCustomProxyUrl(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">自定义请求头</label>
                  <textarea
                    rows={2}
                    placeholder="CF-Access-Client-Id: xxx&#10;CF-Access-Client-Secret: yyy"
                    value={customHeadersText}
                    onChange={(e) => setCustomHeadersText(e.target.value)}
                    className="w-full resize-y rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) p-2 font-mono text-xs text-(--ink-primary) transition-all outline-none placeholder:text-(--ink-faint) focus:border-(--border-strong)"
                  />
                </div>
              </div>
            )}

            <div className="rounded-(--radius-sm) border border-dashed border-(--rule-hairline) bg-(--paper-sunken)/60 p-2.5 text-[11px] leading-relaxed text-(--ink-secondary)">
              <div className="mb-1 font-semibold text-(--ink-primary)">数据安全与隐私</div>
              {proxyMode === 'builtin' && (
                <div>
                  请求经当前站点的 Cloudflare Pages 边缘函数透传，本站点不存储任何数据。
                </div>
              )}
              {proxyMode === 'direct' && (
                <div>
                  浏览器直接请求目标 WebDAV，数据不经过任何第三方；目标服务器需支持 CORS 跨域。
                </div>
              )}
              {proxyMode === 'custom' && (
                <div className="space-y-1.5">
                  <div>
                    请求将转发至你指定的私有反代网关，数据仅在私有节点流转；自建服务需返回允许跨域头与 WebDAV 动词。
                  </div>
                  <div>
                    <PaperButton
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowWorkerSnippet(!showWorkerSnippet)}
                      className="h-5 px-1.5 text-[10px] text-(--color-accent)"
                    >
                      {showWorkerSnippet ? '收起自建 Worker 脚本参考' : '查看自建 Cloudflare Worker 脚本参考'}
                    </PaperButton>
                    {showWorkerSnippet && (
                      <pre className="mt-1 max-h-36 overflow-auto rounded bg-(--paper-sunken) p-2 font-mono text-[10px] leading-tight text-(--ink-primary) select-all">
{`export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS,PROPFIND,MKCOL,MOVE,COPY,LOCK,UNLOCK',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }
    const target = req.headers.get('x-target-url') || new URL(req.url).searchParams.get('url');
    if (!target) return new Response('Missing target', { status: 400 });
    const h = new Headers(req.headers);
    h.set('Host', new URL(target).host);
    const resp = await fetch(target, { method: req.method, headers: h, body: req.body });
    const rh = new Headers(resp.headers);
    rh.set('Access-Control-Allow-Origin', '*');
    rh.set('Access-Control-Allow-Headers', '*');
    rh.delete('www-authenticate');
    return new Response(resp.body, { status: resp.status, headers: rh });
  }
};`}
                      </pre>
                    )}
                  </div>
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
                <label className="px-0.5 text-[11px] font-medium text-(--ink-tertiary)">密码</label>
                <PaperInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 text-xs"
                  rightIcon={
                    <PaperIconButton
                      type="button"
                      icon={showPassword ? EyeSlash : Eye}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? '隐藏密码' : '显示密码'}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      className="-mr-1 size-5.5"
                    />
                  }
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

      <SyncReviewModal
        isOpen={Boolean(reviewPlan)}
        plan={reviewPlan}
        onClose={() => {
          syncService.clearPendingReview?.();
          setReviewPlan(null);
        }}
        onConfirm={handleConfirmReview}
      />
    </div>
  );
};
