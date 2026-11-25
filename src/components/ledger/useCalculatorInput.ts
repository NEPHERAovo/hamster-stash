import { useMemo, useState } from 'react';
import { evaluateArithmetic } from '../../utils/math';

export function triggerHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      void 0;
    }
  }
}

export function useCalculatorInput(initialExpr = '0') {
  const [expr, setExpr] = useState(initialExpr);

  const hasOperator = useMemo(() => /[+\-×÷*/]/.test(expr), [expr]);
  const evaluatedVal = useMemo(() => evaluateArithmetic(expr), [expr]);

  const handleDigit = (digit: string) => {
    triggerHaptic();
    setExpr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.') {
        const segs = prev.split(/[+\-×÷*/]/);
        const curSeg = segs[segs.length - 1] || '';
        if (curSeg.includes('.')) return prev;
      }
      return prev + digit;
    });
  };

  const handleOperator = (op: '+' | '-' | '×' | '÷' | 'add-mul' | 'sub-div') => {
    triggerHaptic();
    setExpr((prev) => {
      const trimmed = prev.trim();
      if (trimmed === '' || trimmed === '0') return '0';

      if (op === 'add-mul') {
        if (trimmed.endsWith('+')) return trimmed.slice(0, -1).trim() + ' × ';
        if (trimmed.endsWith('×') || trimmed.endsWith('*')) return trimmed.slice(0, -1).trim() + ' + ';
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' + ';
        return `${trimmed} + `;
      }

      if (op === 'sub-div') {
        if (trimmed.endsWith('-')) return trimmed.slice(0, -1).trim() + ' ÷ ';
        if (trimmed.endsWith('÷') || trimmed.endsWith('/')) return trimmed.slice(0, -1).trim() + ' - ';
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' - ';
        return `${trimmed} - `;
      }

      if (op === '+') {
        if (trimmed.endsWith('+')) return trimmed.slice(0, -1).trim() + ' × ';
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' + ';
        return `${trimmed} + `;
      }

      if (op === '-') {
        if (trimmed.endsWith('-')) return trimmed.slice(0, -1).trim() + ' ÷ ';
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' - ';
        return `${trimmed} - `;
      }

      if (op === '×') {
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' × ';
        return `${trimmed} × `;
      }

      if (op === '÷') {
        if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim() + ' ÷ ';
        return `${trimmed} ÷ `;
      }

      return prev;
    });
  };

  const handleBackspace = () => {
    triggerHaptic();
    setExpr((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length <= 1) return '0';
      if (/[+\-×÷*/]$/.test(trimmed)) return trimmed.slice(0, -1).trim();
      return trimmed.slice(0, -1);
    });
  };

  const handleEqual = () => {
    triggerHaptic();
    const result = evaluateArithmetic(expr);
    const cleanNum = Math.round(result * 100) / 100;
    setExpr(String(cleanNum));
  };

  const handleClear = () => {
    triggerHaptic();
    setExpr('0');
  };

  return {
    expr,
    setExpr,
    hasOperator,
    evaluatedVal,
    handleDigit,
    handleOperator,
    handleBackspace,
    handleEqual,
    handleClear,
  };
}
