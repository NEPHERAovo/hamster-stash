export interface DockTabItem {
  id: string;
  label: string;
}

function drawTabIcon(
  ctx: CanvasRenderingContext2D,
  id: string,
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

  if (id === 'ledger') {
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
  } else if (id === 'assets') {
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
  } else if (id === 'items') {
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
  } else if (id === 'stats') {
    ctx.fillRect(-7.5, 0, 3.4, 8);
    ctx.fillRect(-1.7, -7, 3.4, 15);
    ctx.fillRect(4.1, -3, 3.4, 11);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
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
  inkColor: string,
  isDark: boolean
): void {
  const texW = Math.round(canvasW * dpr);
  const texH = Math.round(canvasH * dpr);

  if (offCanvas.width !== texW || offCanvas.height !== texH) {
    offCanvas.width = texW;
    offCanvas.height = texH;
  }

  offCtx.save();
  offCtx.clearRect(0, 0, texW, texH);
  offCtx.scale(dpr, dpr);

  offCtx.fillStyle = isDark ? '#1e2130' : 'rgba(255, 255, 255, 1)';
  offCtx.fillRect(0, 0, canvasW, canvasH);

  const tabCount = Math.max(1, tabs.length);
  const colW = dockW / tabCount;

  tabs.forEach((tab, i) => {
    const cx = padX + colW * (i + 0.5);
    drawTabIcon(offCtx, tab.id, cx, padY + 19, inkColor);

    offCtx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillStyle = inkColor;
    offCtx.fillText(tab.label, cx, padY + 41);
  });

  offCtx.restore();

  gl.bindTexture(gl.TEXTURE_2D, tex);
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
