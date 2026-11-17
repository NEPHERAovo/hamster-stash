import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../../../stores/useThemeStore';
import {
  VERTEX_SHADER_SOURCE,
  FRAGMENT_SHADER_SOURCE,
  createLiquidProgram,
} from './liquidGlassShader';
import {
  createConfiguredTexture,
  uploadLayerTexture,
  type DockTabItem,
  isTabActive,
  resolveTabLabel,
} from './drawDockTexture';
import { useLiquidSpring } from './useLiquidSpring';
import { cn } from '../../../utils/cn';

export interface LiquidGlassDockProps {
  tabs: DockTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const dockShellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const { step, setDragPosition } = useLiquidSpring();
  const stepRef = useRef(step);
  stepRef.current = step;

  const isDraggingRef = useRef(false);
  const pressTargetRef = useRef(0);
  const texturesDirtyRef = useRef(true);

  useEffect(() => {
    texturesDirtyRef.current = true;
  }, [tabs, isDark]);

  useEffect(() => {
    const dockShell = dockShellRef.current;
    if (!dockShell || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          texturesDirtyRef.current = true;
        }
      }
    });

    observer.observe(dockShell);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dockShell = dockShellRef.current;
    if (!canvas || !dockShell) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      });
    } catch {
      gl = null;
    }

    if (!gl) return;

    let prog: WebGLProgram;
    try {
      prog = createLiquidProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    } catch (e) {
      console.error('Failed to create LiquidGlassDock program:', e);
      return;
    }

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    [
      'uResolution',
      'uCanvasSize',
      'uDpr',
      'uDark',
      'uDockRect',
      'uDropletRect',
      'uTrigger',
      'uRefraction',
      'uDispersion',
      'uRimStrength',
      'uInactiveTex',
      'uActiveTex',
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(prog, name);
    });

    const inactiveTex = createConfiguredTexture(gl);
    const activeTex = createConfiguredTexture(gl);

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');

    let animationFrameId: number;
    let lastTime = performance.now();
    let lastCanvasW = 0;
    let lastCanvasH = 0;

    const padX = 14;
    const padY = 16;

    const render = (now: number) => {
      if (!gl || !canvas || !dockShell) return;

      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      const rect = dockShell.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const dockW = rect.width;
      const dockH = rect.height;
      const canvasW = dockW + padX * 2;
      const canvasH = dockH + padY * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetPixelW = Math.round(canvasW * dpr);
      const targetPixelH = Math.round(canvasH * dpr);

      if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
        canvas.width = targetPixelW;
        canvas.height = targetPixelH;
        gl.viewport(0, 0, targetPixelW, targetPixelH);
        texturesDirtyRef.current = true;
      }

      const currentTabs = tabsRef.current;
      const currentIsDark = isDarkRef.current;

      if (
        offCtx &&
        (texturesDirtyRef.current || canvasW !== lastCanvasW || canvasH !== lastCanvasH)
      ) {
        const inactiveColor = currentIsDark ? '#E6EAF8' : '#181B24';
        const activeColor = currentIsDark ? '#4D94FF' : '#1677FF';

        gl.activeTexture(gl.TEXTURE0);
        uploadLayerTexture(
          gl,
          inactiveTex,
          offCanvas,
          offCtx,
          currentTabs,
          canvasW,
          canvasH,
          padX,
          padY,
          dockW,
          dpr,
          currentIsDark,
          inactiveColor
        );

        gl.activeTexture(gl.TEXTURE1);
        uploadLayerTexture(
          gl,
          activeTex,
          offCanvas,
          offCtx,
          currentTabs,
          canvasW,
          canvasH,
          padX,
          padY,
          dockW,
          dpr,
          currentIsDark,
          activeColor
        );

        lastCanvasW = canvasW;
        lastCanvasH = canvasH;
        texturesDirtyRef.current = false;
      }

      const activeIdx = Math.max(0, currentTabs.findIndex((t) => isTabActive(t, activeTabRef.current)));
      const colW = dockW / Math.max(1, currentTabs.length);
      const targetX = colW * (activeIdx + 0.5);

      const spring = stepRef.current(
        dt,
        targetX,
        isDraggingRef.current,
        pressTargetRef.current,
        colW,
        dockH
      );

      const dropCenterXInCanvas = padX + spring.dropletX;
      const dropCenterYInCanvas = padY + dockH * 0.5;

      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uCanvasSize, canvasW, canvasH);
      gl.uniform1f(uniforms.uDpr, dpr);
      gl.uniform1f(uniforms.uDark, currentIsDark ? 1.0 : 0.0);

      gl.uniform4f(
        uniforms.uDockRect,
        padX + dockW * 0.5,
        padY + dockH * 0.5,
        dockW * 0.5,
        dockH * 0.5
      );
      gl.uniform4f(
        uniforms.uDropletRect,
        dropCenterXInCanvas,
        dropCenterYInCanvas,
        spring.dropHalfW,
        spring.dropHalfH
      );
      gl.uniform1f(uniforms.uTrigger, spring.smoothTrigger);

      gl.uniform1f(uniforms.uRefraction, 1.55);
      gl.uniform1f(uniforms.uDispersion, 1.15);
      gl.uniform1f(uniforms.uRimStrength, 0.80);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inactiveTex);
      gl.uniform1i(uniforms.uInactiveTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, activeTex);
      gl.uniform1i(uniforms.uActiveTex, 1);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        gl.deleteTexture(inactiveTex);
        gl.deleteTexture(activeTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const dockShell = dockShellRef.current;
    if (!dockShell) return;

    const rect = dockShell.getBoundingClientRect();
    if (rect.width <= 0) return;

    isDraggingRef.current = true;
    pressTargetRef.current = 1.0;

    try {
      dockShell.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const localX = Math.max(32, Math.min(rect.width - 32, e.clientX - rect.left));
    setDragPosition(localX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dockShell = dockShellRef.current;
    if (!dockShell) return;

    const rect = dockShell.getBoundingClientRect();
    if (rect.width <= 0) return;

    const localX = Math.max(32, Math.min(rect.width - 32, e.clientX - rect.left));
    setDragPosition(localX);
  };

  const handlePointerRelease = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    pressTargetRef.current = 0.0;

    const dockShell = dockShellRef.current;
    if (dockShell) {
      try {
        if (dockShell.hasPointerCapture(e.pointerId)) {
          dockShell.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    const rect = dockShell?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const currentTabs = tabsRef.current;
    if (currentTabs.length === 0) return;

    const localX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
    const colW = rect.width / currentTabs.length;
    const tabIdx = Math.max(0, Math.min(currentTabs.length - 1, Math.floor(localX / colW)));
    const selectedTab = currentTabs[tabIdx];
    if (selectedTab) {
      const chosenId = selectedTab.id || selectedTab.path || '';
      if (!isTabActive(selectedTab, activeTabRef.current)) {
        activeTabRef.current = chosenId;
        onTabChangeRef.current(chosenId);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    pressTargetRef.current = 0.0;
    const dockShell = dockShellRef.current;
    if (dockShell) {
      try {
        if (dockShell.hasPointerCapture(e.pointerId)) {
          dockShell.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      ref={dockShellRef}
      id="dock-shell"
      role="tablist"
      aria-label="Navigation Dock"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerCancel}
      className={cn(
        'relative h-[60px] rounded-full transition-colors duration-200 select-none cursor-pointer overflow-visible',
        'bg-[rgba(255,255,255,0.90)] border border-[rgba(15,23,42,0.06)] shadow-[0_10px_28px_-6px_rgba(20,28,56,0.08),0_2px_6px_rgba(20,28,56,0.03)] backdrop-blur-xl',
        'dark:bg-[rgba(30,33,48,0.86)] dark:border-[rgba(255,255,255,0.09)] dark:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)]',
        className
      )}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        id="droplet-canvas"
        className="absolute -left-[14px] -right-[14px] -top-[16px] -bottom-[16px] w-[calc(100%+28px)] h-[calc(100%+32px)] pointer-events-none z-10"
      />

      <div className="absolute inset-0 flex items-stretch z-20 pointer-events-none">
        {tabs.map((tab, idx) => {
          const tabId = tab.id || tab.path || '';
          const active = isTabActive(tab, activeTab);
          const label = resolveTabLabel(tab);
          return (
            <button
              key={tabId || idx}
              type="button"
              role="tab"
              aria-selected={active}
              title={label}
              aria-label={label}
              className="flex-1 opacity-0 pointer-events-none"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LiquidGlassDock;
