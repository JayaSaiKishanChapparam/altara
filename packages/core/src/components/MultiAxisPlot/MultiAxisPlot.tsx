import { useEffect, useMemo, useRef } from 'react';
import type {
  MultiAxisChannel,
  MultiAxisPlotProps,
  TelemetryValue,
} from '../../adapters/types';
import { RingBuffer } from '../../utils/RingBuffer';
import { sineWave } from '../../utils/mockData';

interface ChannelState {
  channel: MultiAxisChannel;
  buffer: RingBuffer;
  color: string;
  axis: 'left' | 'right';
}

const PALETTE = ['#378ADD', '#1D9E75', '#EF9F27', '#E24B4A', '#9E7CD5', '#3FBFB5'];

interface ThemeTokens {
  bgPanel: string;
  textPrimary: string;
  textMuted: string;
  border: string;
}

function readTokens(el: HTMLElement): ThemeTokens {
  const s = getComputedStyle(el);
  return {
    bgPanel: s.getPropertyValue('--vt-bg-panel').trim() || '#181A1B',
    textPrimary: s.getPropertyValue('--vt-text-primary').trim() || '#E8E6DF',
    textMuted: s.getPropertyValue('--vt-text-muted').trim() || '#7A7872',
    border: s.getPropertyValue('--vt-border').trim() || '#2E3133',
  };
}

interface AxisExtent {
  min: number;
  max: number;
}

