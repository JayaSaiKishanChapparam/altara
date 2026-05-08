import { useEffect, useRef } from 'react';
import type { PIDTuningPanelProps } from '../types';

interface Sample { t: number; v: number; }

interface State {
  setpoint: Sample[];
  process: Sample[];
  output: Sample[];
}

/**
 * Real-time PID controller visualisation. Setpoint, process value, and
 * controller output overlay on a synchronised canvas; gain coefficients
 * appear in a side readout panel. mockMode runs a credible second-order
 * system reaching a sequence of step setpoints.
 */
export function PIDTuningPanel({
  setpointSource: _ss,
  processSource: _ps,
  outputSource: _os,
  kp = 1.0,
  ki = 0.0,
  kd = 0.0,
  errorBand = 5,
  unit = '',
  windowMs = 30_000,
  mockMode,
  className,
}: PIDTuningPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>({ setpoint: [], process: [], output: [] });
  const widthRef = useRef(640);
  const heightRef = useRef(280);

  // mockMode: step setpoints with a 2nd-order PV response.
  useEffect(() => {
    if (!mockMode) return;
    let pv = 50;
    let pvDot = 0;
    let outVal = 0;
    let integral = 0;
    let prevErr = 0;
    let stepIndex = 0;
    const steps = [50, 75, 30, 60, 90, 45];
    let lastStep = performance.now();

    const id = setInterval(() => {
      const now = performance.now();
      if (now - lastStep > 5500) {
        stepIndex = (stepIndex + 1) % steps.length;
        lastStep = now;
      }
      const sp = steps[stepIndex]!;
      // Discrete PID
      const err = sp - pv;
      integral = Math.max(-200, Math.min(200, integral + err * 0.05));
      const deriv = (err - prevErr) / 0.05;
      prevErr = err;
      outVal = Math.max(0, Math.min(100, kp * err + ki * integral + kd * deriv));
      // 2nd-order plant: pvDotDot = (out - 0.5*pv - 1.4*pvDot) / 4
      const pvDotDot = (outVal - 0.5 * pv - 1.4 * pvDot) / 4;
      pvDot += pvDotDot * 0.05;
      pv += pvDot * 0.05;

      const s = stateRef.current;
      s.setpoint.push({ t: now, v: sp });
      s.process.push({ t: now, v: pv });
      s.output.push({ t: now, v: outVal });
      const cutoff = now - windowMs - 500;
      for (const arr of [s.setpoint, s.process, s.output]) {
        while (arr.length && arr[0]!.t < cutoff) arr.shift();
      }
    }, 50);
    return () => clearInterval(id);
  }, [mockMode, kp, ki, kd, windowMs]);

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
      const now = performance.now();
      const start = now - windowMs;

      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, W, H);

      // Border
      ctx.strokeStyle = 'var(--vt-border)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Y-axis range fixed 0..100 for pv/sp/output (engineering proxy)
      const min = 0, max = 100;
      const padX = 8;
      const padY = 8;
      const plotW = W - padX * 2;
      const plotH = H - padY * 2;
      const yFor = (v: number) => padY + plotH * (1 - (v - min) / (max - min));
      const xFor = (t: number) => padX + ((t - start) / windowMs) * plotW;

      // Error band corridor around current setpoint
      const lastSp = stateRef.current.setpoint[stateRef.current.setpoint.length - 1]?.v;
      if (lastSp !== undefined) {
        ctx.fillStyle = 'rgba(46,49,51,0.5)';
        ctx.fillRect(padX, yFor(lastSp + errorBand), plotW, yFor(lastSp - errorBand) - yFor(lastSp + errorBand));
      }

      // Plot helpers
      const plot = (samples: Sample[], color: string, dashed = false) => {
        if (samples.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        if (dashed) ctx.setLineDash([6, 4]);
        ctx.beginPath();
        let started = false;
        for (const s of samples) {
          const x = xFor(s.t);
          const y = yFor(Math.max(min, Math.min(max, s.v)));
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
      };

      plot(stateRef.current.setpoint, '#37D3E0', true);
      plot(stateRef.current.process, '#1D9E75');
      plot(stateRef.current.output, '#EF9F27');

      // Readout panel (top-right)
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 130, 6, 124, 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Kp ${kp.toFixed(2)}`, W - 124, 12);
      ctx.fillText(`Ki ${ki.toFixed(2)}`, W - 124, 26);
      ctx.fillText(`Kd ${kd.toFixed(2)}`, W - 124, 40);
      const lastErr = lastSp !== undefined && stateRef.current.process.length > 0
        ? lastSp - stateRef.current.process[stateRef.current.process.length - 1]!.v
        : 0;
      ctx.fillStyle = Math.abs(lastErr) > errorBand ? '#EF9F27' : '#1D9E75';
      ctx.fillText(`err ${lastErr.toFixed(1)}${unit}`, W - 124, 54);

      // Legend (bottom-left)
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      let lx = padX + 4;
      const ly = H - 18;
      const items: [string, string][] = [['SP', '#37D3E0'], ['PV', '#1D9E75'], ['OUT', '#EF9F27']];
      for (const [label, color] of items) {
        ctx.fillStyle = color;
        ctx.fillRect(lx, ly + 4, 10, 6);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, lx + 14, ly);
        lx += 14 + ctx.measureText(label).width + 14;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kp, ki, kd, errorBand, unit, windowMs]);

  return (
    <div
      className={['vt-component vt-pid', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        width: widthRef.current,
        height: heightRef.current,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
      }}
      role="img"
      aria-label={`PID tuning — Kp ${kp.toFixed(2)}, Ki ${ki.toFixed(2)}, Kd ${kd.toFixed(2)}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
