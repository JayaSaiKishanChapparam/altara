import { useEffect, useRef } from 'react';
import type { HorizontalSituationIndicatorProps } from '../types';
import type { TelemetryValue } from '@altara/core';
import { readTokens, wrap360, clamp } from '../utils/tokens';

interface HsiState {
  heading: number;
  headingBug: number;
  course: number;
  courseDev: number;
  bearing1: number | undefined;
  bearing2: number | undefined;
}

const CYAN = '#37D3E0';
const MAGENTA = '#D946EF';
const SELECTED = '#F4D03F';

/**
 * Garmin G1000-style HSI: rotating compass card, heading bug, CDI with
 * TO/FROM, two optional bearing pointers. Canvas — heading drives the
 * whole rose so cardinal labels rotate with the aircraft.
 */
export function HorizontalSituationIndicator({
  dataSource,
  heading: hdgProp,
  headingBug: bugProp,
  course: crsProp,
  courseDev: devProp,
  toFrom = 'off',
  bearing1: b1Prop,
  bearing2: b2Prop,
  groundSpeed,
  distanceToWaypoint,
  size = 280,
  mockMode,
  className,
}: HorizontalSituationIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<HsiState>({
    heading: hdgProp ?? 0,
    headingBug: bugProp ?? 0,
    course: crsProp ?? 0,
    courseDev: devProp ?? 0,
    bearing1: b1Prop,
    bearing2: b2Prop,
  });

  useEffect(() => {
    const s = stateRef.current;
    if (hdgProp !== undefined) s.heading = hdgProp;
    if (bugProp !== undefined) s.headingBug = bugProp;
    if (crsProp !== undefined) s.course = crsProp;
    if (devProp !== undefined) s.courseDev = devProp;
    s.bearing1 = b1Prop;
    s.bearing2 = b2Prop;
  }, [hdgProp, bugProp, crsProp, devProp, b1Prop, b2Prop]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      const s = stateRef.current;
      switch (v.channel) {
        case 'heading': s.heading = v.value; break;
        case 'headingBug': s.headingBug = v.value; break;
        case 'course': s.course = v.value; break;
        case 'courseDev': s.courseDev = v.value; break;
        default: s.heading = v.value; break;
      }
    };
    for (const v of dataSource.getHistory()) apply(v);
    const off = dataSource.subscribe(apply);
    return () => { off(); };
  }, [dataSource]);

  useEffect(() => {
    if (!mockMode || dataSource) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const s = stateRef.current;
      s.heading = wrap360(45 + Math.sin(t * 0.1) * 35);
      s.headingBug = 60;
      s.course = 50;
      s.courseDev = Math.sin(t * 0.4) * 0.6;
      s.bearing1 = wrap360(120 + Math.sin(t * 0.2) * 20);
      s.bearing2 = wrap360(280 + Math.sin(t * 0.15) * 10);
    }, 33);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const tokens = readTokens(container);
      const s = stateRef.current;
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 6;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, size, size);

      // Outer ring (does not rotate). Lubber line at top.
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy - r + 12);
      ctx.stroke();

      // Compass rose — rotates so current heading is at the lubber line.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-s.heading * Math.PI) / 180);

      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${Math.round(size * 0.06)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 1.5;
      for (let d = 0; d < 360; d += 5) {
        const ang = (d * Math.PI) / 180 - Math.PI / 2;
        const major = d % 30 === 0;
        const minor = d % 10 === 0;
        const inner = major ? r - 18 : minor ? r - 12 : r - 7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (r - 2), Math.sin(ang) * (r - 2));
        ctx.lineTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
        ctx.stroke();
        if (major) {
          const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : `${d / 10}`;
          ctx.save();
          const lx = Math.cos(ang) * (r - 32);
          const ly = Math.sin(ang) * (r - 32);
          ctx.translate(lx, ly);
          ctx.rotate((d * Math.PI) / 180);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }

      // Heading bug
      drawArrowHead(ctx, s.headingBug, r - 2, CYAN);

      // Bearing pointers
      if (s.bearing1 !== undefined) drawBearingPointer(ctx, s.bearing1, r, '#37D3E0');
      if (s.bearing2 !== undefined) drawBearingPointer(ctx, s.bearing2, r, MAGENTA);

      // Course needle
      drawCourseNeedle(ctx, s.course, s.courseDev, r, MAGENTA, toFrom);

      ctx.restore();

      // Aircraft symbol (fixed)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = SELECTED;
      ctx.fillStyle = SELECTED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 12);
      ctx.moveTo(-10, -2);
      ctx.lineTo(10, -2);
      ctx.moveTo(-4, 10);
      ctx.lineTo(4, 10);
      ctx.stroke();
      ctx.restore();

      // Readouts
      ctx.fillStyle = tokens.textPrimary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `${Math.max(10, size * 0.045)}px sans-serif`;
      if (groundSpeed !== undefined) {
        ctx.fillText(`GS ${Math.round(groundSpeed)} kt`, 8, 8);
      }
      if (distanceToWaypoint !== undefined) {
        ctx.textAlign = 'right';
        ctx.fillText(`${distanceToWaypoint.toFixed(1)} nm`, size - 8, 8);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `bold ${Math.round(size * 0.055)}px monospace`;
      ctx.fillText(`HDG ${Math.round(s.heading).toString().padStart(3, '0')}°`, cx, size - 26);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [size, toFrom, groundSpeed, distanceToWaypoint]);

  return (
    <div
      ref={containerRef}
      className={['vt-component vt-hsi', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block' }}
      role="img"
      aria-label={`HSI heading ${Math.round(stateRef.current.heading)}°, course ${Math.round(stateRef.current.course)}°`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

function drawArrowHead(ctx: CanvasRenderingContext2D, deg: number, radius: number, color: string) {
  ctx.save();
  ctx.rotate((deg * Math.PI) / 180);
  ctx.translate(0, -radius);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-7, 16);
  ctx.lineTo(-7, 24);
  ctx.lineTo(7, 24);
  ctx.lineTo(7, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBearingPointer(ctx: CanvasRenderingContext2D, deg: number, radius: number, color: string) {
  ctx.save();
  ctx.rotate((deg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 26);
  ctx.lineTo(0, -radius + 50);
  ctx.moveTo(0, radius - 50);
  ctx.lineTo(0, radius - 26);
  ctx.stroke();
  // Arrowhead at top
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 18);
  ctx.lineTo(-5, -radius + 28);
  ctx.lineTo(5, -radius + 28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCourseNeedle(
  ctx: CanvasRenderingContext2D,
  course: number,
  dev: number,
  radius: number,
  color: string,
  toFrom: 'to' | 'from' | 'off',
) {
  ctx.save();
  ctx.rotate((course * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  // Shaft
  ctx.beginPath();
  ctx.moveTo(0, -radius + 30);
  ctx.lineTo(0, -22);
  ctx.moveTo(0, 22);
  ctx.lineTo(0, radius - 30);
  ctx.stroke();
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(0, -radius + 26);
  ctx.lineTo(-7, -radius + 40);
  ctx.lineTo(7, -radius + 40);
  ctx.closePath();
  ctx.fill();

  // Deviation bar (slides perpendicular to course)
  const offset = clamp(dev, -1, 1) * 32;
  ctx.beginPath();
  ctx.moveTo(offset, -22);
  ctx.lineTo(offset, 22);
  ctx.lineWidth = 4;
  ctx.stroke();

  // Dots at ±0.5 / ±1.0 deflection
  ctx.fillStyle = '#FFFFFF';
  for (const d of [-2, -1, 1, 2]) {
    ctx.beginPath();
    ctx.arc(d * 16, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // TO/FROM triangle
  if (toFrom !== 'off') {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (toFrom === 'to') {
      ctx.moveTo(0, -54);
      ctx.lineTo(-6, -42);
      ctx.lineTo(6, -42);
    } else {
      ctx.moveTo(0, 54);
      ctx.lineTo(-6, 42);
      ctx.lineTo(6, 42);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
