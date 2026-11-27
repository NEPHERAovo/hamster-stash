import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiquidGlassDock } from '../../src/components/ui/liquid-glass/LiquidGlassDock';

const SAMPLE_TABS = [
  { id: 'ledger', label: '账本' },
  { id: 'stats', label: '统计' },
  { id: 'assets', label: '资产' },
];

describe('LiquidGlassDock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to interactive CSS dock when WebGL is unavailable and hides canvas', () => {
    const onTabChange = vi.fn();
    render(
      <LiquidGlassDock
        tabs={SAMPLE_TABS}
        activeTab="ledger"
        onTabChange={onTabChange}
      />
    );

    const canvas = document.getElementById('droplet-canvas');
    expect(canvas?.className).toContain('hidden');

    const statsTab = screen.getByRole('tab', { name: '统计' });
    expect(statsTab).toBeVisible();
    fireEvent.click(statsTab);
    expect(onTabChange).toHaveBeenCalledWith('stats');
  });

  it('switches to CSS fallback on webglcontextlost and triggers WEBGL_lose_context on unmount', () => {
    const loseContextMock = vi.fn();
    const fakeGl = {
      isContextLost: () => false,
      createShader: () => ({}),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: () => true,
      useProgram: vi.fn(),
      createBuffer: () => ({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: () => 0,
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: () => ({}),
      createTexture: () => ({}),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      activeTexture: vi.fn(),
      uniform2f: vi.fn(),
      uniform1f: vi.fn(),
      uniform4f: vi.fn(),
      uniform1i: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      drawArrays: vi.fn(),
      deleteTexture: vi.fn(),
      deleteShader: vi.fn(),
      deleteBuffer: vi.fn(),
      deleteProgram: vi.fn(),
      getExtension: (name: string) =>
        name === 'WEBGL_lose_context' ? { loseContext: loseContextMock } : null,
    };

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === 'webgl') return fakeGl as unknown as WebGLRenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const { unmount } = render(
      <LiquidGlassDock
        tabs={SAMPLE_TABS}
        activeTab="ledger"
        onTabChange={vi.fn()}
      />
    );

    const canvas = document.getElementById('droplet-canvas')!;
    expect(canvas.className).not.toContain('hidden');

    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    fireEvent(canvas, lostEvent);
    expect(lostEvent.defaultPrevented).toBe(true);
    expect(canvas.className).toContain('hidden');

    unmount();
    expect(loseContextMock).toHaveBeenCalledTimes(1);

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });
});
