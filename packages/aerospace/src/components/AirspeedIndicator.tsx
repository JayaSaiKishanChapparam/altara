import { useEffect, useRef } from 'react';
import type { AirspeedIndicatorProps } from '../types';
import type { TelemetryValue } from '@altara/core';
import { clamp } from '../utils/tokens';

const SIZE_PX = { sm: 120, md: 180, lg: 240 } as const;

/**
 * FAA-style airspeed indicator with coloured arc zones:
 *   • white arc: vso → vfe (flap operating range)
 *   • green arc: vs1 → vno (normal operating range)
 *   • yellow arc: vno → vne (caution range)
 *   • red line: vne (never-exceed)
 * Sweep is 270° (open at the bottom, like a real ASI).
 */
export function AirspeedIndicator({
  airspeed: spdProp,
  dataSource,
  vso = 45,
  vs1 = 55,
  vfe = 100,
  vno = 165,
  vne = 200,
  size = 'md',
  mockMode,
  className,
}: AirspeedIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const valueRef = useRef<number>(spdProp ?? 0);

  useEffect(() => { if (spdProp !== undefined) valueRef.current = spdProp; }, [spdProp]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => { valueRef.current = v.value; };
    const hist = dataSource.getHistory();
    const last = hist.length > 0 ? hist[hist.length - 1] : undefined;
    if (last) apply(last);
    const off = dataSource.subscribe(apply);
    return () => { off(); };
  }, [dataSource]);

  useEffect(() => {
    if (!mockMode || dataSource) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      // Sweep through normal operating range — vs1 → vno.
      const mid = (vs1 + vno) / 2;
      const amp = (vno - vs1) / 2 * 0.85;
      valueRef.current = mid + Math.sin(t * 0.4) * amp;
    }, 33);
    return () => clearInterval(id);
  }, [mockMode, dataSource, vs1, vno]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const px = SIZE_PX[size];
    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dial config — sweep 270° centered at top. 0 kt at -135°, vne at +135°.
    const cx = px / 2;
    const cy = px / 2;
    const r = px / 2 - 10;
    const startDeg = -135;
    const endDeg = 135;
    const totalSweep = endDeg - startDeg;
    const max = vne;
    const speedToAngle = (v: number) => startDeg + (clamp(v, 0, max) / max) * totalSweep;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const value = valueRef.current;

      ctx.clearRect(0, 0, px, px);
      // Bezel
      ctx.fillStyle = '#1F2224';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0E0F10';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Coloured arcs
      drawArc(ctx, cx, cy, r - 14, speedToAngle(vso), speedToAngle(vfe), '#FFFFFF', 6);
      drawArc(ctx, cx, cy, r - 14, speedToAngle(vs1), speedToAngle(vno), '#1D9E75', 6);
      drawArc(ctx, cx, cy, r - 14, speedToAngle(vno), speedToAngle(vne), '#EF9F27', 6);

      // Vne red line
      const vneAng = speedToAngle(vne);
      const vneRad = (vneAng - 90) * (Math.PI / 180);
      ctx.strokeStyle = '#E24B4A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(vneRad) * (r - 22), cy + Math.sin(vneRad) * (r - 22));
      ctx.lineTo(cx + Math.cos(vneRad) * (r - 4), cy + Math.sin(vneRad) * (r - 4));
      ctx.stroke();

      // Tick marks every 10 kt, labels every 20 kt
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 1.4;
      const step = 10;
      for (let v = 0; v <= max; v += step) {
        const aDeg = speedToAngle(v);
        const aRad = (aDeg - 90) * (Math.PI / 180);
        const major = v % 20 === 0;
        const r1 = r - 6;
        const r2 = major ? r - 22 : r - 14;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(aRad) * r1, cy + Math.sin(aRad) * r1);
        ctx.lineTo(cx + Math.cos(aRad) * r2, cy + Math.sin(aRad) * r2);
        ctx.stroke();
        if (major) {
          const lr = r - 34;
          ctx.fillText(`${v}`, cx + Math.cos(aRad) * lr, cy + Math.sin(aRad) * lr);
        }
      }

      // Needle
      const angDeg = speedToAngle(value);
      const angRad = (angDeg - 90) * (Math.PI / 180);
      ctx.strokeStyle = '#F4D03F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angRad) * (r - 18), cy + Math.sin(angRad) * (r - 18));
      ctx.stroke();
      ctx.fillStyle = '#F4D03F';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#9A9890';
      ctx.font = '10px sans-serif';
      ctx.fillText('KNOTS', cx, cy + r - 24);

      // Digital readout
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${Math.round(value)}`, cx, cy + 18);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [size, vso, vs1, vfe, vno, vne]);

  const px = SIZE_PX[size];
  return (
    <div
      ref={containerRef}
      className={['vt-component vt-asi', className].filter(Boolean).join(' ')}
      style={{ width: px, height: px, display: 'inline-block', color: 'var(--vt-text-primary)' }}
      role="img"
      aria-label={`Airspeed: ${Math.round(valueRef.current)} knots`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
  color: string, width: number,
) {
  const start = (startDeg - 90) * (Math.PI / 180);
  const end = (endDeg - 90) * (Math.PI / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end, false);
  ctx.stroke();
}
