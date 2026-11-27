import React, { useEffect, useRef, useState } from 'react';
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
  resolveTabType,
} from './drawDockTexture';
import { useLiquidSpring } from './useLiquidSpring';
import { getCategoryIcon } from '../../../utils/categoryIcons';
import { cn } from '../../../utils/cn';

export interface LiquidGlassDockProps {
  tabs: DockTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const SIDE_PAD = 6;

const FALLBACK_ICON_MAP: Record<string, string> = {
  ledger: 'book-open',
  stats: 'trend-up',
  items: 'package',
  assets: 'wallet',
  saving: 'drop',
  generic: 'squares-four',
};

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const dockShellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGlFallback, setIsGlFallback] = useState(false);
  const [glEpoch, setGlEpoch] = useState(0);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const isPointerDownRef = useRef(false);
  const pointerDownXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pressTargetRef = useRef(0);
  const texturesDirtyRef = useRef(true);
  const scheduleRenderRef = useRef<(() => void) | null>(null);

  const visualActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (!isPointerDownRef.current) {
      visualActiveTabRef.current = activeTab;
      scheduleRenderRef.current?.();
    }
  }, [activeTab]);

  const { step, setDragPosition, resetTarget } = useLiquidSpring();
  const stepRef = useRef(step);
  stepRef.current = step;
  const resetTargetRef = useRef(resetTarget);
  resetTargetRef.current = resetTarget;
  const lastTabCountRef = useRef(tabs.length);

  useEffect(() => {
    texturesDirtyRef.current = true;
    scheduleRenderRef.current?.();
  }, [tabs, isDark]);

  useEffect(() => {
    const dockShell = dockShellRef.current;
    if (!dockShell || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          texturesDirtyRef.current = true;
          scheduleRenderRef.current?.();
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

    let isDestroyed = false;
    let animationFrameId: number | null = null;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isDestroyed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      setIsGlFallback(true);
    };

    const handleContextRestored = () => {
      setIsGlFallback(false);
      setGlEpoch((prev) => prev + 1);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      });
    } catch {
      gl = null;
    }

    if (!gl || gl.isContextLost()) {
      setIsGlFallback(true);
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }

    let prog: WebGLProgram;
    try {
      prog = createLiquidProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    } catch (e) {
      console.error('Failed to create LiquidGlassDock program:', e);
      setIsGlFallback(true);
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }

    setIsGlFallback(false);
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
      'uDockRadius',
      'uDropletRadius',
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

    let lastTime = performance.now();
    let lastCanvasW = 0;
    let lastCanvasH = 0;

    const padX = 18;
    const padY = 20;

    const scheduleRender = () => {
      if (isDestroyed || animationFrameId !== null) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    };

    scheduleRenderRef.current = scheduleRender;

    const render = (now: number) => {
      animationFrameId = null;
      if (isDestroyed || !gl || !canvas || !dockShell || gl.isContextLost()) return;

      const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const rect = dockShell.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        scheduleRender();
        return;
      }

      const dockW = rect.width;
      const dockH = rect.height;
      const canvasW = dockW + padX * 2;
      const canvasH = dockH + padY * 2;
      const dpr = Math.max(1.5, Math.min(window.devicePixelRatio || 1, 3));

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
          activeColor
        );

        lastCanvasW = canvasW;
        lastCanvasH = canvasH;
        texturesDirtyRef.current = false;
      }

      const activeIdx = Math.max(0, currentTabs.findIndex((t) => isTabActive(t, visualActiveTabRef.current)));
      const usableW = dockW - SIDE_PAD * 2;
      const colW = usableW / Math.max(1, currentTabs.length);
      const targetX = SIDE_PAD + colW * (activeIdx + 0.5);

      if (lastTabCountRef.current !== currentTabs.length) {
        lastTabCountRef.current = currentTabs.length;
        resetTargetRef.current(targetX);
      }

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

      const dockR = Math.min(dockH * 0.5, 27.5);
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
      gl.uniform1f(uniforms.uDockRadius, dockR);
      gl.uniform1f(uniforms.uDropletRadius, spring.dropR);
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

      const isAnimating =
        isPointerDownRef.current ||
        isDraggingRef.current ||
        pressTargetRef.current > 0 ||
        Math.abs(spring.dropletX - targetX) >= 0.05 ||
        Math.abs(spring.dropletVelX) >= 0.5 ||
        spring.pressAmount >= 0.002 ||
        spring.smoothTrigger >= 0.002;

      if (!isDestroyed && isAnimating) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        texturesDirtyRef.current = true;
        scheduleRender();
      } else if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleRender();

    return () => {
      isDestroyed = true;
      scheduleRenderRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      if (gl && !gl.isContextLost()) {
        gl.deleteTexture(inactiveTex);
        gl.deleteTexture(activeTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, [glEpoch]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const dockShell = dockShellRef.current;
    if (!dockShell) return;

    const rect = dockShell.getBoundingClientRect();
    if (rect.width <= 0) return;

    isPointerDownRef.current = true;
    pointerDownXRef.current = e.clientX;
    isDraggingRef.current = false;
    pressTargetRef.current = 1.0;

    try {
      dockShell.setPointerCapture(e.pointerId);
    } catch {
      void 0;
    }

    const currentTabs = tabsRef.current;
    if (currentTabs.length > 0) {
      const colW = (rect.width - SIDE_PAD * 2) / currentTabs.length;
      const clampedX = Math.max(SIDE_PAD, Math.min(rect.width - SIDE_PAD - 0.001, e.clientX - rect.left));
      const tabIdx = Math.floor((clampedX - SIDE_PAD) / colW);
      const selectedTab = currentTabs[tabIdx];
      if (selectedTab) {
        visualActiveTabRef.current = selectedTab.id || selectedTab.path || '';
      }
    }

    scheduleRenderRef.current?.();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const dockShell = dockShellRef.current;
    if (!dockShell) return;

    const rect = dockShell.getBoundingClientRect();
    if (rect.width <= 0) return;

    const dx = Math.abs(e.clientX - pointerDownXRef.current);
    if (!isDraggingRef.current && dx > 8) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      const localX = Math.max(26, Math.min(rect.width - 26, e.clientX - rect.left));
      setDragPosition(localX);

      const currentTabs = tabsRef.current;
      if (currentTabs.length > 0) {
        const colW = (rect.width - SIDE_PAD * 2) / currentTabs.length;
        const clampedX = Math.max(SIDE_PAD, Math.min(rect.width - SIDE_PAD - 0.001, e.clientX - rect.left));
        const tabIdx = Math.floor((clampedX - SIDE_PAD) / colW);
        const selectedTab = currentTabs[tabIdx];
        if (selectedTab) {
          visualActiveTabRef.current = selectedTab.id || selectedTab.path || '';
        }
      }
      scheduleRenderRef.current?.();
    }
  };

  const handlePointerRelease = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    pressTargetRef.current = 0.0;

    const dockShell = dockShellRef.current;
    if (dockShell) {
      try {
        if (dockShell.hasPointerCapture(e.pointerId)) {
          dockShell.releasePointerCapture(e.pointerId);
        }
      } catch {
        void 0;
      }
    }

    const rect = dockShell?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      scheduleRenderRef.current?.();
      return;
    }

    const currentTabs = tabsRef.current;
    if (currentTabs.length === 0) {
      scheduleRenderRef.current?.();
      return;
    }

    const colW = (rect.width - SIDE_PAD * 2) / currentTabs.length;
    const clampedX = Math.max(SIDE_PAD, Math.min(rect.width - SIDE_PAD - 0.001, e.clientX - rect.left));
    const tabIdx = Math.floor((clampedX - SIDE_PAD) / colW);
    const selectedTab = currentTabs[tabIdx];
    if (selectedTab) {
      const chosenId = selectedTab.id || selectedTab.path || '';
      visualActiveTabRef.current = chosenId;
      if (!isTabActive(selectedTab, activeTabRef.current)) {
        activeTabRef.current = chosenId;
        onTabChangeRef.current(chosenId);
      }
    }

    scheduleRenderRef.current?.();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    pressTargetRef.current = 0.0;
    visualActiveTabRef.current = activeTabRef.current;
    const dockShell = dockShellRef.current;
    if (dockShell) {
      try {
        if (dockShell.hasPointerCapture(e.pointerId)) {
          dockShell.releasePointerCapture(e.pointerId);
        }
      } catch {
        void 0;
      }
    }
    scheduleRenderRef.current?.();
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
        'relative h-[58px] cursor-pointer overflow-visible rounded-[27.5px] border-0 bg-transparent shadow-none backdrop-blur-md select-none',
        isGlFallback && 'border border-(--rule-hairline) bg-(--paper-sheet)/92 px-1.5 shadow-md backdrop-blur-xl',
        className
      )}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        id="droplet-canvas"
        className={cn(
          'pointer-events-none absolute -inset-x-[18px] -inset-y-5 z-10 h-[calc(100%+40px)] w-[calc(100%+36px)]',
          isGlFallback && 'hidden'
        )}
      />

      <div
        className={cn(
          'absolute inset-0 z-20 flex items-stretch',
          isGlFallback ? 'px-1.5 py-1' : 'pointer-events-none'
        )}
      >
        {tabs.map((tab, idx) => {
          const tabId = tab.id || tab.path || '';
          const active = isTabActive(tab, activeTab);
          const label = resolveTabLabel(tab);
          const tabType = resolveTabType(tab);
          const FallbackIcon = getCategoryIcon(tab.icon || FALLBACK_ICON_MAP[tabType] || 'squares-four');

          if (isGlFallback) {
            return (
              <button
                key={tabId || idx}
                type="button"
                role="tab"
                aria-selected={active}
                title={label}
                aria-label={label}
                onClick={() => onTabChange(tabId)}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors',
                  active
                    ? 'bg-(--color-accent-bg) font-semibold text-(--color-accent)'
                    : 'text-(--ink-secondary)'
                )}
              >
                <FallbackIcon className="size-4.5 shrink-0" weight={active ? 'fill' : 'regular'} />
                <span className="leading-none">{label}</span>
              </button>
            );
          }

          return (
            <button
              key={tabId || idx}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={-1}
              title={label}
              aria-label={label}
              className="pointer-events-none flex-1 opacity-0 outline-none focus:ring-0 focus:outline-none"
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
