/**
 * Read Altara CSS design tokens off the live computed style. Falls back
 * to dark-theme defaults when a token is missing — keeps components
 * usable when @altara/core's stylesheet hasn't been imported yet.
 */
export interface AvTokens {
  bgPanel: string;
  bgElevated: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  textLabel: string;
  active: string;
  warn: string;
  danger: string;
  info: string;
  neutral: string;
  stale: string;
}

const DEFAULTS: AvTokens = {
  bgPanel: '#181A1B',
  bgElevated: '#1F2224',
  border: '#2E3133',
  textPrimary: '#E8E6DF',
  textMuted: '#7A7872',
  textLabel: '#9A9890',
  active: '#1D9E75',
  warn: '#EF9F27',
  danger: '#E24B4A',
  info: '#378ADD',
  neutral: '#888780',
  stale: '#5F5E5A',
};

export function readTokens(el: HTMLElement | null): AvTokens {
  if (!el || typeof window === 'undefined') return DEFAULTS;
  const s = getComputedStyle(el);
  const pick = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bgPanel: pick('--vt-bg-panel', DEFAULTS.bgPanel),
    bgElevated: pick('--vt-bg-elevated', DEFAULTS.bgElevated),
    border: pick('--vt-border', DEFAULTS.border),
    textPrimary: pick('--vt-text-primary', DEFAULTS.textPrimary),
    textMuted: pick('--vt-text-muted', DEFAULTS.textMuted),
    textLabel: pick('--vt-text-label', DEFAULTS.textLabel),
    active: pick('--vt-color-active', DEFAULTS.active),
    warn: pick('--vt-color-warn', DEFAULTS.warn),
    danger: pick('--vt-color-danger', DEFAULTS.danger),
    info: pick('--vt-color-info', DEFAULTS.info),
    neutral: pick('--vt-color-neutral', DEFAULTS.neutral),
    stale: pick('--vt-color-stale', DEFAULTS.stale),
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
