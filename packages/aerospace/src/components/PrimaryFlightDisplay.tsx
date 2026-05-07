import { useEffect, useRef } from 'react';
import type { PrimaryFlightDisplayProps } from '../types';
import { readTokens, clamp, wrap360 } from '../utils/tokens';
import type { TelemetryValue } from '@altara/core';

const SIZES = {
  sm: { w: 360, h: 270 },
  md: { w: 520, h: 390 },
  lg: { w: 680, h: 510 },
  xl: { w: 880, h: 660 },
} as const;

const SKY = '#3A78B8';
const GROUND = '#7A4A2A';
const HORIZON = '#FFFFFF';
const FD_MAGENTA = '#D946EF';
const TAPE_BG = 'rgba(20, 22, 24, 0.78)';
const TAPE_BORDER = 'rgba(255,255,255,0.18)';
const SELECTED = '#F4D03F';

interface PfdState {
  roll: number;
  pitch: number;
  heading: number;
  airspeed: number;
  altitude: number;
  vs: number;
  fdRoll: number;
  fdPitch: number;
}

/**
 * Composite PFD — attitude sphere + airspeed/altitude/heading tapes + VSI
 * + flight director, painted to a single canvas. The whole instrument
 * runs on one rAF loop reading from a single state ref so the sub-bands
 * stay in lockstep with no cross-component re-render churn.
 */
