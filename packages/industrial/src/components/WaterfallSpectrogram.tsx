import { useEffect, useMemo, useRef } from 'react';
import type { WaterfallSpectrogramProps, ColorMap } from '../types';
import { magnitudeDb, hannWindow } from '../utils/fft';
import { clamp } from '../utils/tokens';

/**
 * Real-time spectrogram waterfall: frequency content scrolls downward
 * as time advances, amplitude (dB) encoded as color. Internally:
 *
 *   raw signal samples -> Hann window -> radix-2 FFT -> magnitude (dB)
 *   -> single row of pixels via the configured color map
 *
 * The component owns its own ring buffer of FFT frames; the canvas is
 * rendered by writing one new row per `scrollRate` frames-per-second
 * and translating prior rows down by 1 px (`drawImage` self-blit, the
 * standard waterfall trick).
 *
 * For very large FFT sizes (≥4096) at high cadences, push the FFT into
 * a Web Worker via `createWorkerDataSource` from `@altara/core`. This
 * inline path is fine for ≤2048 at 30 Hz on modern hardware.
 */
export function WaterfallSpectrogram({
  dataSource: _ds,
  fftSize = 512,
  sampleRate = 1000,
  freqMin = 0,
  freqMax = 500,
  colorMap = 'heat',
  dbRange = [-80, 0],
  scrollRate = 30,
  width = 800,
  height = 400,
  mockMode,
  className,
}: WaterfallSpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleBufRef = useRef<Float32Array>(new Float32Array(fftSize));
  const sampleHeadRef = useRef(0);
  const palette = useMemo(() => makePalette(colorMap), [colorMap]);

  // mockMode: synthesise a vibration-style signal — sweeping fundamental
  // + 2nd harmonic + a noise floor. Drives sampleBufRef at sampleRate.
  useEffect(() => {
    if (!mockMode) return;
    const intervalMs = 1000 / Math.max(scrollRate, 1);
    const id = setInterval(() => {
      const t0 = performance.now() / 1000;
      const sweepHz = 60 + Math.sin(t0 * 0.3) * 30;
      // Generate fftSize fresh samples back-to-back.
      const buf = sampleBufRef.current;
      for (let i = 0; i < fftSize; i++) {
        const t = t0 + i / sampleRate;
        const fundamental = Math.sin(2 * Math.PI * sweepHz * t);
        const harmonic = 0.4 * Math.sin(2 * Math.PI * sweepHz * 2 * t);
        const noise = (Math.random() - 0.5) * 0.15;
        buf[i] = fundamental + harmonic + noise;
      }
      sampleHeadRef.current = (sampleHeadRef.current + 1) % 1_000_000;
    }, intervalMs);
    return () => clearInterval(id);
  }, [mockMode, fftSize, sampleRate, scrollRate]);

  // Canvas rendering — one row per scrollRate ticks.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Initial fill — black background.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Reusable working buffers
    const half = fftSize >> 1;
    const winFn = hannWindow(fftSize);
    const windowed = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    const dbBins = new Float32Array(half);

    // Frequency-bin → screen-x mapping
    const binHz = sampleRate / fftSize;
    const minBin = Math.max(0, Math.floor(freqMin / binHz));
    const maxBin = Math.min(half - 1, Math.ceil(freqMax / binHz));
    const visibleBins = Math.max(1, maxBin - minBin);

    // A 1-row offscreen ImageData we paint per frame.
    const rowImage = ctx.createImageData(width, 1);

    let lastScroll = performance.now();
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = now - lastScroll;
      const periodMs = 1000 / Math.max(scrollRate, 1);
      if (dt < periodMs) return;
      lastScroll = now;

      // Pull a fresh frame out of the sample buffer.
      magnitudeDb(sampleBufRef.current, winFn, windowed, imag, dbBins);

      // Render one row from dbBins[minBin..maxBin] across screen x.
      const data = rowImage.data;
      for (let x = 0; x < width; x++) {
        const t = x / Math.max(1, width - 1);
        const binFloat = minBin + t * visibleBins;
        const lo = Math.floor(binFloat);
        const hi = Math.min(maxBin, lo + 1);
        const f = binFloat - lo;
        const db = dbBins[lo]! * (1 - f) + dbBins[hi]! * f;
        const norm = clamp(
          (db - dbRange[0]) / (dbRange[1] - dbRange[0] || 1),
          0,
          1,
        );
        const idx = Math.min(255, Math.floor(norm * 255));
        const off = x * 4;
        data[off] = palette[idx * 4]!;
        data[off + 1] = palette[idx * 4 + 1]!;
        data[off + 2] = palette[idx * 4 + 2]!;
        data[off + 3] = 255;
      }

      // Scroll: copy existing waterfall down 1 row, then paint new row at top.
      ctx.drawImage(canvas, 0, 0, width, height, 0, 1, width, height);
      ctx.putImageData(rowImage, 0, 0);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, fftSize, sampleRate, freqMin, freqMax, colorMap, dbRange, scrollRate, palette]);

  return (
    <div
      className={['vt-component vt-spectrogram', className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        background: '#000',
        border: '1px solid var(--vt-border)',
        borderRadius: 4,
      }}
      role="img"
      aria-label={`Waterfall spectrogram — ${freqMin}-${freqMax} Hz, color by amplitude (dB)`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div
        style={{
          position: 'absolute',
          left: 6, top: 6,
          fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)',
          textShadow: '0 0 3px #000', pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {freqMin} – {freqMax} Hz · FFT {fftSize}
      </div>
    </div>
  );
}

/** Build a 256-entry RGBA lookup table for the chosen color map. */
function makePalette(map: ColorMap): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b] = sample(map, t);
    lut[i * 4] = r;
    lut[i * 4 + 1] = g;
    lut[i * 4 + 2] = b;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

function sample(map: ColorMap, t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  if (map === 'grayscale') {
    const v = Math.round(x * 255);
    return [v, v, v];
  }
  if (map === 'heat') {
    // Black -> red -> yellow -> white
    const r = Math.min(1, x * 3) * 255;
    const g = Math.min(1, Math.max(0, x * 3 - 1)) * 255;
    const b = Math.min(1, Math.max(0, x * 3 - 2)) * 255;
    return [r | 0, g | 0, b | 0];
  }
  if (map === 'viridis') {
    // Compact viridis approximation
    const r = (0.267 + x * (-0.62 + x * (1.5 + x * (1.4 - x * 1.6)))) * 255;
    const g = (0.005 + x * (1.4 - x * 0.4)) * 255;
    const b = (0.33 + x * (0.6 - x * 0.85)) * 255;
    return [clamp255(r), clamp255(g), clamp255(b)];
  }
  // plasma
  const r = (0.05 + x * (2.1 - x * 1.0)) * 255;
  const g = x * x * 0.85 * 255;
  const b = (0.5 + x * (0.6 - x * 1.1)) * 255;
  return [clamp255(r), clamp255(g), clamp255(b)];
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
