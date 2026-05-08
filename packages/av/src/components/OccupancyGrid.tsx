import { useEffect, useRef, useState } from 'react';
import type { OccupancyGridProps } from '../types';
import { clamp } from '../utils/tokens';

/**
 * 2D occupancy-grid renderer. Free cells render in `colorFree`,
 * occupied in `colorOccupied`, unknown (`-1`) in `colorUnknown`.
 * Vehicle pose, goal marker, and a planned path are overlaid in
 * grid-frame coordinates.
 */
export function OccupancyGrid({
  dataSource: _dataSource,
  grid: gridProp,
  width = 600,
  height = 600,
  vehiclePos: vehProp,
  goal: goalProp,
  path = [],
  colorFree = '#FFFFFF',
  colorOccupied = '#1A1A18',
  colorUnknown = '#2E3133',
  mockMode,
  className,
}: OccupancyGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<number[][] | null>(gridProp ?? null);
  const [vehicle, setVehicle] = useState(vehProp);
  const [goal, setGoal] = useState(goalProp);

  useEffect(() => { if (gridProp) setGrid(gridProp); }, [gridProp]);
  useEffect(() => { setVehicle(vehProp); }, [vehProp]);
  useEffect(() => { setGoal(goalProp); }, [goalProp]);

  // mockMode: synthesize a small room with corridors + a moving vehicle.
  useEffect(() => {
    if (!mockMode) return;
    const cols = 60;
    const rows = 60;
    const g: number[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        // Outer walls
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) return 100;
        // Two inner partitions
        if (r === Math.floor(rows / 3) && c > 5 && c < cols - 5) return 100;
        if (c === Math.floor(cols / 2) && r > Math.floor(rows / 3) + 3 && r < rows - 8) return 100;
        // Doorway gap
        if (r === Math.floor(rows / 3) && c >= 15 && c <= 17) return 0;
        // Some unknown patches
        if (Math.random() < 0.05) return -1;
        return 0;
      }),
    );
    setGrid(g);

    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const vx = cols / 2 + Math.cos(t * 0.4) * (cols / 4);
      const vy = rows / 2 + Math.sin(t * 0.4) * (rows / 4);
      setVehicle({ x: vx, y: vy, theta: t * 0.4 + Math.PI / 2 });
      setGoal({ x: cols - 6, y: 6 });
    }, 60);
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

    ctx.clearRect(0, 0, width, height);
    if (!grid || grid.length === 0 || !grid[0]) {
      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#7A7872';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO GRID DATA', width / 2, height / 2);
      return;
    }

    const rows = grid.length;
    const cols = grid[0].length;
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[r]?.[c] ?? -1;
        ctx.fillStyle = v < 0 ? colorUnknown : v >= 50 ? colorOccupied : colorFree;
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Path
    if (path.length > 1) {
      ctx.strokeStyle = '#37D3E0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = path[i]!;
        const px = p.x * cellW + cellW / 2;
        const py = p.y * cellH + cellH / 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Goal
    if (goal) {
      const gx = clamp(goal.x, 0, cols - 1) * cellW + cellW / 2;
      const gy = clamp(goal.y, 0, rows - 1) * cellH + cellH / 2;
      ctx.strokeStyle = '#1D9E75';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx - 6, gy);
      ctx.lineTo(gx + 6, gy);
      ctx.moveTo(gx, gy - 6);
      ctx.lineTo(gx, gy + 6);
      ctx.stroke();
    }

    // Vehicle
    if (vehicle) {
      const vx = clamp(vehicle.x, 0, cols - 1) * cellW + cellW / 2;
      const vy = clamp(vehicle.y, 0, rows - 1) * cellH + cellH / 2;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(vehicle.theta);
      ctx.fillStyle = '#F4D03F';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, 6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }, [grid, vehicle, goal, path, width, height, colorFree, colorOccupied, colorUnknown]);

  return (
    <div
      className={['vt-component vt-occgrid', className].filter(Boolean).join(' ')}
      style={{ width, height, display: 'inline-block', background: 'var(--vt-bg-panel)', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label="Occupancy grid map"
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
