/**
 * 极简安全的四则运算求值工具（仅支持 + - × ÷ 数字和小数点）
 */
export function evaluateArithmetic(expr: string): number {
  if (!expr || !expr.trim()) return 0;

  const normalized = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[^\d.+\-*/() ]/g, '')
    .trim();

  if (!normalized) return 0;

  try {
    const safeExpr = normalized.replace(/[+\-*/]+$/, '').trim();
    if (!safeExpr) return 0;

    const fn = new Function(`"use strict"; return (${safeExpr});`);
    const val = fn();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      return Math.max(0, val);
    }
    return 0;
  } catch {
    return 0;
  }
}
