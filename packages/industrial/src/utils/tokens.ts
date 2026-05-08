/** Read Altara CSS tokens with dark-theme fallbacks. */
export interface IndTokens {
  bgPanel: string; bgElevated: string; border: string;
  textPrimary: string; textMuted: string; textLabel: string;
  active: string; warn: string; danger: string; info: string; neutral: string; stale: string;
}
const D: IndTokens = {
  bgPanel: '#181A1B', bgElevated: '#1F2224', border: '#2E3133',
  textPrimary: '#E8E6DF', textMuted: '#7A7872', textLabel: '#9A9890',
  active: '#1D9E75', warn: '#EF9F27', danger: '#E24B4A', info: '#378ADD',
  neutral: '#888780', stale: '#5F5E5A',
};
export function readTokens(el: HTMLElement | null): IndTokens {
  if (!el || typeof window === 'undefined') return D;
  const s = getComputedStyle(el);
  const p = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return {
    bgPanel: p('--vt-bg-panel', D.bgPanel), bgElevated: p('--vt-bg-elevated', D.bgElevated),
    border: p('--vt-border', D.border), textPrimary: p('--vt-text-primary', D.textPrimary),
    textMuted: p('--vt-text-muted', D.textMuted), textLabel: p('--vt-text-label', D.textLabel),
    active: p('--vt-color-active', D.active), warn: p('--vt-color-warn', D.warn),
    danger: p('--vt-color-danger', D.danger), info: p('--vt-color-info', D.info),
    neutral: p('--vt-color-neutral', D.neutral), stale: p('--vt-color-stale', D.stale),
  };
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
