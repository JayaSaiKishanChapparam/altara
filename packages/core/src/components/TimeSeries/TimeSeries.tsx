import { useEffect, useMemo, useRef } from 'react';
import type {
  DecimatedChannel,
  TelemetryValue,
  TimeSeriesChannel,
  TimeSeriesProps,
} from '../../adapters/types';
import { RingBuffer } from '../../utils/RingBuffer';
import { buildMinMaxBuckets, countVisibleSamples } from '../../utils/minMaxDecimation';
import { sineWave } from '../../utils/mockData';

interface ChannelState {
  channel: TimeSeriesChannel;
  /** Local sample store. `null` when the source decimates in its worker. */
  buffer: RingBuffer | null;
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

// Hoisted so the resize handler can derive the same plot width the draw pass
// uses — the worker buckets per pixel column, so it has to be told that width.
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const plotWidthFor = (cssWidth: number) => Math.max(cssWidth - PAD_LEFT - PAD_RIGHT, 1);

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
 *
 * Two data paths:
 *  - **Decimating source** (`dataSource.decimator`, e.g. `createWorkerDataSource`):
 *    the worker owns the ring buffers and the min/max reduction and hands back
 *    render-ready geometry. This component never sees a raw sample, so per-frame
 *    work is O(pixel columns) rather than O(samples buffered).
 *  - **Everything else** (mock, replay, rosbridge, MQTT): unchanged — buffer
 *    locally and decimate in the draw pass.
 *
 * Note that with a decimating source the `bufferSize` prop is ignored; capacity
 * is whatever the worker was configured with.
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

  const decimator = dataSource?.decimator ?? null;

