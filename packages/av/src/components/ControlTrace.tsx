import { useEffect, useRef } from 'react';
import type { ControlTraceProps } from '../types';

interface Sample { t: number; v: number; }

interface State {
  throttle: Sample[];
  brake: Sample[];
  steering: Sample[];
}

/**
 * Three vertically stacked time-series panels — throttle, brake,
 * steering — sharing an X axis. The classic drive-data view: useful
 * for analysing handoffs, takeovers, and disengagements in autonomous
 * pipelines. Pure canvas; takes one data source per channel.
 */
export function ControlTrace({
  throttleSource: _ts,
  brakeSource: _bs,
  steeringSource: _ss,
  windowMs = 15_000,
  syncScroll: _syncScroll = true,
  showPhase = false,
  mockMode,
  className,
}: ControlTraceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<State>({ throttle: [], brake: [], steering: [] });
  const widthRef = useRef(720);

  // mockMode: synthesize realistic drive controls
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const now = performance.now();
      const t = now / 1000;
      // Throttle 0..100 — bursty
      const throttle = Math.max(0, 30 + Math.sin(t * 0.2) * 35 + Math.sin(t * 0.7) * 15);
      // Brake — short, sharp pulses
      const brakePulse = Math.max(0, Math.sin(t * 0.13) * 80 - 40);
      // Steering -45..45
      const steering = Math.sin(t * 0.18) * 25 + Math.sin(t * 0.55) * 8;

      const s = stateRef.current;
      s.throttle.push({ t: now, v: throttle });
      s.brake.push({ t: now, v: brakePulse });
      s.steering.push({ t: now, v: steering });
      const cutoff = now - windowMs - 500;
      while (s.throttle.length && s.throttle[0]!.t < cutoff) s.throttle.shift();
      while (s.brake.length && s.brake[0]!.t < cutoff) s.brake.shift();
      while (s.steering.length && s.steering[0]!.t < cutoff) s.steering.shift();
    }, 30);
    return () => clearInterval(id);
  }, [mockMode, windowMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = widthRef.current;
    const H = 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const now = performance.now();
      const start = now - windowMs;
      const padX = 8;
      const padY = 6;
      const rowH = (H - padY * 4) / 3;

      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, W, H);

      const rows = [
        { label: 'Throttle', color: '#1D9E75', samples: stateRef.current.throttle, min: 0, max: 100 },
        { label: 'Brake', color: '#E24B4A', samples: stateRef.current.brake, min: 0, max: 100 },
        { label: 'Steering', color: '#37D3E0', samples: stateRef.current.steering, min: -45, max: 45 },
      ];

      rows.forEach((row, idx) => {
        const yTop = padY + idx * (rowH + padY);
        // Background
        ctx.fillStyle = '#181A1B';
        ctx.fillRect(padX, yTop, W - padX * 2, rowH);
        ctx.strokeStyle = '#2E3133';
        ctx.lineWidth = 1;
        ctx.strokeRect(padX + 0.5, yTop + 0.5, W - padX * 2 - 1, rowH - 1);

        // Centerline for steering
        if (row.min < 0) {
          const zero = yTop + rowH * (1 - (0 - row.min) / (row.max - row.min));
          ctx.strokeStyle = '#2E3133';
          ctx.beginPath(); ctx.moveTo(padX, zero); ctx.lineTo(W - padX, zero); ctx.stroke();
        }

        // Trace
        ctx.strokeStyle = row.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (const s of row.samples) {
          const x = padX + ((s.t - start) / windowMs) * (W - padX * 2);
          const y = yTop + rowH * (1 - (s.v - row.min) / (row.max - row.min));
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();

        // Latest readout
        const last = row.samples[row.samples.length - 1];
        ctx.fillStyle = row.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(row.label.toUpperCase(), padX + 6, yTop + 12);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        if (last) {
          const unit = idx === 2 ? '°' : '%';
          ctx.fillText(`${last.v.toFixed(1)}${unit}`, W - padX - 6, yTop + 12);
        }

        // Phase markers
        if (showPhase && row.samples.length > 1) {
          const last = row.samples[row.samples.length - 1]!;
          if (idx === 0 && last.v > 60) {
            ctx.fillStyle = 'rgba(29,158,117,0.18)';
            ctx.fillRect(padX, yTop, W - padX * 2, rowH);
          }
        }
      });
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [windowMs, showPhase]);

  return (
    <div
      className={['vt-component vt-controltrace', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        width: widthRef.current,
        height: 320,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
      }}
      role="img"
      aria-label="Vehicle control trace — throttle, brake, steering"
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
