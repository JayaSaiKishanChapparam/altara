import { useEffect, useMemo, useRef } from 'react';
import type {
  DecimatedChannel,
  MultiAxisChannel,
  MultiAxisPlotProps,
  TelemetryValue,
} from '../../adapters/types';
import { RingBuffer } from '../../utils/RingBuffer';
import { buildMinMaxBuckets, countVisibleSamples } from '../../utils/minMaxDecimation';
import { sineWave } from '../../utils/mockData';

interface ChannelState {
  channel: MultiAxisChannel;
  /** Local sample store. `null` when the source decimates in its worker. */
  buffer: RingBuffer | null;
  color: string;
  axis: 'left' | 'right';
}

const PALETTE = ['#378ADD', '#1D9E75', '#EF9F27', '#E24B4A', '#9E7CD5', '#3FBFB5'];

// Hoisted so the resize handler can derive the same plot width the draw pass
// uses — the worker buckets per pixel column, so it has to be told that width.
const PAD_LEFT = 44;
const PAD_RIGHT = 44;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const plotWidthFor = (cssWidth: number) => Math.max(cssWidth - PAD_LEFT - PAD_RIGHT, 1);

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

interface ChannelScratch {
  values: Float64Array;
  times: Float64Array;
  bucketMinY: Float64Array;
  bucketMaxY: Float64Array;
  bucketSeen: Uint8Array;
  bucketTouched: Uint32Array;
  len: number;
}

/** Shared tail of both extent paths, so local and worker-decimated axes scale identically. */
function padExtent(yMin: number, yMax: number): AxisExtent {
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return { min: -1, max: 1 };
  if (yMin === yMax) return { min: yMin - 1, max: yMax + 1 };
  const pad = (yMax - yMin) * 0.1;
  return { min: yMin - pad, max: yMax + pad };
}

function computeExtent(
  states: ChannelState[],
  scratch: ChannelScratch[],
  axis: 'left' | 'right',
  tMin: number,
): AxisExtent {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let c = 0; c < states.length; c++) {
    if (states[c]!.axis !== axis) continue;
    const s = scratch[c]!;
    for (let i = 0; i < s.len; i++) {
      if (s.times[i]! < tMin) continue;
      const v = s.values[i]!;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  return padExtent(yMin, yMax);
}

/** Axis extent from worker-supplied per-channel extents. O(channels), not O(samples). */
function computeExtentFromFrame(
  states: ChannelState[],
  byKey: Map<string, DecimatedChannel>,
  axis: 'left' | 'right',
): AxisExtent {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const cs of states) {
    if (cs.axis !== axis) continue;
    const fc = byKey.get(cs.channel.key);
    if (!fc?.extent) continue;
    if (fc.extent.min < yMin) yMin = fc.extent.min;
    if (fc.extent.max > yMax) yMax = fc.extent.max;
  }
  return padExtent(yMin, yMax);
}

/**
 * Time-series plot with independent left + right Y-axes — pair signals
 * with different units (e.g. battery % on the left, current draw in A on
 * the right). Same canvas + rAF + RingBuffer hot path as TimeSeries; the
 * only difference is the scaling/labeling logic per axis.
 *
 * Like TimeSeries, a `dataSource` exposing a `decimator` moves buffering and
 * min/max reduction into its worker; this component then draws render-ready
 * geometry and never touches a raw sample. `bufferSize` is ignored in that
 * mode — capacity belongs to the worker.
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

  const decimator = dataSource?.decimator ?? null;

  const channelStates = useMemo<ChannelState[]>(
    () =>
      channels.map((c, i) => ({
        channel: c,
        // Skip the allocation entirely when the worker is doing the buffering.
        buffer: decimator ? null : new RingBuffer(bufferSize),
        color: c.color ?? PALETTE[i % PALETTE.length]!,
        axis: c.axis ?? 'left',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(channels.map((c) => `${c.key}:${c.axis ?? 'left'}`)), decimator],
  );

  // Subscribe to upstream data, route by channel key. Skipped for decimating
  // sources — pulling every sample onto the main thread is what they avoid.
  useEffect(() => {
    if (!dataSource || decimator) return;
    const byKey = new Map(channelStates.map((cs) => [cs.channel.key, cs]));
    const handle = (v: TelemetryValue) => {
      const target = v.channel ? byKey.get(v.channel) : channelStates[0];
      if (!target?.buffer) return;
      target.buffer.push(v.value, v.timestamp);
    };
    for (const v of dataSource.getHistory()) handle(v);
    const off = dataSource.subscribe(handle);
    return () => {
      off();
    };
  }, [dataSource, channelStates, decimator]);

  // mockMode: per-channel sine waves with very different amplitudes per axis
  // so the dual-axis behavior is visible immediately.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const generators = channelStates.map((cs, i) =>
      sineWave(0.2 + i * 0.1, cs.axis === 'right' ? 0.8 + i * 0.2 : 30 + i * 10),
    );
    const id = setInterval(
      () => {
        const t = Date.now();
        channelStates.forEach((cs, i) => cs.buffer?.push(generators[i]!(t), t));
      },
      1000 / Math.max(fps, 30),
    );
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
    const channelKeys = channelStates.map((cs) => cs.channel.key);

    // Reusable per-channel scratch buffers: read each ring buffer once per frame
    // into these (zero-allocation) and feed both axis-extent and draw passes
    // from the same snapshot, instead of getValues()/getTimes() allocating
    // fresh Float64Arrays per read (blueprint §13: GC-induced jank). Unused,
    // and so not allocated, when the worker supplies decimated geometry.
    const scratch: ChannelScratch[] = decimator
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
        // Single read per channel per frame, shared by both axes and the draw pass.
        for (let c = 0; c < channelStates.length; c++) {
          const s = scratch[c]!;
          s.len = channelStates[c]!.buffer!.readInto(s.values);
          channelStates[c]!.buffer!.readTimesInto(s.times);
        }
      }

      const left = decimator
        ? computeExtentFromFrame(channelStates, byKey, 'left')
        : computeExtent(channelStates, scratch, 'left', tMin);
      const right = decimator
        ? computeExtentFromFrame(channelStates, byKey, 'right')
        : computeExtent(channelStates, scratch, 'right', tMin);

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
              ctx.moveTo(x, yFor(fc.minV[i]!, cs.axis));
              ctx.lineTo(x, yFor(fc.maxV[i]!, cs.axis));
            }
            ctx.stroke();
          } else if (fc.pointT && fc.pointV) {
            for (let i = 0; i < fc.pointT.length; i++) {
              const x = padLeft + ((fc.pointT[i]! - frame.tMin) / frame.windowMs) * plotW;
              const y = yFor(fc.pointV[i]!, cs.axis);
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
            (value) => yFor(value, cs.axis),
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
            const y = yFor(s.values[i]!, cs.axis);
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
      view?.release();
    };
    // bufferSize is fixed for the component lifetime (see channelStates memo);
    // the scratch buffers are sized once at mount and intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelStates, windowMs, fps, leftAxisLabel, rightAxisLabel, thresholds, decimator]);

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
