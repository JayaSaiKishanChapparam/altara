import { useEffect, useRef, useState } from 'react';
import type { SLAMMapProps, SLAMPose } from '../types';

/**
 * SLAM map view: an occupancy grid with the vehicle's evolving pose
 * graph drawn on top. Loop-closure events render as highlighted edges
 * and ringed nodes — common when a robot revisits a known location.
 */
export function SLAMMap({
  grid: gridProp,
  poses: posesProp,
  showPoseGraph = true,
  size = 600,
  mockMode,
  className,
}: SLAMMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<number[][] | null>(gridProp ?? null);
  const [poses, setPoses] = useState<SLAMPose[]>(posesProp ?? []);

  useEffect(() => { if (gridProp) setGrid(gridProp); }, [gridProp]);
  useEffect(() => { if (posesProp) setPoses(posesProp); }, [posesProp]);

  // mockMode: an expanding map + a circular trajectory that closes a loop.
  useEffect(() => {
    if (!mockMode) return;
    const cols = 60;
    const rows = 60;
    let nextPoseIndex = 0;
    const built: SLAMPose[] = [];
    // Pre-populate the grid with walls + corridor.
    const g: number[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) return 100;
        if (Math.random() < 0.04) return -1;
        return 0;
      }),
    );
    setGrid(g);

    const id = setInterval(() => {
      const t = nextPoseIndex / 50;
      const cx = cols / 2;
      const cy = rows / 2;
      const radius = 18;
      const x = cx + Math.cos(t) * radius;
      const y = cy + Math.sin(t) * radius;
      const theta = t + Math.PI / 2;
      const loopClosure = nextPoseIndex > 50 && nextPoseIndex % 60 === 0;
      built.push({ x, y, theta, ...(loopClosure ? { loopClosure: true } : {}) });
      setPoses([...built]);
      nextPoseIndex++;
      if (nextPoseIndex > 200) nextPoseIndex = 0;
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

    ctx.fillStyle = '#0E0F10';
    ctx.fillRect(0, 0, size, size);

    if (!grid || !grid[0]) {
      ctx.fillStyle = '#7A7872';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO MAP DATA', size / 2, size / 2);
      return;
    }
    const rows = grid.length;
    const cols = grid[0].length;
    const cellW = size / cols;
    const cellH = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[r]?.[c] ?? -1;
        ctx.fillStyle = v < 0 ? '#2E3133' : v >= 50 ? '#1A1A18' : '#FFFFFF';
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    if (showPoseGraph && poses.length > 1) {
      // Edges
      ctx.strokeStyle = '#37D3E0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < poses.length; i++) {
        const p = poses[i]!;
        const px = p.x * cellW;
        const py = p.y * cellH;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Nodes
      for (const p of poses) {
        const px = p.x * cellW;
        const py = p.y * cellH;
        ctx.fillStyle = p.loopClosure ? '#E24B4A' : '#37D3E0';
        ctx.beginPath();
        ctx.arc(px, py, p.loopClosure ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
        if (p.loopClosure) {
          ctx.strokeStyle = '#E24B4A';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Current pose arrow
      const last = poses[poses.length - 1]!;
      const lx = last.x * cellW;
      const ly = last.y * cellH;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(last.theta);
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
  }, [grid, poses, size, showPoseGraph]);

  return (
    <div
      className={['vt-component vt-slam', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block', background: 'var(--vt-bg-panel)', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label={`SLAM map — ${poses.length} pose nodes`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
