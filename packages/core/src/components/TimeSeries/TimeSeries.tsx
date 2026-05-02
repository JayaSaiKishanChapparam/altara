import { useEffect, useMemo, useRef } from 'react';
import type {
  AltaraDataSource,
  TelemetryValue,
  TimeSeriesChannel,
  TimeSeriesProps,
} from '../../adapters/types';
import { RingBuffer } from '../../utils/RingBuffer';
import { sineWave } from '../../utils/mockData';

interface ChannelState {
  channel: TimeSeriesChannel;
  buffer: RingBuffer;
  color: string;
}

const DEFAULT_PALETTE = [
  '#378ADD', // info
  '#1D9E75', // active
  '#EF9F27', // warn
  '#E24B4A', // danger
  '#9E7CD5',
  '#3FBFB5',
];

interface ThemeTokens {
  bgPanel: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  warn: string;
  danger: string;
}

function readTokens(el: HTMLElement): ThemeTokens {
  const s = getComputedStyle(el);
  return {
    bgPanel: s.getPropertyValue('--vt-bg-panel').trim() || '#181A1B',
    textPrimary: s.getPropertyValue('--vt-text-primary').trim() || '#E8E6DF',
    textMuted: s.getPropertyValue('--vt-text-muted').trim() || '#7A7872',
    border: s.getPropertyValue('--vt-border').trim() || '#2E3133',
    warn: s.getPropertyValue('--vt-color-warn').trim() || '#EF9F27',
    danger: s.getPropertyValue('--vt-color-danger').trim() || '#E24B4A',
  };
}

function formatRelativeTime(deltaMs: number): string {
  const s = Math.round(deltaMs / 1000);
  if (s <= 0) return 'now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

/**
 * High-frequency Canvas chart. The render loop runs in requestAnimationFrame
 * and reads design tokens via getComputedStyle every frame so theme changes
 * propagate without React re-rendering the hot path (blueprint §4.2 / §13).
 */
export function TimeSeries({
  dataSource,
  channels,
  windowMs = 30_000,
  bufferSize = 10_000,
  thresholds,
  fps = 60,
  mockMode,
  height = 240,
  className,
}: TimeSeriesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastDrawRef = useRef(0);

  // Resolve channels (default = single anonymous channel) and freeze the buffer
  // identity across renders so the rAF loop reads from the same memory.
  const channelStates = useMemo<ChannelState[]>(() => {
    const list: TimeSeriesChannel[] =
      channels && channels.length > 0
        ? channels
        : [{ key: 'default', label: 'value' }];
    return list.map((c, i) => ({
      channel: c,
      buffer: new RingBuffer(bufferSize),
      color: c.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]!,
    }));
    // We deliberately ignore changes to bufferSize after mount to keep buffers stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(channels?.map((c) => c.key) ?? [])]);

  // Subscribe to the upstream data source.
  useEffect(() => {
    if (!dataSource) return;
    const byKey = new Map(channelStates.map((cs) => [cs.channel.key, cs]));
    const fallback = channelStates[0];
    const handle = (v: TelemetryValue) => {
      const target = v.channel ? byKey.get(v.channel) : fallback;
      if (!target) return;
      target.buffer.push(v.value, v.timestamp);
    };
    for (const v of dataSource.getHistory()) handle(v);
    const off = dataSource.subscribe(handle);
    return () => {
      off();
    };
  }, [dataSource, channelStates]);

  // mockMode: feed each channel its own sineWave so the chart shows multiple lines.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const generators = channelStates.map((_, i) => sineWave(0.3 + i * 0.15, 30 + i * 10));
    const id = setInterval(() => {
      const t = Date.now();
      channelStates.forEach((cs, i) => cs.buffer.push(generators[i]!(t), t));
    }, 1000 / Math.max(fps, 30));
    return () => clearInterval(id);
  }, [mockMode, dataSource, channelStates, fps]);

  // Animation loop — single rAF for the component lifetime.
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
      // Keep the backing store in DPR-scaled pixels (blueprint §13: DPI blurriness).
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

      const padLeft = 36;
      const padRight = 12;
      const padTop = 12;
      const padBottom = 22;
      const plotW = Math.max(cssWidth - padLeft - padRight, 1);
      const plotH = Math.max(cssHeight - padTop - padBottom, 1);

      const wallNow = Date.now();
      const tMin = wallNow - windowMs;

      // Find y-extent across all channels in the visible window.
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const cs of channelStates) {
        const values = cs.buffer.getValues();
        const times = cs.buffer.getTimes();
        for (let i = 0; i < values.length; i++) {
          if (times[i]! < tMin) continue;
          const v = values[i]!;
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
      if (thresholds) {
        for (const t of thresholds) {
          if (t.value < yMin) yMin = t.value;
          if (t.value > yMax) yMax = t.value;
        }
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        yMin = -1;
        yMax = 1;
      } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
      } else {
        const padding = (yMax - yMin) * 0.1;
        yMin -= padding;
        yMax += padding;
      }
      const yRange = yMax - yMin;

      const xFor = (t: number) => padLeft + ((t - tMin) / windowMs) * plotW;
      const yFor = (v: number) => padTop + (1 - (v - yMin) / yRange) * plotH;

      // Axis frame
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, padTop);
      ctx.lineTo(padLeft, padTop + plotH);
      ctx.lineTo(padLeft + plotW, padTop + plotH);
      ctx.stroke();

      // Y-axis labels (min, mid, max).
      ctx.fillStyle = tokens.textMuted;
      ctx.font = '11px var(--vt-font-mono, monospace)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const yLabels = [yMax, (yMax + yMin) / 2, yMin];
      for (const lv of yLabels) {
        ctx.fillText(lv.toFixed(1), padLeft - 4, yFor(lv));
      }

      // X-axis labels (now, -windowMs/2, -windowMs).
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xLabels = [
        { x: padLeft, ms: windowMs },
        { x: padLeft + plotW / 2, ms: windowMs / 2 },
        { x: padLeft + plotW, ms: 0 },
      ];
      for (const xl of xLabels) {
        ctx.fillText(formatRelativeTime(xl.ms), xl.x, padTop + plotH + 4);
      }

      // Threshold lines.
      if (thresholds) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (const t of thresholds) {
          ctx.strokeStyle = t.color;
          ctx.beginPath();
          const y = yFor(t.value);
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotW, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Channels.
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
          const y = yFor(values[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        if (started) ctx.stroke();
      }

      // Channel legend (top-right).
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '11px var(--vt-font-sans, sans-serif)';
      let legendY = padTop;
      for (const cs of channelStates) {
        const labelText = cs.channel.unit
          ? `${cs.channel.label} (${cs.channel.unit})`
          : cs.channel.label;
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
  }, [channelStates, windowMs, thresholds, fps]);

  const ariaLabel = channelStates.map((cs) => cs.channel.label).join(', ') || 'time series';
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
        aria-label={`Time series chart: ${ariaLabel}`}
      />
    </div>
  );
}
