import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon as X, DownloadSimpleIcon as Download, ArrowSquareOutIcon as ExternalLink, FileTextIcon as FileText, WarningCircleIcon as AlertCircle, ArrowsClockwiseIcon as RefreshCw } from '@phosphor-icons/react';
import type { VoucherAttachment } from '../../types/transaction';
import { PaperIconButton } from '../ui/PaperIconButton';
import { attachmentStore } from '../../core/attachments/attachmentStore';
import { syncService } from '../../domain/sync/syncService';

export interface VoucherPreviewModalProps {
  voucher: VoucherAttachment | null;
  onClose: () => void;
  onFetchRemote?: (attachmentId: string) => Promise<string | null>;
}

function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const [header, base64] = dataUrl.split(',');
    if (!header || !base64) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

export const VoucherPreviewModal: React.FC<VoucherPreviewModalProps> = ({
  voucher,
  onClose,
  onFetchRemote,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!voucher) {
      setResolvedUrl(null);
      setIsLoading(false);
      return;
    }

    const loadContent = async () => {
      if (voucher.fileUrl) {
        setResolvedUrl(voucher.fileUrl);
        return;
      }
      if (!voucher.attachmentId) {
        setResolvedUrl(null);
        return;
      }

      setIsLoading(true);
      try {
        const local = await attachmentStore.getAttachment(voucher.attachmentId);
        if (!active) return;
        if (local?.dataUrl) {
          setResolvedUrl(local.dataUrl);
          return;
        }
        const remoteFetcher =
          onFetchRemote || ((id: string) => syncService.fetchAttachmentFromWebDav(id));
        const remoteUrl = await remoteFetcher(voucher.attachmentId);
        if (!active) return;
        setResolvedUrl(remoteUrl);
        return;
      } catch {
        if (active) setResolvedUrl(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadContent();
    return () => {
      active = false;
    };
  }, [voucher, onFetchRemote]);

  const isPdf = Boolean(
    voucher?.mimeType === 'application/pdf' ||
      resolvedUrl?.startsWith('data:application/pdf') ||
      voucher?.name.toLowerCase().endsWith('.pdf')
  );
  const isImage = Boolean(resolvedUrl && !isPdf);

  const pdfBlobUrl = useMemo(() => {
    if (!resolvedUrl || !isPdf) return null;
    return dataUrlToBlobUrl(resolvedUrl);
  }, [resolvedUrl, isPdf]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  useEffect(() => {
    if (!voucher) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voucher, onClose]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-xs text-(--ink-tertiary)">
          <RefreshCw className="stroke-1.8 size-5 animate-spin" />
          <span>正在加载凭证...</span>
        </div>
      );
    }

    if (!resolvedUrl) {
      return (
        <div className="space-y-2 px-4 py-10 text-center">
          <AlertCircle className="stroke-1.6 mx-auto size-7 text-(--ink-tertiary)" />
          <div className="text-xs font-medium text-(--ink-primary)">
            本机未找到该凭证文件
          </div>
          <div className="text-[11px] text-(--ink-tertiary)">
            {voucher?.attachmentId
              ? '如已开启 WebDAV 附件备份，请检查网络或配置后重试'
              : '请在编辑该笔账单时重新上传图片或 PDF 凭证'}
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <img
          src={resolvedUrl}
          alt={voucher?.name}
          className="max-h-[70dvh] max-w-full rounded-(--radius-sm) object-contain"
        />
      );
    }

    return (
      <div className="w-full space-y-3">
        {pdfBlobUrl && (
          <iframe
            src={pdfBlobUrl}
            title={voucher?.name}
            className="h-[56dvh] w-full rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet)"
          />
        )}
        <div className="flex items-center justify-center gap-2">
          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-(--btn-radius) bg-(--btn-primary-bg) px-3 py-1.5 text-xs font-semibold text-(--btn-primary-fg)"
            >
              <ExternalLink className="size-3.5" />
              <span>新窗口打开 PDF</span>
            </a>
          )}
          <a
            href={pdfBlobUrl || resolvedUrl}
            download={voucher?.name}
            className="inline-flex items-center gap-1.5 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sheet) px-3 py-1.5 text-xs font-semibold text-(--ink-primary)"
          >
            <FileText className="size-3.5" />
            <span>下载文件</span>
          </a>
        </div>
      </div>
    );
  };

  if (!voucher) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet) shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-(--rule-hairline) px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-(--ink-primary)">
              {voucher.name}
            </div>
            <div className="font-mono text-[10px] text-(--ink-tertiary)">
              {voucher.size}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {resolvedUrl && (
              <a
                href={pdfBlobUrl || resolvedUrl}
                download={voucher.name}
                className="flex size-7 items-center justify-center rounded-(--btn-radius) text-(--ink-secondary) transition-colors hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                title="下载凭证"
              >
                <Download className="stroke-1.8 size-4" />
              </a>
            )}
            <PaperIconButton
              icon={X}
              size="md"
              variant="ghost"
              onClick={onClose}
              title="关闭预览"
              aria-label="关闭预览"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-(--paper-sunken)/40 p-3">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VoucherPreviewModal;
