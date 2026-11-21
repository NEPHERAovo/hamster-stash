import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import {
  SPRING_OUT_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
} from '../../utils/gesturePhysics';

export interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export interface SwipeableRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  action?: SwipeAction;
  enabled?: boolean;
  onClick?: () => void;
  actionWidth?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  containerClassName?: string;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  action,
  enabled = true,
  onClick,
  actionWidth = 76,
  isOpen,
  onOpenChange,
  className,
  containerClassName,
  ...rest
}) => {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [settleMs, setSettleMs] = useState(240);

  const isDraggingRef = useRef(false);
  const isHorizontalRef = useRef(false);
  const hasSwipedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const velocityRef = useRef(new VelocityTracker(90));
  const lastSwipeTimeRef = useRef(0);

  const canSwipe = enabled && Boolean(action);

  useEffect(() => {
    if (isOpen !== undefined) {
      const target = isOpen ? -actionWidth : 0;
      if (currentOffsetRef.current !== target && !isDraggingRef.current) {
        currentOffsetRef.current = target;
        setOffset(target);
      }
    }
  }, [isOpen, actionWidth]);

  useEffect(() => {
    if (!canSwipe && offset !== 0) {
      currentOffsetRef.current = 0;
      setOffset(0);
      onOpenChange?.(false);
    }
  }, [canSwipe, offset, onOpenChange]);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!canSwipe) return;
    isDraggingRef.current = true;
    isHorizontalRef.current = false;
    hasSwipedRef.current = false;
    startXRef.current = clientX - currentOffsetRef.current;
    startYRef.current = clientY;
    velocityRef.current.reset(currentOffsetRef.current, performance.now());
  };

  const handleDragMove = (clientX: number, clientY: number, preventDefault?: () => void) => {
    if (!isDraggingRef.current) return;
    const rawDx = clientX - startXRef.current;
    const deltaY = Math.abs(clientY - startYRef.current);
    const deltaX = Math.abs(clientX - (startXRef.current + currentOffsetRef.current));

    if (!isHorizontalRef.current) {
      if (deltaY > deltaX && deltaY > 6) {
        isDraggingRef.current = false;
        return;
      }
      if (deltaX > 6) {
        isHorizontalRef.current = true;
        hasSwipedRef.current = true;
        setIsSwiping(true);
        onOpenChange?.(true);
      }
    }

    if (isHorizontalRef.current) {
      preventDefault?.();
      let newOffset = rawDx;
      if (newOffset > 0) {
        newOffset = rubberBand(newOffset, 48, 0.25);
      } else if (newOffset < -actionWidth) {
        const overflow = -newOffset - actionWidth;
        newOffset = -actionWidth - rubberBand(overflow, 140, 0.48);
      }
      currentOffsetRef.current = newOffset;
      velocityRef.current.push(newOffset, performance.now());
      setOffset(newOffset);
    }
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsSwiping(false);

    if (hasSwipedRef.current) {
      lastSwipeTimeRef.current = Date.now();
    }

    const vx = velocityRef.current.getVelocity(performance.now());
    let shouldOpen = false;
    if (vx < -0.35) {
      shouldOpen = currentOffsetRef.current < -16;
    } else if (vx > 0.35) {
      shouldOpen = false;
    } else {
      shouldOpen = currentOffsetRef.current < -actionWidth / 2;
    }

    const target = shouldOpen ? -actionWidth : 0;
    setSettleMs(computeSettleDuration(target - currentOffsetRef.current, vx, 190, 300));
    currentOffsetRef.current = target;
    setOffset(target);
    onOpenChange?.(shouldOpen);
  };

  const handleRowClick = () => {
    if (Date.now() - lastSwipeTimeRef.current < 350) {
      return;
    }
    if (offset < 0) {
      currentOffsetRef.current = 0;
      setOffset(0);
      onOpenChange?.(false);
    } else {
      onClick?.();
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    currentOffsetRef.current = 0;
    setOffset(0);
    onOpenChange?.(false);
    action?.onClick(e);
  };

  const actionTranslate = Math.max(0, actionWidth + offset);
  const dynamicActionWidth = Math.max(actionWidth, Math.ceil(Math.abs(offset)));
  const actionOpacity = offset === 0 ? 0 : Math.min(1, Math.abs(offset) / 30);

  return (
    <div
      {...rest}
      className={cn('relative overflow-hidden bg-(--bg-surface)', containerClassName)}
    >
      {canSwipe && action && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-center z-0 overflow-hidden select-none',
            action.className || 'bg-(--color-expense)',
            offset === 0 && 'pointer-events-none opacity-0'
          )}
          style={{
            width: `${dynamicActionWidth}px`,
            transform: `translate3d(${actionTranslate}px, 0, 0)`,
            opacity: actionOpacity,
            transition: isSwiping
              ? 'none'
              : `transform ${settleMs}ms ${SPRING_OUT_EASE}, width ${settleMs}ms ${SPRING_OUT_EASE}, opacity 200ms ease`,
          }}
        >
          <button
            type="button"
            onClick={handleActionClick}
            title={action.title || action.label}
            className="w-full h-full flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-0.5 cursor-pointer active:opacity-85"
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        </div>
      )}

      <div
        onClick={handleRowClick}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY, () => e.cancelable && e.preventDefault())}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        onMouseDown={(e) => {
          if (e.button === 0) handleDragStart(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isDraggingRef.current) handleDragMove(e.clientX, e.clientY, () => e.preventDefault());
        }}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isSwiping ? 'none' : `transform ${settleMs}ms ${SPRING_OUT_EASE}`,
        }}
        className={cn('relative z-10 select-none will-change-transform bg-(--bg-surface)', className)}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableRow;
