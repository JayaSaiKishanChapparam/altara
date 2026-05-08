import { useEffect, useState } from 'react';
import type { VelocityVectorDisplayProps } from '../types';
import { clamp } from '../utils/tokens';

/**
 * Top-down vehicle diagram with arrow overlays — linear velocity (vx,
 * vy) as a scaled arrow, angular velocity (yaw rate) as a curved arc
 * around the rear axle. SVG; pure render of three numeric props.
 */
export function VelocityVectorDisplay({
  vx: vxProp,
  vy: vyProp,
  omega: omegaProp,
  scale = 1,
  size = 200,
  mockMode,
  className,
}: VelocityVectorDisplayProps) {
  const [vx, setVx] = useState(vxProp ?? 0);
  const [vy, setVy] = useState(vyProp ?? 0);
  const [omega, setOmega] = useState(omegaProp ?? 0);

  useEffect(() => { if (vxProp !== undefined) setVx(vxProp); }, [vxProp]);
  useEffect(() => { if (vyProp !== undefined) setVy(vyProp); }, [vyProp]);
  useEffect(() => { if (omegaProp !== undefined) setOmega(omegaProp); }, [omegaProp]);

  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      // Cycle: forward → right turn → reverse → left turn
      const phase = (t * 0.3) % (Math.PI * 2);
      setVx(Math.cos(phase) * 8);
      setVy(Math.sin(phase) * 1.5);
      setOmega(Math.sin(phase * 2) * 0.7);
    }, 60);
    return () => clearInterval(id);
  }, [mockMode]);

  const cx = size / 2;
  const cy = size / 2;

  // Vehicle body (top-down, nose up)
  const bodyW = size * 0.18;
  const bodyH = size * 0.32;

  // Velocity arrow — vx maps to forward (negative Y in SVG), vy to lateral
  const arrowMag = Math.hypot(vx, vy);
  const maxMag = 10;
  const armR = (clamp(arrowMag / maxMag, 0, 1) * (size / 2 - 16)) * scale;
  const arrowAngle = Math.atan2(vy, vx); // 0 = forward
  const ax = cx + Math.sin(arrowAngle) * armR;
  const ay = cy - Math.cos(arrowAngle) * armR;

  // Angular velocity arc — radius depends on omega magnitude
  const arcR = clamp(Math.abs(omega) * 30, 0, size / 2 - 30);
  const arcStart = -Math.PI / 2;
  const arcEnd = arcStart + (omega > 0 ? Math.abs(omega) * 1.2 : -Math.abs(omega) * 1.2);
  const arc = describeArc(cx, cy, arcR, arcStart, arcEnd);

  return (
    <div
      className={['vt-component vt-velvector', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block', background: 'var(--vt-bg-panel)', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label={`Velocity: vx=${vx.toFixed(1)} m/s, vy=${vy.toFixed(1)} m/s, omega=${omega.toFixed(2)} rad/s`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        {/* Heading reference circle */}
        <circle cx={cx} cy={cy} r={size / 2 - 8} fill="none" stroke="var(--vt-border)" strokeDasharray="3 4" />
        {/* Vehicle */}
        <rect
          x={cx - bodyW / 2}
          y={cy - bodyH / 2}
          width={bodyW}
          height={bodyH}
          rx={4}
          fill="rgba(244,208,63,0.18)"
          stroke="#F4D03F"
          strokeWidth={1.5}
        />
        {/* Nose triangle */}
        <polygon
          points={`${cx},${cy - bodyH / 2 - 6} ${cx - bodyW / 2 + 2},${cy - bodyH / 2 + 4} ${cx + bodyW / 2 - 2},${cy - bodyH / 2 + 4}`}
          fill="#F4D03F"
        />
        {/* Velocity arrow */}
        {arrowMag > 0.05 && (
          <g>
            <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#37D3E0" strokeWidth={2.5} strokeLinecap="round" />
            <polygon
              points={arrowHeadPoints(cx, cy, ax, ay, 7)}
              fill="#37D3E0"
            />
          </g>
        )}
        {/* Angular velocity arc */}
        {Math.abs(omega) > 0.05 && arcR > 4 && (
          <path d={arc} fill="none" stroke="#D946EF" strokeWidth={2} />
        )}
        {/* Readouts */}
        <text x={8} y={14} fill="var(--vt-text-muted)" fontSize={10} fontFamily="monospace">
          vx {vx.toFixed(1)}
        </text>
        <text x={8} y={26} fill="var(--vt-text-muted)" fontSize={10} fontFamily="monospace">
          vy {vy.toFixed(1)}
        </text>
        <text x={size - 8} y={14} fill="var(--vt-text-muted)" fontSize={10} fontFamily="monospace" textAnchor="end">
          ω {omega.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = endAngle > startAngle ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arrowHeadPoints(x0: number, y0: number, x1: number, y1: number, size: number): string {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const a1 = ang + Math.PI - 0.4;
  const a2 = ang + Math.PI + 0.4;
  return [
    `${x1},${y1}`,
    `${x1 + Math.cos(a1) * size},${y1 + Math.sin(a1) * size}`,
    `${x1 + Math.cos(a2) * size},${y1 + Math.sin(a2) * size}`,
  ].join(' ');
}
