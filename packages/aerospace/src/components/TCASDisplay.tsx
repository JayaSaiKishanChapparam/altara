import { useEffect, useRef, useState } from 'react';
import type { TCASDisplayProps, TcasTraffic, TcasThreatLevel } from '../types';
import { wrap360 } from '../utils/tokens';

const LEVEL_COLORS: Record<TcasThreatLevel, string> = {
  other: '#FFFFFF',
  proximate: '#FFFFFF',
  ta: '#EF9F27',
  ra: '#E24B4A',
};
const LEVEL_RANK: Record<TcasThreatLevel, number> = { other: 0, proximate: 1, ta: 2, ra: 3 };

/**
 * Plan-position TCAS display centered on ownship, north up. Each
 * intruder is drawn at its bearing/range with relative-altitude text and
 * an up/down trend arrow when verticalTrend is provided.
 */
export function TCASDisplay({
  traffic: trafficProp,
  rangeNm = 6,
  rings = 2,
  size = 320,
  mockMode,
  className,
}: TCASDisplayProps) {
  const [tick, setTick] = useState(0);
  const mockRef = useRef<TcasTraffic[]>([]);

  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 200);
    return () => clearInterval(id);
  }, [mockMode]);

  useEffect(() => {
    if (!mockMode) return;
    // Snapshot a synthetic traffic picture; we mutate positions on each tick.
    mockRef.current = [
      { id: 'AAL123', bearing: 30, rangeNm: 4.2, relAltFL: 8, level: 'other', verticalTrend: 0, callsign: 'AAL123' },
      { id: 'DLH88', bearing: 280, rangeNm: 2.8, relAltFL: -4, level: 'proximate', verticalTrend: -200 },
      { id: 'UAL40', bearing: 350, rangeNm: 1.6, relAltFL: 1, level: 'ta', verticalTrend: -700 },
      { id: 'JBU22', bearing: 95, rangeNm: 5.5, relAltFL: 12, level: 'other', verticalTrend: 300 },
    ];
  }, [mockMode]);

  const traffic = mockMode ? animateMockTraffic(mockRef.current, tick) : trafficProp ?? [];

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;

  return (
    <div
      className={['vt-component vt-tcas', className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        background: '#0E0F10',
        border: '1px solid var(--vt-border)',
        borderRadius: '50%',
        position: 'relative',
        color: 'var(--vt-text-primary)',
        fontFamily: 'sans-serif',
      }}
      role="img"
      aria-label={`TCAS display: ${traffic.length} aircraft, range ${rangeNm} nm`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
        {/* Range rings */}
        {Array.from({ length: rings }).map((_, i) => {
          const rr = r * ((i + 1) / rings);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={rr}
              fill="none"
              stroke="var(--vt-border)"
              strokeDasharray="3 4"
              strokeWidth={1}
            />
          );
        })}
        {/* Range labels (outer ring) */}
        <text x={cx + r + 2} y={cy - 4} fill="var(--vt-text-muted)" fontSize={10} fontFamily="monospace">
          {rangeNm}
        </text>
        {/* Cardinal markers */}
        {(['N', 'E', 'S', 'W'] as const).map((c, i) => {
          const ang = (i * 90 * Math.PI) / 180 - Math.PI / 2;
          const tx = cx + Math.cos(ang) * (r + 10);
          const ty = cy + Math.sin(ang) * (r + 10) + 4;
          return (
            <text key={c} x={tx} y={ty} fill="var(--vt-text-label)" fontSize={11} textAnchor="middle">
              {c}
            </text>
          );
        })}

        {/* Ownship symbol */}
        <polygon
          points={`${cx},${cy - 10} ${cx - 7},${cy + 6} ${cx},${cy + 2} ${cx + 7},${cy + 6}`}
          fill="#F4D03F"
        />

        {/* Traffic */}
        {[...traffic]
          .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
          .map((t) => {
            const dist = Math.min(t.rangeNm, rangeNm);
            const ang = ((wrap360(t.bearing) - 90) * Math.PI) / 180;
            const tx = cx + Math.cos(ang) * (dist / rangeNm) * r;
            const ty = cy + Math.sin(ang) * (dist / rangeNm) * r;
            const color = LEVEL_COLORS[t.level];
            const trendArrow = t.verticalTrend !== undefined && Math.abs(t.verticalTrend) > 250
              ? t.verticalTrend > 0 ? '↑' : '↓'
              : '';
            const altSign = t.relAltFL > 0 ? '+' : t.relAltFL < 0 ? '–' : ' ';
            const altMag = Math.abs(t.relAltFL).toString().padStart(2, '0');
            return (
              <g key={t.id}>
                {renderTrafficGlyph(t.level, tx, ty, color)}
                <text
                  x={tx + 12}
                  y={ty + 4}
                  fill={color}
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {altSign}
                  {altMag}
                  {trendArrow}
                </text>
                {t.callsign && (
                  <text x={tx + 12} y={ty + 16} fill="#9A9890" fontSize={9} fontFamily="monospace">
                    {t.callsign}
                  </text>
                )}
              </g>
            );
          })}

        {/* RA banner if any */}
        {traffic.some((t) => t.level === 'ra') && (
          <g>
            <rect x={cx - 50} y={size - 30} width={100} height={20} fill="#E24B4A" />
            <text x={cx} y={size - 16} textAnchor="middle" fontSize={12} fill="#000" fontWeight={700}>
              TRAFFIC RA
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function renderTrafficGlyph(level: TcasThreatLevel, x: number, y: number, color: string) {
  switch (level) {
    case 'ra':
      // Solid red square
      return <rect x={x - 6} y={y - 6} width={12} height={12} fill={color} />;
    case 'ta':
      // Filled amber circle
      return <circle cx={x} cy={y} r={6} fill={color} />;
    case 'proximate':
      // Filled white diamond
      return <polygon points={`${x},${y - 7} ${x + 6},${y} ${x},${y + 7} ${x - 6},${y}`} fill={color} />;
    default:
      // Hollow white diamond
      return (
        <polygon
          points={`${x},${y - 7} ${x + 6},${y} ${x},${y + 7} ${x - 6},${y}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      );
  }
}

function animateMockTraffic(seed: TcasTraffic[], tickIndex: number): TcasTraffic[] {
  if (!seed.length) return [];
  const t = tickIndex / 5;
  return seed.map((tr, i) => ({
    ...tr,
    bearing: wrap360(tr.bearing + Math.sin(t * 0.3 + i) * 6),
    rangeNm: Math.max(0.5, tr.rangeNm + Math.sin(t * 0.4 + i * 1.3) * 0.15),
    relAltFL: tr.relAltFL,
  }));
}