function computeExtent(states: ChannelState[], axis: 'left' | 'right', tMin: number): AxisExtent {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const cs of states) {
    if (cs.axis !== axis) continue;
    const values = cs.buffer.getValues();
    const times = cs.buffer.getTimes();
    for (let i = 0; i < values.length; i++) {
      if (times[i]! < tMin) continue;
      const v = values[i]!;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return { min: -1, max: 1 };
  if (yMin === yMax) return { min: yMin - 1, max: yMax + 1 };
  const pad = (yMax - yMin) * 0.1;
  return { min: yMin - pad, max: yMax + pad };
}

/**
 * Time-series plot with independent left + right Y-axes — pair signals
 * with different units (e.g. battery % on the left, current draw in A on
 * the right). Same canvas + rAF + RingBuffer hot path as TimeSeries; the
 * only difference is the scaling/labeling logic per axis.
 */
export function MultiAxisPlot({
  dataSource,
  channels,
  windowMs = 30_000,
  bufferSize = 10_000,
  fps = 60,
  height = 240,
  mockMode,
  leftAxisLabel,
  rightAxisLabel,
  thresholds,
  className,
}: MultiAxisPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastDrawRef = useRef(0);

  const channelStates = useMemo<ChannelState[]>(
    () =>
      channels.map((c, i) => ({
        channel: c,
        buffer: new RingBuffer(bufferSize),
        color: c.color ?? PALETTE[i % PALETTE.length]!,
        axis: c.axis ?? 'left',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(channels.map((c) => `${c.key}:${c.axis ?? 'left'}`))],
  );

  // Subscribe to upstream data, route by channel key.
  useEffect(() => {
    if (!dataSource) return;
    const byKey = new Map(channelStates.map((cs) => [cs.channel.key, cs]));
    const handle = (v: TelemetryValue) => {
      const target = v.channel ? byKey.get(v.channel) : channelStates[0];
      if (!target) return;
      target.buffer.push(v.value, v.timestamp);
    };
    for (const v of dataSource.getHistory()) handle(v);
    const off = dataSource.subscribe(handle);
    return () => {
      off();
    };
  }, [dataSource, channelStates]);

  // mockMode: per-channel sine waves with very different amplitudes per axis
  // so the dual-axis behavior is visible immediately.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const generators = channelStates.map((cs, i) =>
      sineWave(0.2 + i * 0.1, cs.axis === 'right' ? 0.8 + i * 0.2 : 30 + i * 10),
    );
    const id = setInterval(() => {
      const t = Date.now();
      channelStates.forEach((cs, i) => cs.buffer.push(generators[i]!(t), t));
    }, 1000 / Math.max(fps, 30));
    return () => clearInterval(id);
  }, [mockMode, dataSource, channelStates, fps]);

  // rAF render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameInterval = 1000 / Math.max(fps, 1);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = container.clientWidth;
      const cssHeight = container.clientHeight;
      canvas.width = Math.max(cssWidth, 1) * dpr;
      canvas.height = Math.max(cssHeight, 1) * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (now - lastDrawRef.current < frameInterval) return;
      lastDrawRef.current = now;

      const cssWidth = container.clientWidth;
      const cssHeight = container.clientHeight;
      const tokens = readTokens(container);

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = tokens.bgPanel;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      const padLeft = 44;
      const padRight = 44;
      const padTop = 12;
      const padBottom = 22;
      const plotW = Math.max(cssWidth - padLeft - padRight, 1);
      const plotH = Math.max(cssHeight - padTop - padBottom, 1);

      const wallNow = Date.now();
      const tMin = wallNow - windowMs;

      const left = computeExtent(channelStates, 'left', tMin);
      const right = computeExtent(channelStates, 'right', tMin);

      const xFor = (t: number) => padLeft + ((t - tMin) / windowMs) * plotW;
      const yFor = (v: number, axis: 'left' | 'right') => {
        const e = axis === 'left' ? left : right;
        return padTop + (1 - (v - e.min) / (e.max - e.min || 1)) * plotH;
      };

      // Frame.
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, padTop);
      ctx.lineTo(padLeft, padTop + plotH);
      ctx.lineTo(padLeft + plotW, padTop + plotH);
      ctx.lineTo(padLeft + plotW, padTop);
      ctx.stroke();

      // Y labels per axis.
      ctx.fillStyle = tokens.textMuted;
      ctx.font = '11px var(--vt-font-mono, monospace)';
      ctx.textBaseline = 'middle';

      ctx.textAlign = 'right';
      for (const v of [left.max, (left.max + left.min) / 2, left.min]) {
        ctx.fillText(v.toFixed(1), padLeft - 4, yFor(v, 'left'));
      }
      ctx.textAlign = 'left';
      for (const v of [right.max, (right.max + right.min) / 2, right.min]) {
        ctx.fillText(v.toFixed(1), padLeft + plotW + 4, yFor(v, 'right'));
      }

      // Axis labels.
      if (leftAxisLabel) {
        ctx.save();
        ctx.translate(12, padTop + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = tokens.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(leftAxisLabel, 0, 0);
        ctx.restore();
      }
      if (rightAxisLabel) {
        ctx.save();
        ctx.translate(cssWidth - 12, padTop + plotH / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = tokens.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rightAxisLabel, 0, 0);
        ctx.restore();
      }

      // Threshold lines (axis-aware).
      if (thresholds) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (const t of thresholds) {
          const axis = t.axis ?? 'left';
          ctx.strokeStyle = t.color;
          const y = yFor(t.value, axis);
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotW, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Channel lines.
      for (const cs of channelStates) {
        const values = cs.buffer.getValues();
        const times = cs.buffer.getTimes();
        if (values.length === 0) continue;
        ctx.strokeStyle = cs.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < values.length; i++) {
          const t = times[i]!;
          if (t < tMin) continue;
          const x = xFor(t);
          const y = yFor(values[i]!, cs.axis);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (started) ctx.stroke();
      }

      // Legend with axis tag.
      ctx.font = '11px var(--vt-font-sans, sans-serif)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let legendY = padTop;
      for (const cs of channelStates) {
        const tag = cs.axis === 'right' ? ' →R' : ' ←L';
        const labelText = cs.channel.unit
          ? `${cs.channel.label} (${cs.channel.unit})${tag}`
          : `${cs.channel.label}${tag}`;
        ctx.fillStyle = cs.color;
        ctx.fillRect(padLeft + 8, legendY + 3, 10, 2);
        ctx.fillStyle = tokens.textPrimary;
        ctx.fillText(labelText, padLeft + 22, legendY);
        legendY += 14;
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ro.disconnect();
    };
  }, [channelStates, windowMs, fps, leftAxisLabel, rightAxisLabel, thresholds]);

  const ariaLabel = channelStates.map((cs) => cs.channel.label).join(', ');
  return (
    <div
      ref={containerRef}
      className={['vt-timeseries', className].filter(Boolean).join(' ')}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="vt-timeseries__canvas"
        role="img"
        aria-label={`Multi-axis chart: ${ariaLabel}`}
      />
    </div>
  );
}