export function PrimaryFlightDisplay({
  dataSource,
  roll: rollProp,
  pitch: pitchProp,
  heading: hdgProp,
  airspeed: spdProp,
  altitude: altProp,
  vs: vsProp,
  altimeterSetting = 29.92,
  showFlightDirector = false,
  fdRoll: fdRollProp,
  fdPitch: fdPitchProp,
  size = 'md',
  mockMode,
  className,
}: PrimaryFlightDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<PfdState>({
    roll: rollProp ?? 0,
    pitch: pitchProp ?? 0,
    heading: hdgProp ?? 0,
    airspeed: spdProp ?? 0,
    altitude: altProp ?? 0,
    vs: vsProp ?? 0,
    fdRoll: fdRollProp ?? 0,
    fdPitch: fdPitchProp ?? 0,
  });

  useEffect(() => {
    const s = stateRef.current;
    if (rollProp !== undefined) s.roll = rollProp;
    if (pitchProp !== undefined) s.pitch = pitchProp;
    if (hdgProp !== undefined) s.heading = hdgProp;
    if (spdProp !== undefined) s.airspeed = spdProp;
    if (altProp !== undefined) s.altitude = altProp;
    if (vsProp !== undefined) s.vs = vsProp;
    if (fdRollProp !== undefined) s.fdRoll = fdRollProp;
    if (fdPitchProp !== undefined) s.fdPitch = fdPitchProp;
  }, [rollProp, pitchProp, hdgProp, spdProp, altProp, vsProp, fdRollProp, fdPitchProp]);

  useEffect(() => {
    if (!dataSource) return;
    const apply = (v: TelemetryValue) => {
      const s = stateRef.current;
      switch (v.channel) {
        case 'roll': s.roll = v.value; break;
        case 'pitch': s.pitch = v.value; break;
        case 'heading': s.heading = v.value; break;
        case 'airspeed': s.airspeed = v.value; break;
        case 'altitude': s.altitude = v.value; break;
        case 'vs': s.vs = v.value; break;
        case 'fdRoll': s.fdRoll = v.value; break;
        case 'fdPitch': s.fdPitch = v.value; break;
        default: break;
      }
    };
    for (const v of dataSource.getHistory()) apply(v);
    const off = dataSource.subscribe(apply);
    return () => { off(); };
  }, [dataSource]);

  // mockMode: a stylised cruise-with-occasional-bank profile.
  useEffect(() => {
    if (!mockMode || dataSource) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const s = stateRef.current;
      s.roll = Math.sin(t * 0.25) * 18;
      s.pitch = Math.sin(t * 0.4 + 0.7) * 8;
      s.heading = wrap360(90 + Math.sin(t * 0.15) * 25);
      s.airspeed = 120 + Math.sin(t * 0.3) * 12;
      s.altitude = 4500 + Math.sin(t * 0.18) * 220;
      s.vs = Math.cos(t * 0.18) * 600;
      s.fdRoll = Math.sin(t * 0.25 + 0.5) * 12;
      s.fdPitch = Math.sin(t * 0.4 + 1.3) * 5;
    }, 33);
    return () => clearInterval(id);
  }, [mockMode, dataSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dim = SIZES[size];
    const W = dim.w;
    const H = dim.h;
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setupCanvas();

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const tokens = readTokens(container);
      const s = stateRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0A0B0C';
      ctx.fillRect(0, 0, W, H);

      // Layout: airspeed tape | attitude (with VSI on right) | altitude tape
      // Heading tape spans the bottom under the attitude region.
      const tapeW = Math.round(W * 0.13);
      const attX = tapeW;
      const attW = W - tapeW * 2;
      const attH = H - Math.round(H * 0.13);
      drawAttitude(ctx, s, attX, 0, attW, attH, tokens.border, showFlightDirector);
      drawAirspeedTape(ctx, s.airspeed, 0, 0, tapeW, attH);
      drawAltitudeTape(ctx, s.altitude, altimeterSetting, W - tapeW, 0, tapeW, attH);
      drawVSI(ctx, s.vs, W - tapeW - 38, 0, 38, attH);
      drawHeadingTape(ctx, s.heading, 0, attH, W, H - attH);

      // Slip/skid indicator under the roll bug.
      drawSlipSkid(ctx, attX, 0, attW, s.roll);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [size, showFlightDirector, altimeterSetting]);

  const dim = SIZES[size];
  const s = stateRef.current;
  return (
    <div
      ref={containerRef}
      className={['vt-component vt-pfd', className].filter(Boolean).join(' ')}
      style={{ width: dim.w, height: dim.h, display: 'inline-block' }}
      role="img"
      aria-label={`PFD: roll ${s.roll.toFixed(0)}°, pitch ${s.pitch.toFixed(0)}°, heading ${Math.round(s.heading)}°, ${Math.round(s.airspeed)} kt, ${Math.round(s.altitude)} ft, ${Math.round(s.vs)} fpm`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

// ── Sub-renderers ───────────────────────────────────────────────────────

function drawAttitude(
  ctx: CanvasRenderingContext2D,
  s: PfdState,
  x: number, y: number, w: number, h: number,
  border: string,
  showFD: boolean,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  const pitchPxPerDeg = r / 25;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.translate(cx, cy);
  ctx.rotate((-s.roll * Math.PI) / 180);
  ctx.translate(0, s.pitch * pitchPxPerDeg);

  // Sky / ground
  ctx.fillStyle = SKY;
  ctx.fillRect(-w * 1.5, -h * 2, w * 3, h * 2);
  ctx.fillStyle = GROUND;
  ctx.fillRect(-w * 1.5, 0, w * 3, h * 2);
  ctx.strokeStyle = HORIZON;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w * 1.5, 0);
  ctx.lineTo(w * 1.5, 0);
  ctx.stroke();

  // Pitch ladder
  ctx.lineWidth = 1.5;
  ctx.font = '11px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let p = -60; p <= 60; p += 5) {
    if (p === 0) continue;
    const yy = -p * pitchPxPerDeg;
    const major = p % 10 === 0;
    const lw = major ? r * 0.32 : r * 0.16;
    ctx.beginPath();
    ctx.moveTo(-lw, yy);
    ctx.lineTo(lw, yy);
    ctx.stroke();
    if (major) {
      ctx.fillText(`${Math.abs(p)}`, -lw - 14, yy);
      ctx.fillText(`${Math.abs(p)}`, lw + 14, yy);
    }
  }
  ctx.restore();

  // Roll scale (does not rotate)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  for (const m of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const ang = (m * Math.PI) / 180 - Math.PI / 2;
    const r1 = r - 4;
    const r2 = Math.abs(m) % 30 === 0 ? r - 16 : r - 10;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.stroke();
  }
  // Roll pointer (rotated by -roll so it stays vertical to ground)
  ctx.save();
  ctx.rotate((-s.roll * Math.PI) / 180);
  ctx.fillStyle = SELECTED;
  ctx.beginPath();
  ctx.moveTo(0, -r + 6);
  ctx.lineTo(-6, -r + 18);
  ctx.lineTo(6, -r + 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Aircraft reference (fixed)
  ctx.strokeStyle = SELECTED;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, 0);
  ctx.lineTo(-r * 0.12, 0);
  ctx.moveTo(r * 0.12, 0);
  ctx.lineTo(r * 0.35, 0);
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = SELECTED;
  ctx.fill();

  // Flight director crossbars (magenta, rotated by FD command)
  if (showFD) {
    ctx.save();
    ctx.rotate(((s.fdRoll - s.roll) * Math.PI) / 180);
    const fdY = (s.fdPitch - s.pitch) * pitchPxPerDeg;
    ctx.strokeStyle = FD_MAGENTA;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, fdY);
    ctx.lineTo(r * 0.4, fdY);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Outline border around the attitude region
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawSlipSkid(
  ctx: CanvasRenderingContext2D,
  x: number, _y: number, w: number,
  roll: number,
) {
  const cx = x + w / 2;
  const cy = 32;
  // The slip ball is a quick proxy for lateral acceleration — for a
  // demo PFD we drive it from the roll signal so it looks alive.
  const offset = clamp(roll * 0.4, -16, 16);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(cx - 24, cy - 5, 48, 10);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 24, cy - 5, 48, 10);
  ctx.beginPath();
  ctx.arc(cx + offset, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
}

