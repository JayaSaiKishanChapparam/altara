import { useEffect, useMemo, useRef } from 'react';
import type { TrendRecorderProps, TrendChannel, TrendTimeScale } from '../types';

const SCALE_MS: Record<TrendTimeScale, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '8h': 28_800_000,
  '24h': 86_400_000,
};

interface Sample { t: number; v: number; }

const DEFAULT_CHANNELS: TrendChannel[] = [
  { key: 'temp', label: 'Reactor Temp', color: '#E24B4A', unit: '°C', min: 60, max: 110 },
  { key: 'press', label: 'Pressure', color: '#37D3E0', unit: 'bar', min: 0, max: 16 },
  { key: 'flow', label: 'Feed Flow', color: '#1D9E75', unit: 'm³/h', min: 0, max: 50 },
  { key: 'level', label: 'Tank Level', color: '#F4D03F', unit: '%', min: 0, max: 100 },
];

/**
 * Multi-pen chart recorder styled after classic Honeywell / ABB
 * industrial trend recorders. Up to 8 simultaneous channels render as
 * overlapping coloured lines, each on its own normalised Y range.
 */
export function TrendRecorder({
  channels: channelsProp,
  timeScale = '1h',
  showGrid = true,
  showLegend = true,
  backgroundColor = '#0E0F10',
  mockMode,
  className,
}: TrendRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(720);
  const heightRef = useRef(280);
  const buffersRef = useRef<Map<string, Sample[]>>(new Map());
  const channels = useMemo(
    () => channelsProp ?? (mockMode ? DEFAULT_CHANNELS : []),
    [channelsProp, mockMode],
  );

  // mockMode: synthesize one sample per channel per ~200 ms.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const now = performance.now();
      const ensure = (key: string) => {
        let buf = buffersRef.current.get(key);
        if (!buf) { buf = []; buffersRef.current.set(key, buf); }
        return buf;
      };
      ensure('temp').push({ t: now, v: 85 + Math.sin(t * 0.05) * 8 + Math.sin(t * 0.4) * 1.5 });
      ensure('press').push({ t: now, v: 8 + Math.sin(t * 0.07) * 1.5 });
      ensure('flow').push({ t: now, v: 28 + Math.sin(t * 0.04) * 6 + Math.sin(t * 0.3) * 1 });
      ensure('level').push({ t: now, v: 60 + Math.sin(t * 0.03) * 18 });
      // Cap each buffer
      for (const buf of buffersRef.current.values()) {
        const cutoff = now - SCALE_MS[timeScale] - 1000;
        while (buf.length && buf[0]!.t < cutoff) buf.shift();
        if (buf.length > 5000) buf.shift();
      }
    }, 200);
    return () => clearInterval(id);
  }, [mockMode, timeScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = widthRef.current;
    const H = heightRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, W, H);

      const padX = 8;
      const padTop = 8;
      const legendH = showLegend ? 18 : 0;
      const plotH = H - padTop - legendH - 4;
      const plotY = padTop;

      // Grid
      if (showGrid) {
        ctx.strokeStyle = 'rgba(46,49,51,0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
          const yy = plotY + (plotH / 4) * i;
          ctx.beginPath(); ctx.moveTo(padX, yy); ctx.lineTo(W - padX, yy); ctx.stroke();
        }
        for (let i = 0; i <= 6; i++) {
          const xx = padX + ((W - 2 * padX) / 6) * i;
          ctx.beginPath(); ctx.moveTo(xx, plotY); ctx.lineTo(xx, plotY + plotH); ctx.stroke();
        }
      }

      const now = performance.now();
      const windowMs = SCALE_MS[timeScale];
      const start = now - windowMs;

      // Each channel — independent Y scaling
      for (const ch of channels) {
        const buf = buffersRef.current.get(ch.key) ?? [];
        if (buf.length < 2) continue;
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (const s of buf) {
          if (s.t < start) continue;
          const x = padX + ((s.t - start) / windowMs) * (W - 2 * padX);
          const y = plotY + plotH * (1 - (s.v - ch.min) / Math.max(0.0001, ch.max - ch.min));
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
      }

      // Legend
      if (showLegend) {
        ctx.font = '11px monospace';
        ctx.textBaseline = 'middle';
        let lx = padX;
        const ly = H - legendH / 2;
        for (const ch of channels) {
          const buf = buffersRef.current.get(ch.key) ?? [];
          const last = buf[buf.length - 1]?.v;
          ctx.fillStyle = ch.color;
          ctx.fillRect(lx, ly - 4, 10, 8);
          ctx.fillStyle = '#FFFFFF';
          const text = `${ch.label}${last !== undefined ? ` ${last.toFixed(1)}${ch.unit ?? ''}` : ''}`;
          ctx.textAlign = 'left';
          ctx.fillText(text, lx + 14, ly + 1);
          lx += 18 + ctx.measureText(text).width + 14;
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [channels, timeScale, showGrid, showLegend, backgroundColor]);

  return (
    <div
      className={['vt-component vt-trend', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        width: widthRef.current,
        height: heightRef.current,
        background: backgroundColor,
        border: '1px solid var(--vt-border)',
        borderRadius: 4,
      }}
      role="img"
      aria-label={`Trend recorder — ${channels.length} channels, ${timeScale} window`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
