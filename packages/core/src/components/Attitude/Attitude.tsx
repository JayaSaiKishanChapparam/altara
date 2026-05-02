import { useEffect, useRef, useState } from 'react';
import type { AttitudeProps, TelemetryValue } from '../../adapters/types';

interface ThemeTokens {
  textPrimary: string;
  textMuted: string;
  border: string;
}

function readTokens(el: HTMLElement): ThemeTokens {
  const s = getComputedStyle(el);
  return {
    textPrimary: s.getPropertyValue('--vt-text-primary').trim() || '#E8E6DF',
    textMuted: s.getPropertyValue('--vt-text-muted').trim() || '#7A7872',
    border: s.getPropertyValue('--vt-border').trim() || '#2E3133',
  };
}

const SKY_COLOR = '#3A78B8';
const GROUND_COLOR = '#7A4A2A';

const ROLL_MARKERS_DEG = [10, 20, 30, 45, 60];

/**
 * Artificial-horizon (attitude) indicator. Sky above the horizon, ground
 * below. Roll rotates the entire attitude ball; pitch slides it
 * vertically. The aircraft symbol is drawn last and never moves — it's
 * the reference (blueprint §6.2).
 */
export function Attitude({
  roll: rollProp,
  pitch: pitchProp,
  dataSource,
  size = 220,
  mockMode,
  className,
}: AttitudeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({ roll: rollProp ?? 0, pitch: pitchProp ?? 0 });
  // Bumped on every visible update so the wrapper's aria-label refreshes.
  const [, setVersion] = useState(0);

  // Keep stateRef synced with controlled props.
  useEffect(() => {
    if (rollProp !== undefined) stateRef.current.roll = rollProp;
    if (pitchProp !== undefined) stateRef.current.pitch = pitchProp;
  }, [rollProp, pitchProp]);

  // Live data source: split by `channel` ('roll' | 'pitch') if present.
  useEffect(() => {
    if (!dataSource) return;
    for (const v of dataSource.getHistory()) apply(v);
    const off = dataSource.subscribe(apply);
    return () => {
      off();
    };
    function apply(v: TelemetryValue) {
      if (v.channel === 'pitch') stateRef.current.pitch = v.value;
      else stateRef.current.roll = v.value;
    }
  }, [dataSource]);

  // mockMode: gentle out-of-phase roll/pitch oscillation.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      stateRef.current.roll = Math.sin(t * 0.5) * 35;
      stateRef.current.pitch = Math.sin(t * 0.7 + 1) * 20;
    }, 33);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  // rAF render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const tokens = readTokens(container);
      const { roll, pitch } = stateRef.current;
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 8;

      ctx.save();
      ctx.clearRect(0, 0, size, size);

      // Clip to the gauge circle so sky/ground fills don't bleed.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Apply roll (rotation) + pitch (vertical translation).
      const pitchPxPerDeg = r / 30;
      const pitchOffset = pitch * pitchPxPerDeg;
      ctx.translate(cx, cy);
      ctx.rotate((-roll * Math.PI) / 180);
      ctx.translate(0, pitchOffset);

      // Sky (above) + ground (below).
      ctx.fillStyle = SKY_COLOR;
      ctx.fillRect(-r * 2, -r * 2, r * 4, r * 2);
      ctx.fillStyle = GROUND_COLOR;
      ctx.fillRect(-r * 2, 0, r * 4, r * 2);

      // Horizon line.
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();

      // Pitch ladder: short white lines at 5° increments, longer every 10°.
      ctx.lineWidth = 1.5;
      ctx.font = `${Math.max(8, size * 0.045)}px monospace`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let p = -60; p <= 60; p += 5) {
        if (p === 0) continue;
        const y = -p * pitchPxPerDeg;
        const isMajor = p % 10 === 0;
        const w = isMajor ? r * 0.35 : r * 0.18;
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        if (isMajor) {
          ctx.fillText(`${Math.abs(p)}`, -w - 4, y);
        }
      }

      ctx.restore();

      // Outer ring + roll scale (drawn in screen space — does not rotate).
      ctx.save();
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.translate(cx, cy);
      ctx.fillStyle = tokens.textPrimary;
      ctx.strokeStyle = tokens.textPrimary;
      ctx.lineWidth = 2;
      const rollScaleR = r - 4;
      // Roll bug at the top — small downward triangle indicating "level".
      ctx.beginPath();
      ctx.moveTo(0, -rollScaleR + 2);
      ctx.lineTo(-5, -rollScaleR + 12);
      ctx.lineTo(5, -rollScaleR + 12);
      ctx.closePath();
      ctx.fill();
      // Tick marks.
      for (const m of ROLL_MARKERS_DEG) {
        for (const sign of [-1, 1]) {
          const angle = sign * (m * Math.PI) / 180 - Math.PI / 2;
          const x1 = Math.cos(angle) * (rollScaleR - 8);
          const y1 = Math.sin(angle) * (rollScaleR - 8);
          const x2 = Math.cos(angle) * rollScaleR;
          const y2 = Math.sin(angle) * rollScaleR;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Aircraft reference symbol (fixed — never rotates).
      ctx.strokeStyle = '#F4D03F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, 0);
      ctx.lineTo(-r * 0.15, 0);
      ctx.lineTo(-r * 0.05, r * 0.07);
      ctx.moveTo(r * 0.05, r * 0.07);
      ctx.lineTo(r * 0.15, 0);
      ctx.lineTo(r * 0.45, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#F4D03F';
      ctx.fill();

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [size]);

  // Periodic re-render so screen-readers see fresh attitude values.
  useEffect(() => {
    const id = setInterval(() => setVersion((n) => (n + 1) % 1_000_000), 500);
    return () => clearInterval(id);
  }, []);

  const { roll, pitch } = stateRef.current;
  return (
    <div
      ref={containerRef}
      className={['vt-component', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block' }}
      role="img"
      aria-label={`Attitude: roll ${roll.toFixed(1)}°, pitch ${pitch.toFixed(1)}°`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