  // Resolve channels (default = single anonymous channel) and freeze the buffer
  // identity across renders so the rAF loop reads from the same memory.
  const channelStates = useMemo<ChannelState[]>(() => {
    const list: TimeSeriesChannel[] =
      channels && channels.length > 0 ? channels : [{ key: 'default', label: 'value' }];
    return list.map((c, i) => ({
      channel: c,
      // Skip the allocation entirely when the worker is doing the buffering.
      buffer: decimator ? null : new RingBuffer(bufferSize),
      color: c.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]!,
    }));
    // We deliberately ignore changes to bufferSize after mount to keep buffers stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(channels?.map((c) => c.key) ?? []), decimator]);

  // Subscribe to the upstream data source. Skipped for decimating sources —
  // pulling every sample onto the main thread is exactly what they avoid.
  useEffect(() => {
    if (!dataSource || decimator) return;
    const byKey = new Map(channelStates.map((cs) => [cs.channel.key, cs]));
    const fallback = channelStates[0];
    const handle = (v: TelemetryValue) => {
      const target = v.channel ? byKey.get(v.channel) : fallback;
      if (!target?.buffer) return;
      target.buffer.push(v.value, v.timestamp);
    };
    for (const v of dataSource.getHistory()) handle(v);
    const off = dataSource.subscribe(handle);
    return () => {
      off();
    };
  }, [dataSource, channelStates, decimator]);

  // mockMode: feed each channel its own sineWave so the chart shows multiple lines.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const generators = channelStates.map((_, i) => sineWave(0.3 + i * 0.15, 30 + i * 10));
    const id = setInterval(
      () => {
        const t = Date.now();
        channelStates.forEach((cs, i) => cs.buffer?.push(generators[i]!(t), t));
      },
      1000 / Math.max(fps, 30),
    );
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
    const channelKeys = channelStates.map((cs) => cs.channel.key);

    // Reusable per-channel scratch buffers. The ring buffers are read once per
    // frame into these instead of allocating a fresh Float64Array per read —
    // getValues()/getTimes() allocate, readInto() does not, so the hot path
    // stays zero-allocation (blueprint §13: GC-induced jank). Unused, and so
    // not allocated, when the worker supplies decimated geometry.
    const scratch = decimator
      ? []
      : channelStates.map(() => ({
          values: new Float64Array(bufferSize),
          times: new Float64Array(bufferSize),
          bucketMinY: new Float64Array(bufferSize),
          bucketMaxY: new Float64Array(bufferSize),
          bucketSeen: new Uint8Array(bufferSize),
          bucketTouched: new Uint32Array(bufferSize),
          len: 0,
        }));

    // Each chart owns its own subscription, so two charts sharing a source do
    // not overwrite each other's channel set or plot width.
    const view = decimator ? decimator.acquire() : null;

    const publishViewport = () => {
      if (!view) return;
      view.setViewport({
        channels: channelKeys,
        windowMs,
        plotW: plotWidthFor(container.clientWidth),
      });
    };

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
      // Bucket columns are CSS pixels, so the worker is told the CSS width.
      // setViewport ignores unchanged specs, so calling it per resize is cheap.
      publishViewport();
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

      const padLeft = PAD_LEFT;
      const padTop = PAD_TOP;
      const plotW = plotWidthFor(cssWidth);
      const plotH = Math.max(cssHeight - PAD_TOP - PAD_BOTTOM, 1);

      const wallNow = Date.now();
      const tMin = wallNow - windowMs;

      const frame = view ? view.getFrame() : null;
      const byKey = new Map<string, DecimatedChannel>();
      if (frame) for (const fc of frame.channels) byKey.set(fc.key, fc);

      if (!decimator) {
        // Single read per channel per frame — feeds both the extent pass and the
        // draw pass below from the same snapshot, with zero allocation.
        for (let c = 0; c < channelStates.length; c++) {
          const s = scratch[c]!;
          s.len = channelStates[c]!.buffer!.readInto(s.values);
          channelStates[c]!.buffer!.readTimesInto(s.times);
        }
      }

      // Find y-extent across all channels in the visible window.
      let yMin = Infinity;
      let yMax = -Infinity;
      if (decimator) {
        for (const fc of byKey.values()) {
          if (!fc.extent) continue;
          if (fc.extent.min < yMin) yMin = fc.extent.min;
          if (fc.extent.max > yMax) yMax = fc.extent.max;
        }
      } else {
        for (const s of scratch) {
          for (let i = 0; i < s.len; i++) {
            if (s.times[i]! < tMin) continue;
            const v = s.values[i]!;
            if (v < yMin) yMin = v;
            if (v > yMax) yMax = v;
          }
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
      for (let c = 0; c < channelStates.length; c++) {
        const cs = channelStates[c]!;
        ctx.strokeStyle = cs.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        if (decimator) {
          const fc = byKey.get(cs.channel.key);
          if (!fc || fc.visibleCount === 0 || !frame) continue;
          // Geometry is drawn in the frame's own coordinate space, rescaled to
          // the current plot box. In the steady state the two are identical; on
          // the frame after a resize this stretches the last good geometry to
          // fit rather than blanking the plot for a tick.
          const xScale = plotW / frame.plotW;
          if (fc.mode === 'buckets' && fc.bucket && fc.minV && fc.maxV) {
            for (let i = 0; i < fc.bucket.length; i++) {
              const x = padLeft + (fc.bucket[i]! + 0.5) * xScale;
              ctx.moveTo(x, yFor(fc.minV[i]!));
              ctx.lineTo(x, yFor(fc.maxV[i]!));
            }
            ctx.stroke();
          } else if (fc.pointT && fc.pointV) {
            for (let i = 0; i < fc.pointT.length; i++) {
              const x = padLeft + ((fc.pointT[i]! - frame.tMin) / frame.windowMs) * plotW;
              const y = yFor(fc.pointV[i]!);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          continue;
        }

        const s = scratch[c]!;
        if (s.len === 0) continue;
        const visibleCount = countVisibleSamples(s.times, s.len, tMin);
        if (visibleCount > Math.ceil(plotW)) {
          const touchedCount = buildMinMaxBuckets(
            s.values,
            s.times,
            s.len,
            tMin,
            windowMs,
            plotW,
            padLeft,
            yFor,
            {
              minY: s.bucketMinY,
              maxY: s.bucketMaxY,
              seen: s.bucketSeen,
              touched: s.bucketTouched,
            },
          );
          for (let i = 0; i < touchedCount; i++) {
            const bucket = s.bucketTouched[i]!;
            const x = padLeft + bucket + 0.5;
            ctx.moveTo(x, s.bucketMinY[bucket]!);
            ctx.lineTo(x, s.bucketMaxY[bucket]!);
          }
          ctx.stroke();
        } else {
          let started = false;
          for (let i = 0; i < s.len; i++) {
            const t = s.times[i]!;
            if (t < tMin) continue;
            const x = xFor(t);
            const y = yFor(s.values[i]!);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          if (started) ctx.stroke();
        }
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
      view?.release();
    };
    // bufferSize is fixed for the component lifetime (see channelStates memo);
    // the scratch buffers are sized once at mount and intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelStates, windowMs, thresholds, fps, decimator]);

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
