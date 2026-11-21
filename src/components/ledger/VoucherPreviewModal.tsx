import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, DownloadSimple as Download, ArrowSquareOut as ExternalLink, FileText, WarningCircle as AlertCircle, ArrowsClockwise as RefreshCw } from '@phosphor-icons/react';
import type { VoucherAttachment } from '../../types/transaction';
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
        <div className="py-12 flex flex-col items-center gap-2 text-xs text-(--ink-tertiary)">
          <RefreshCw className="w-5 h-5 animate-spin stroke-[1.8]" />
          <span>正在加载凭证...</span>
        </div>
      );
    }

    if (!resolvedUrl) {
      return (
        <div className="py-10 px-4 text-center space-y-2">
          <AlertCircle className="w-7 h-7 mx-auto text-(--ink-tertiary) stroke-[1.6]" />
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
          className="max-w-full max-h-[70vh] object-contain rounded-(--radius-sm)"
        />
      );
    }

    return (
      <div className="w-full space-y-3">
        {pdfBlobUrl && (
          <iframe
            src={pdfBlobUrl}
            title={voucher?.name}
            className="w-full h-[56vh] rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet)"
          />
        )}
        <div className="flex items-center justify-center gap-2">
          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>新窗口打开 PDF</span>
            </a>
          )}
          <a
            href={pdfBlobUrl || resolvedUrl}
            download={voucher?.name}
            className="px-3 py-1.5 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-primary) text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>下载文件</span>
          </a>
        </div>
      </div>
    );
  };

  if (!voucher) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[430px] max-h-[88vh] bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-lg) shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-(--rule-hairline)">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-(--ink-primary) truncate">
              {voucher.name}
            </div>
            <div className="text-[10px] font-mono text-(--ink-tertiary)">
              {voucher.size}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {resolvedUrl && (
              <a
                href={pdfBlobUrl || resolvedUrl}
                download={voucher.name}
                className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors"
                title="下载凭证"
              >
                <Download className="w-4 h-4 stroke-[1.8]" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-(--btn-radius) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-pointer"
              title="关闭预览"
            >
              <X className="w-4 h-4 stroke-2" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3 flex items-center justify-center bg-(--paper-sunken)/40">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VoucherPreviewModal;
