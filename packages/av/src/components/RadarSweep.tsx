import { useEffect, useRef } from 'react';
import type { RadarSweepProps, RadarTarget } from '../types';

/**
 * PPI radar sweep. A rotating line scans the scope; targets get
 * "painted" each time the sweep crosses them and decay back to the
 * background color over `persistence` seconds.
 */
export function RadarSweep({
  targets: targetsProp,
  range = 50,
  sweepRate = 1,
  persistence = 3,
  size = 400,
  mockMode,
  className,
}: RadarSweepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetsRef = useRef<RadarTarget[]>(targetsProp ?? []);
  const sweepRef = useRef(0);
  const lastPaintedRef = useRef<Record<string, number>>({});

  useEffect(() => { if (targetsProp) targetsRef.current = targetsProp; }, [targetsProp]);

  // mockMode: 4 moving targets.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      targetsRef.current = [
        { id: 'A', bearing: (45 + Math.sin(t * 0.3) * 8) % 360, rangeM: 22 + Math.cos(t * 0.2) * 5 },
        { id: 'B', bearing: (160 + t * 4) % 360, rangeM: 32 + Math.sin(t * 0.5) * 4 },
        { id: 'C', bearing: (260 + Math.cos(t * 0.4) * 6) % 360, rangeM: 14 + Math.sin(t * 0.6) * 2 },
        { id: 'D', bearing: (320 + Math.sin(t * 0.5) * 12) % 360, rangeM: 41 + Math.cos(t * 0.3) * 3 },
      ];
    }, 80);
    return () => clearInterval(id);
  }, [mockMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    let lastT = performance.now();

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;

      // Background: dark green CRT
      ctx.fillStyle = '#06120D';
      ctx.fillRect(0, 0, size, size);

      // Range rings
      ctx.strokeStyle = 'rgba(29,158,117,0.4)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Sweep angle
      sweepRef.current = (sweepRef.current + sweepRate * dt * Math.PI * 2) % (Math.PI * 2);
      const sweepAngle = sweepRef.current;

      // Sweep wedge — fade trailing 40°
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle - Math.PI / 2);
      const wedge = ctx.createLinearGradient(0, 0, 0, -r);
      wedge.addColorStop(0, 'rgba(29,158,117,0)');
      wedge.addColorStop(1, 'rgba(29,158,117,0.65)');
      const wedgeAngle = (40 * Math.PI) / 180;
      ctx.fillStyle = wedge;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -Math.PI / 2 - wedgeAngle, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Sweep line (sharp leading edge)
      ctx.strokeStyle = 'rgba(150,255,200,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      ctx.stroke();
      ctx.restore();

      // Paint targets when the sweep crosses them; decay over persistence
      for (const t of targetsRef.current) {
        const ang = ((t.bearing % 360) * Math.PI) / 180 - Math.PI / 2;
        const sweepDelta = angularDiff(sweepAngle - Math.PI / 2, ang);
        if (Math.abs(sweepDelta) < (sweepRate * dt * Math.PI * 2) + 0.04) {
          lastPaintedRef.current[t.id] = now;
        }
        const lastPaint = lastPaintedRef.current[t.id];
        if (lastPaint === undefined) continue;
        const age = (now - lastPaint) / 1000;
        if (age > persistence) continue;
        const fade = 1 - age / persistence;
        const distFrac = Math.min(t.rangeM / range, 1);
        const tx = cx + Math.cos(ang) * distFrac * r;
        const ty = cy + Math.sin(ang) * distFrac * r;
        ctx.fillStyle = `rgba(150,255,200,${fade})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(220,255,230,${fade * 0.5})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Range label
      ctx.fillStyle = 'rgba(150,255,200,0.6)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${range} m`, cx + r - 4, cy - 4);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [size, range, sweepRate, persistence]);

  return (
    <div
      className={['vt-component vt-radar', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block', borderRadius: '50%', background: '#06120D', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label="Radar sweep display"
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ borderRadius: '50%' }} />
    </div>
  );
}

function angularDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
