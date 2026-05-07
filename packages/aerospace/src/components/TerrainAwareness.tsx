import { useEffect, useRef } from 'react';
import type { TerrainAwarenessProps } from '../types';
import { wrap360 } from '../utils/tokens';

interface TawsState {
  altitude: number;
  radioAltitude: number;
  heading: number;
  vs: number;
  grid: number[][] | null;
}

/**
 * Lightweight TAWS-style display. Paints a forward-looking terrain
 * footprint coloured by elevation relative to aircraft altitude:
 *
 *   • green: terrain ≥1000 ft below ownship
 *   • yellow: terrain within 500–1000 ft below
 *   • red: terrain within 500 ft below or above ownship
 *
 * Not a real GPWS — there's no closure-rate envelope. It is a
 * visualization that demonstrates the data model and looks credible.
 */
export function TerrainAwareness({
  altitude: altProp,
  radioAltitude: raProp,
  heading: hdgProp,
  vs: vsProp,
  terrainGrid,
  cellSizeNm: _cellSizeNm = 0.5,
  width = 360,
  height = 240,
  mockMode,
  className,
}: TerrainAwarenessProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef<TawsState>({
    altitude: altProp ?? 3000,
    radioAltitude: raProp ?? 2500,
    heading: hdgProp ?? 0,
    vs: vsProp ?? 0,
    grid: terrainGrid ?? null,
  });

  useEffect(() => {
    const s = stateRef.current;
    if (altProp !== undefined) s.altitude = altProp;
    if (raProp !== undefined) s.radioAltitude = raProp;
    if (hdgProp !== undefined) s.heading = hdgProp;
    if (vsProp !== undefined) s.vs = vsProp;
    if (terrainGrid !== undefined) s.grid = terrainGrid;
  }, [altProp, raProp, hdgProp, vsProp, terrainGrid]);

  // mockMode: synthesize a 32x32 terrain ridge ahead of the aircraft and
  // animate altitude descending toward it.
  useEffect(() => {
    if (!mockMode) return;
    const cols = 32;
    const rows = 32;
    const grid: number[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        // Centered ridge that peaks at row 8, falls off radially.
        const dx = (c - cols / 2) / (cols / 2);
        const dy = (r - 8) / (rows / 4);
        const ridge = Math.exp(-(dx * dx + dy * dy)) * 3200;
        return 800 + ridge + Math.sin(c * 0.6) * 80;
      }),
    );
    stateRef.current.grid = grid;

    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const s = stateRef.current;
      s.altitude = 3500 + Math.sin(t * 0.18) * 800;
      s.radioAltitude = Math.max(0, s.altitude - 600);
      s.heading = wrap360(45 + Math.sin(t * 0.05) * 10);
      s.vs = -300 + Math.sin(t * 0.3) * 200;
    }, 100);
    return () => clearInterval(id);
  }, [mockMode]);

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

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const s = stateRef.current;
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, width, height);

      const grid = s.grid;
      if (grid && grid.length > 0 && (grid[0]?.length ?? 0) > 0) {
        const rows = grid.length;
        const cols = grid[0]!.length;
        const cellW = width / cols;
        const cellH = height / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const elev = grid[r]?.[c] ?? 0;
            const delta = elev - s.altitude;
            ctx.fillStyle = colorForDelta(delta);
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      } else {
        ctx.fillStyle = '#1F2224';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#7A7872';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO TERRAIN DATA', width / 2, height / 2);
      }

      // Aircraft symbol at the bottom-center, pointing up
      const cx = width / 2;
      const cy = height - 22;
      ctx.strokeStyle = '#F4D03F';
      ctx.fillStyle = '#F4D03F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx - 8, cy + 6);
      ctx.lineTo(cx, cy + 2);
      ctx.lineTo(cx + 8, cy + 6);
      ctx.closePath();
      ctx.fill();

      // Status strip
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ALT ${Math.round(s.altitude)}`, 8, 16);
      ctx.fillText(`RA ${Math.round(s.radioAltitude)}`, 8, 30);
      ctx.textAlign = 'right';
      ctx.fillText(`HDG ${Math.round(wrap360(s.heading)).toString().padStart(3, '0')}°`, width - 8, 16);
      ctx.fillText(`VS ${Math.round(s.vs)}`, width - 8, 30);

      // Caution strip when any cell is within 500 ft below ownship
      const inWarn = grid ? hasTerrainCloserThan(grid, s.altitude, 500) : false;
      if (inWarn) {
        ctx.fillStyle = 'rgba(239,159,39,0.85)';
        ctx.fillRect(0, height - 18, width, 18);
        ctx.fillStyle = '#0E0F10';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TERRAIN — PULL UP', width / 2, height - 5);
      }
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [width, height]);

  return (
    <div
      className={['vt-component vt-taws', className].filter(Boolean).join(' ')}
      style={{
        width,
        height,
        display: 'inline-block',
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
      role="img"
      aria-label={`Terrain awareness display: altitude ${Math.round(stateRef.current.altitude)} ft, heading ${Math.round(wrap360(stateRef.current.heading))}°`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

function colorForDelta(deltaFt: number): string {
  // Terrain elevation minus aircraft altitude (positive = terrain above us).
  if (deltaFt >= -500) return '#A82828'; // within 500 ft below or above
  if (deltaFt >= -1000) return '#A6792B'; // 500–1000 ft below
  if (deltaFt >= -2000) return '#1F5B36'; // 1000–2000 ft below
  return '#0F2818'; // safely below
}

function hasTerrainCloserThan(grid: number[][], altitude: number, deltaFt: number): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell - altitude >= -deltaFt) return true;
    }
  }
  return false;
}
