export interface DockTabItem {
  id?: string;
  path?: string;
  label?: string;
  title?: string;
  name?: string;
  icon?: string;
  order?: number;
}

export type DockTabType = 'ledger' | 'stats' | 'items' | 'assets' | 'saving' | 'generic';

export function normalizeTabKey(rawKey: string): DockTabType {
  const s = (rawKey || '').toLowerCase().trim();
  if (s === 'ledger' || s === 'journal' || s === 'book' || s === '/' || s === '/ledger') {
    return 'ledger';
  }
  if (s === 'stats' || s === 'statistics' || s === 'analysis' || s === '/stats' || s === '/statistics') {
    return 'stats';
  }
  if (
    s === 'items' ||
    s === 'owned-items' ||
    s === 'item' ||
    s === 'inventory' ||
    s === 'package' ||
    s === 'box' ||
    s === '/items' ||
    s === '/plugin/owned-items' ||
    s.includes('item')
  ) {
    return 'items';
  }
  if (s === 'assets' || s === 'wallet' || s === 'accounts' || s === '/assets' || s === 'vault') {
    return 'assets';
  }
  if (s === 'saving' || s === 'savings' || s === 'drop' || s === 'droplet') {
    return 'saving';
  }
  return 'generic';
}

export function resolveTabType(tab: DockTabItem): DockTabType {
  const candidates = [tab.id, tab.path, tab.icon].filter(Boolean) as string[];
  for (const raw of candidates) {
    const key = normalizeTabKey(raw);
    if (key !== 'generic') {
      return key;
    }
  }
  return 'generic';
}

export function isTabActive(tab: DockTabItem, current: string): boolean {
  if (!current) return false;
  if (tab.id === current || tab.path === current) return true;
  const currentKey = normalizeTabKey(current);
  const tabKey = resolveTabType(tab);
  return currentKey !== 'generic' && currentKey === tabKey;
}

export function resolveTabLabel(tab: DockTabItem): string {
  const rawLabel = (tab.label || tab.title || tab.name || '').trim();
  const lower = rawLabel.toLowerCase();

  if (lower === 'ledger' || lower === 'journal' || lower === 'book') return '账本';
  if (lower === 'stats' || lower === 'statistics' || lower === 'analysis') return '统计';
  if (lower === 'owned items' || lower === 'items' || lower === 'inventory') return '物品';
  if (lower === 'assets' || lower === 'accounts' || lower === 'wallet') return '资产';
  if (lower === 'saving' || lower === 'savings') return '储蓄';

  if (rawLabel) return rawLabel;

  const type = resolveTabType(tab);
  if (type === 'ledger') return '账本';
  if (type === 'stats') return '统计';
  if (type === 'items') return '物品';
  if (type === 'assets') return '资产';
  if (type === 'saving') return '储蓄';

  return tab.id || tab.path || '';
}

export function drawTabIcon(
  ctx: CanvasRenderingContext2D,
  type: DockTabType,
  cx: number,
  cy: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'ledger') {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-7, -9, 14, 18, 2.5);
    } else {
      ctx.strokeRect(-7, -9, 14, 18);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3.5, -4);
    ctx.lineTo(3.5, -4);
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(3.5, 0);
    ctx.moveTo(-3.5, 4);
    ctx.lineTo(1, 4);
    ctx.stroke();
  } else if (type === 'assets') {
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(9, -3.5);
    ctx.lineTo(0, 1);
    ctx.lineTo(-9, -3.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, 1.5);
    ctx.lineTo(0, 6);
    ctx.lineTo(9, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.lineTo(0, 10.5);
    ctx.lineTo(9, 6);
    ctx.stroke();
  } else if (type === 'items') {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8.5, -4.5);
    ctx.lineTo(8.5, 4.5);
    ctx.lineTo(0, 9);
    ctx.lineTo(-8.5, 4.5);
    ctx.lineTo(-8.5, -4.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8.5, -4.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(8.5, -4.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 9);
    ctx.stroke();
  } else if (type === 'stats') {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(-7.5, 0, 3.4, 8, 1);
      ctx.roundRect(-1.7, -7, 3.4, 15, 1);
      ctx.roundRect(4.1, -3, 3.4, 11, 1);
      ctx.fill();
    } else {
      ctx.fillRect(-7.5, 0, 3.4, 8);
      ctx.fillRect(-1.7, -7, 3.4, 15);
      ctx.fillRect(4.1, -3, 3.4, 11);
    }
  } else if (type === 'saving') {
    ctx.beginPath();
    ctx.moveTo(0, -8.5);
    ctx.bezierCurveTo(4.5, -2, 6.5, 2, 6.5, 4.5);
    ctx.arc(0, 4.5, 6.5, 0, Math.PI);
    ctx.bezierCurveTo(-6.5, 2, -4.5, -2, 0, -8.5);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function uploadLayerTexture(
  gl: WebGLRenderingContext,
  tex: WebGLTexture,
  offCanvas: HTMLCanvasElement,
  offCtx: CanvasRenderingContext2D,
  tabs: DockTabItem[],
  canvasW: number,
  canvasH: number,
  padX: number,
  padY: number,
  dockW: number,
  dpr: number,
  inkColor: string
): void {
  const texW = Math.max(1, Math.round(canvasW * dpr));
  const texH = Math.max(1, Math.round(canvasH * dpr));

  if (offCanvas.width !== texW || offCanvas.height !== texH) {
    offCanvas.width = texW;
    offCanvas.height = texH;
  }

  offCtx.save();
  offCtx.clearRect(0, 0, texW, texH);
  offCtx.scale(dpr, dpr);

  const tabCount = Math.max(1, tabs.length);
  const sidePad = Math.max(4, Math.round(dockW * 0.016));
  const usableW = dockW - sidePad * 2;
  const colW = usableW / tabCount;
  const dockH = canvasH - padY * 2;

  tabs.forEach((tab, i) => {
    const cx = padX + sidePad + colW * (i + 0.5);
    const tabType = resolveTabType(tab);
    const label = resolveTabLabel(tab);

    drawTabIcon(offCtx, tabType, cx, padY + dockH * 0.34, inkColor);

    offCtx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = inkColor;
    offCtx.fillText(label, cx, padY + dockH * 0.71);
  });

  offCtx.restore();

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offCanvas);
}

export function createConfiguredTexture(gl: WebGLRenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) {
    throw new Error('Failed to create WebGL texture');
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
