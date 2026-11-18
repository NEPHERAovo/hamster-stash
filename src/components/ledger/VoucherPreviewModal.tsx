import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, FileText, AlertCircle } from 'lucide-react';
import type { VoucherAttachment } from '../../types/transaction';

export interface VoucherPreviewModalProps {
  voucher: VoucherAttachment | null;
  onClose: () => void;
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
}) => {
  const isPdf = Boolean(
    voucher?.fileUrl?.startsWith('data:application/pdf') ||
      voucher?.name.toLowerCase().endsWith('.pdf')
  );
  const isImage = Boolean(voucher?.fileUrl && !isPdf);

  const pdfBlobUrl = useMemo(() => {
    if (!voucher?.fileUrl || !isPdf) return null;
    return dataUrlToBlobUrl(voucher.fileUrl);
  }, [voucher, isPdf]);

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
            {voucher.fileUrl && (
              <a
                href={pdfBlobUrl || voucher.fileUrl}
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
          {!voucher.fileUrl ? (
            <div className="py-10 px-4 text-center space-y-2">
              <AlertCircle className="w-7 h-7 mx-auto text-(--ink-tertiary) stroke-[1.6]" />
              <div className="text-xs font-medium text-(--ink-primary)">
                该凭证未保存文件内容
              </div>
              <div className="text-[11px] text-(--ink-tertiary)">
                请在编辑该笔账单时重新上传图片或 PDF 凭证
              </div>
            </div>
          ) : isImage ? (
            <img
              src={voucher.fileUrl}
              alt={voucher.name}
              className="max-w-full max-h-[70vh] object-contain rounded-(--radius-sm)"
            />
          ) : (
            <div className="w-full space-y-3">
              {pdfBlobUrl && (
                <iframe
                  src={pdfBlobUrl}
                  title={voucher.name}
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
                  href={pdfBlobUrl || voucher.fileUrl}
                  download={voucher.name}
                  className="px-3 py-1.5 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) text-(--ink-primary) text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>下载文件</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VoucherPreviewModal;
