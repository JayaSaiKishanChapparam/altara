import { useEffect, useRef, useState } from 'react';
import type { PathPlannerOverlayProps } from '../types';

interface XY { x: number; y: number; }

/**
 * Top-down path-planner overlay: planned (blue) + actual (yellow)
 * trajectories with a deviation corridor. Cross-track error above
 * `crossTrackWarning` highlights the corridor in amber.
 *
 * Coordinates are passed as lat/lon but rendered in a flat local frame
 * by simple offset from the first waypoint — fine for the 0.1 km
 * scales typical of an AV demo. For real geographic visualisation
 * combine with `LiveMap` from @altara/core.
 */
export function PathPlannerOverlay({
  plannedPath: plannedProp,
  actualPath: actualProp,
  currentPos: currentProp,
  crossTrackWarning = 1.0,
  showDeviation = true,
  width = 600,
  height = 400,
  mockMode,
  className,
}: PathPlannerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [planned, setPlanned] = useState<Array<{ lat: number; lon: number }>>(plannedProp ?? []);
  const [actual, setActual] = useState<Array<{ lat: number; lon: number; timestamp: number }>>(actualProp ?? []);
  const [current, setCurrent] = useState(currentProp);

  useEffect(() => { if (plannedProp) setPlanned(plannedProp); }, [plannedProp]);
  useEffect(() => { if (actualProp) setActual(actualProp); }, [actualProp]);
  useEffect(() => { setCurrent(currentProp); }, [currentProp]);

  // mockMode: a planned S-curve with the actual path drifting around it.
  useEffect(() => {
    if (!mockMode) return;
    const plannedPts: Array<{ lat: number; lon: number }> = Array.from({ length: 50 }, (_, i) => {
      const t = i / 50;
      return { lat: 37.0 + t * 0.001, lon: -122.0 + Math.sin(t * Math.PI * 2) * 0.0008 };
    });
    setPlanned(plannedPts);

    const actualPts: Array<{ lat: number; lon: number; timestamp: number }> = [];
    let i = 0;
    const id = setInterval(() => {
      if (i >= plannedPts.length) i = 0;
      const ref = plannedPts[i]!;
      const t = performance.now() / 1000;
      const drift = 0.00005 + Math.sin(t * 0.7) * 0.00012;
      const point = { lat: ref.lat + drift, lon: ref.lon + drift * 0.5, timestamp: Date.now() };
      actualPts.push(point);
      if (actualPts.length > 200) actualPts.shift();
      setActual([...actualPts]);
      setCurrent({ lat: point.lat, lon: point.lon });
      i++;
    }, 80);
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
      ctx.fillStyle = '#0E0F10';
      ctx.fillRect(0, 0, width, height);

      if (planned.length < 2 && actual.length < 2) {
        ctx.fillStyle = '#7A7872';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO PATH DATA', width / 2, height / 2);
        return;
      }

      const all = [...planned, ...actual];
      const minLat = Math.min(...all.map(p => p.lat));
      const maxLat = Math.max(...all.map(p => p.lat));
      const minLon = Math.min(...all.map(p => p.lon));
      const maxLon = Math.max(...all.map(p => p.lon));
      const padFrac = 0.1;
      const latPad = (maxLat - minLat) * padFrac || 0.0001;
      const lonPad = (maxLon - minLon) * padFrac || 0.0001;
      const project = (p: { lat: number; lon: number }): XY => ({
        x: ((p.lon - (minLon - lonPad)) / ((maxLon + lonPad) - (minLon - lonPad))) * width,
        y: height - ((p.lat - (minLat - latPad)) / ((maxLat + latPad) - (minLat - latPad))) * height,
      });

      // Compute mean cross-track error for color cue
      let xte = 0;
      if (showDeviation && planned.length > 1 && actual.length > 0) {
        const lastActual = actual[actual.length - 1]!;
        const lastPlanned = planned[Math.min(actual.length - 1, planned.length - 1)] ?? planned[planned.length - 1]!;
        // approximate XTE in meters: degrees * 111000 / sqrt(2)
        xte = Math.hypot(lastActual.lat - lastPlanned.lat, lastActual.lon - lastPlanned.lon) * 111_000;
      }
      const corridorColor = xte > crossTrackWarning ? 'rgba(239,159,39,0.18)' : 'rgba(55,138,221,0.12)';

      // Corridor (planned ± thickness)
      if (showDeviation && planned.length > 1) {
        ctx.strokeStyle = corridorColor;
        ctx.lineWidth = 18;
        ctx.beginPath();
        for (let i = 0; i < planned.length; i++) {
          const p = project(planned[i]!);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Planned (cyan dashed)
      if (planned.length > 1) {
        ctx.strokeStyle = '#37D3E0';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (let i = 0; i < planned.length; i++) {
          const p = project(planned[i]!);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Actual (yellow solid)
      if (actual.length > 1) {
        ctx.strokeStyle = '#F4D03F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < actual.length; i++) {
          const p = project(actual[i]!);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Current position
      if (current) {
        const c = project(current);
        ctx.fillStyle = '#F4D03F';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0E0F10';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // XTE readout
      ctx.fillStyle = xte > crossTrackWarning ? 'var(--vt-color-warn)' : 'var(--vt-text-muted)';
      ctx.fillStyle = xte > crossTrackWarning ? '#EF9F27' : '#9A9890';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`XTE ${xte.toFixed(2)} m`, 8, 16);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [planned, actual, current, crossTrackWarning, showDeviation, width, height]);

  return (
    <div
      className={['vt-component vt-pathplan', className].filter(Boolean).join(' ')}
      style={{ width, height, display: 'inline-block', background: 'var(--vt-bg-panel)', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label="Planned vs actual vehicle path"
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