function drawAirspeedTape(
  ctx: CanvasRenderingContext2D,
  airspeed: number,
  x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.fillStyle = TAPE_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = TAPE_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const cy = y + h / 2;
  const pxPerKt = h / 80; // 80 kt visible
  const ktAtCenter = airspeed;

  // Tick marks every 10 kt, labels every 20 kt
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  const minK = Math.floor((ktAtCenter - 40) / 10) * 10;
  const maxK = Math.ceil((ktAtCenter + 40) / 10) * 10;
  for (let k = minK; k <= maxK; k += 10) {
    if (k < 0) continue;
    const yy = cy - (k - ktAtCenter) * pxPerKt;
    if (yy < y + 8 || yy > y + h - 8) continue;
    const major = k % 20 === 0;
    const tickW = major ? 10 : 6;
    ctx.beginPath();
    ctx.moveTo(x + w - tickW, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    if (major) ctx.fillText(`${k}`, x + w - 14, yy);
  }

  // Center readout box
  const boxH = 28;
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 4, cy - boxH / 2, w - 8, boxH);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(x + 4, cy - boxH / 2, w - 8, boxH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(airspeed)}`, x + w / 2, cy);

  // Label
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#9A9890';
  ctx.fillText('IAS kt', x + w / 2, y + 12);

  ctx.restore();
}

function drawAltitudeTape(
  ctx: CanvasRenderingContext2D,
  altitude: number,
  altSetting: number,
  x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.fillStyle = TAPE_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = TAPE_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const cy = y + h / 2;
  const pxPer100 = h / 16; // 1600 ft visible
  const aAtCenter = altitude;

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  const min = Math.floor((aAtCenter - 800) / 100) * 100;
  const max = Math.ceil((aAtCenter + 800) / 100) * 100;
  for (let a = min; a <= max; a += 100) {
    const yy = cy - ((a - aAtCenter) / 100) * pxPer100;
    if (yy < y + 8 || yy > y + h - 8) continue;
    const major = a % 500 === 0;
    const tickW = major ? 10 : 6;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + tickW, yy);
    ctx.stroke();
    if (major) ctx.fillText(`${a}`, x + 14, yy);
  }

  // Center readout box
  const boxH = 28;
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 4, cy - boxH / 2, w - 8, boxH);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(x + 4, cy - boxH / 2, w - 8, boxH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(altitude)}`, x + w / 2, cy);

  // Kollsman window
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 4, y + h - 28, w - 8, 22);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(x + 4, y + h - 28, w - 8, 22);
  ctx.fillStyle = '#1D9E75';
  ctx.font = '12px monospace';
  ctx.fillText(altSetting.toFixed(2), x + w / 2, y + h - 17);

  // Label
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#9A9890';
  ctx.fillText('ALT ft', x + w / 2, y + 12);

  ctx.restore();
}

function drawVSI(
  ctx: CanvasRenderingContext2D,
  vs: number,
  x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.fillStyle = TAPE_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = TAPE_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const cy = y + h / 2;
  const range = 2000;
  const pxPerFt = (h * 0.42) / range;
  // Scale ticks
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const v of [-2000, -1000, -500, 500, 1000, 2000]) {
    const yy = cy - v * pxPerFt;
    ctx.beginPath();
    ctx.moveTo(x + w - 8, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    ctx.fillText(`${Math.abs(v) / 1000 || '·5'}`, x + w / 2 - 2, yy);
  }
  // Pointer
  const clamped = clamp(vs, -range, range);
  const pY = cy - clamped * pxPerFt;
  ctx.strokeStyle = SELECTED;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w, pY);
  ctx.lineTo(x + w - 14, pY - 5);
  ctx.lineTo(x + w - 14, pY + 5);
  ctx.closePath();
  ctx.fillStyle = SELECTED;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHeadingTape(
  ctx: CanvasRenderingContext2D,
  heading: number,
  x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.fillStyle = TAPE_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = TAPE_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const cx = x + w / 2;
  const pxPerDeg = w / 100; // 100° visible
  const hdg = wrap360(heading);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;

  const minDeg = Math.floor(hdg - 50);
  const maxDeg = Math.ceil(hdg + 50);
  for (let d = minDeg; d <= maxDeg; d += 5) {
    const xx = cx + (d - hdg) * pxPerDeg;
    if (xx < x + 4 || xx > x + w - 4) continue;
    const display = wrap360(d);
    const major = d % 10 === 0;
    const tickH = major ? 10 : 6;
    ctx.beginPath();
    ctx.moveTo(xx, y);
    ctx.lineTo(xx, y + tickH);
    ctx.stroke();
    if (major) {
      // Cardinal labels at N/E/S/W
      let label: string;
      if (display === 0) label = 'N';
      else if (display === 90) label = 'E';
      else if (display === 180) label = 'S';
      else if (display === 270) label = 'W';
      else label = `${display / 10}`;
      ctx.fillText(label, xx, y + 14);
    }
  }

  // Center readout
  const boxW = 56;
  const boxH = 24;
  ctx.fillStyle = '#000';
  ctx.fillRect(cx - boxW / 2, y + h - boxH - 4, boxW, boxH);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(cx - boxW / 2, y + h - boxH - 4, boxW, boxH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(hdg).toString().padStart(3, '0')}°`, cx, y + h - boxH / 2 - 4);
  ctx.restore();
}
