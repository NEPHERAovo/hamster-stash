import type { VoucherAttachment } from '../types/transaction';
import { attachmentStore } from '../core/attachments/attachmentStore';

const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('读取文件失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const longest = Math.max(width, height);
      const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function readVoucherFile(file: File): Promise<VoucherAttachment> {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isImage && !isPdf) {
    throw new Error('仅支持图片或 PDF 格式的凭证');
  }

  if (isPdf && file.size > MAX_PDF_BYTES) {
    throw new Error('PDF 凭证大小不能超过 2 MB');
  }

  const rawDataUrl = await readAsDataUrl(file);
  const fileUrl = isImage ? await compressImageDataUrl(rawDataUrl) : rawDataUrl;
  const approxBytes = Math.round((fileUrl.length * 3) / 4);
  const size = formatFileSize(isImage ? Math.min(file.size, approxBytes) : file.size);
  let mimeType = file.type || 'image/jpeg';
  if (isPdf) {
    mimeType = 'application/pdf';
  } else if (fileUrl.startsWith('data:image/jpeg')) {
    mimeType = 'image/jpeg';
  }

  const saved = await attachmentStore.saveAttachment({
    name: file.name,
    mimeType,
    size,
    dataUrl: fileUrl,
  });

  return {
    attachmentId: saved.id,
    name: file.name,
    size,
    mimeType,
    title: isPdf ? 'PDF 凭证' : '图片凭证',
  };
}
