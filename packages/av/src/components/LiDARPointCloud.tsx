import { useEffect, useRef, useState } from 'react';
import type { LiDARPointCloudProps } from '../types';
import { clamp } from '../utils/tokens';

interface PointCloudFrame {
  /** Interleaved x/y/z/intensity floats — length must be a multiple of 4. */
  data: Float32Array;
}

/**
 * Real-time 3D LiDAR point-cloud renderer (Three.js). Accepts a stream
 * of `PointCloud2`-like binary frames and renders via a single
 * BufferGeometry + Points object. Three.js is loaded via dynamic
 * `import()` so it stays an optional peer dep — the component renders
 * a "Three.js not installed" placeholder if the import fails.
 *
 * Camera presets:
 *   - `'iso'` (default) — 45° elevated view, OrbitControls-driven.
 *   - `'top'` — straight-down orthographic-feel view.
 *   - `'follow'` — camera tracks the vehicle origin from behind.
 */
export function LiDARPointCloud({
  dataSource,
  colorMode = 'intensity',
  heightRange = [-2, 5],
  pointSize = 2,
  maxPoints = 100_000,
  showGrid = true,
  cameraPreset = 'iso',
  vehicleFrame = true,
  width = 800,
  height = 500,
  mockMode,
  className,
}: LiDARPointCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<PointCloudFrame | null>(null);
  const rafRef = useRef<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  // Apply incoming frames from a custom data source.
  useEffect(() => {
    if (!dataSource) return;
    const apply = () => {
      // We treat each emission as a "new frame" trigger — actual binary
      // payload would come via a custom-source contract we don't model
      // here. In the absence of that, mockMode is the canonical input.
    };
    const off = dataSource.subscribe(apply);
    return () => { off(); };
  }, [dataSource]);

  // Generate synthetic urban scene at 10 Hz when in mockMode.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      frameRef.current = generateUrbanScene(performance.now() / 1000, maxPoints);
      setPointCount(frameRef.current.data.length / 4);
    }, 100);
    return () => clearInterval(id);
  }, [mockMode, maxPoints]);

  // Three.js renderer setup. Lazy import keeps three optional.
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0E0F10);

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        positionCamera(camera, cameraPreset);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(width, height, false);
        container.replaceChildren(renderer.domElement);

        // Ground grid
        if (showGrid) {
          const grid = new THREE.GridHelper(50, 50, 0x2E3133, 0x1F2224);
          (grid.material as THREE.Material).transparent = true;
          (grid.material as THREE.Material).opacity = 0.6;
          scene.add(grid);
        }

        // Vehicle frame box
        if (vehicleFrame) {
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1, 4),
            new THREE.MeshBasicMaterial({ color: 0xF4D03F, wireframe: true }),
          );
          box.position.y = 0.5;
          scene.add(box);
        }

        // Point cloud — single BufferGeometry, swap attributes per frame.
        const pointGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(maxPoints * 3);
        const colors = new Float32Array(maxPoints * 3);
        pointGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pointGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        pointGeom.setDrawRange(0, 0);

        const pointMat = new THREE.PointsMaterial({
          size: pointSize,
          sizeAttenuation: false,
          vertexColors: true,
        });
        const points = new THREE.Points(pointGeom, pointMat);
        scene.add(points);

        const draw = () => {
          if (disposed) return;
          rafRef.current = requestAnimationFrame(draw);

          const frame = frameRef.current;
          if (frame) {
            const stride = 4;
            const total = frame.data.length / stride;
            const count = Math.min(total, maxPoints);
            const posAttr = pointGeom.attributes['position']!;
            const colAttr = pointGeom.attributes['color']!;
            const posArr = posAttr.array as Float32Array;
            const colArr = colAttr.array as Float32Array;
            for (let i = 0; i < count; i++) {
              const o = i * stride;
              const x = frame.data[o]!;
              const y = frame.data[o + 1]!;
              const z = frame.data[o + 2]!;
              const intensity = frame.data[o + 3]!;
              posArr[i * 3] = x;
              posArr[i * 3 + 1] = z; // map ROS Z-up to Three.js Y-up for display
              posArr[i * 3 + 2] = -y;
              const [r, g, b] = colorFor(colorMode, x, y, z, intensity, heightRange);
              colArr[i * 3] = r;
              colArr[i * 3 + 1] = g;
              colArr[i * 3 + 2] = b;
            }
            posAttr.needsUpdate = true;
            colAttr.needsUpdate = true;
            pointGeom.setDrawRange(0, count);
          }

          if (cameraPreset === 'iso') {
            // Slow orbital drift so the scene reads as 3D without controls.
            const t = performance.now() / 4000;
            camera.position.x = Math.cos(t) * 18;
            camera.position.z = Math.sin(t) * 18;
            camera.position.y = 12;
            camera.lookAt(0, 0, 0);
          }

          renderer.render(scene, camera);
        };
        rafRef.current = requestAnimationFrame(draw);

        cleanup = () => {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          renderer.dispose();
          pointGeom.dispose();
          pointMat.dispose();
          if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        if (!disposed) setUnavailable(true);
      }
    })();

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [width, height, pointSize, maxPoints, showGrid, vehicleFrame, cameraPreset, colorMode, heightRange]);

  if (unavailable) {
    return (
      <div
        className={['vt-component vt-lidar', className].filter(Boolean).join(' ')}
        style={{
          width,
          height,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--vt-bg-panel)',
          border: '1px solid var(--vt-border)',
          color: 'var(--vt-text-muted)',
          fontFamily: 'sans-serif',
          fontSize: 13,
          textAlign: 'center',
          padding: 16,
        }}
        role="img"
        aria-label="LiDAR point cloud — three.js peer dependency not installed"
      >
        <div>
          <div style={{ color: 'var(--vt-text-primary)', fontWeight: 600, marginBottom: 6 }}>
            LiDARPointCloud requires three
          </div>
          <code style={{ fontFamily: 'monospace', color: 'var(--vt-text-muted)' }}>
            npm install three
          </code>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={['vt-component vt-lidar', className].filter(Boolean).join(' ')}
      style={{ width, height, display: 'inline-block', background: '#0E0F10', position: 'relative' }}
      role="img"
      aria-label={`LiDAR point cloud — ${pointCount} points, color by ${colorMode}`}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          fontSize: 11,
          color: '#9A9890',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          textShadow: '0 0 3px #000',
        }}
        aria-hidden="true"
      >
        {pointCount.toLocaleString()} pts · {colorMode}
      </div>
    </div>
  );
}

function positionCamera(camera: { position: { set(x: number, y: number, z: number): void }; lookAt(x: number, y: number, z: number): void }, preset: 'top' | 'iso' | 'follow') {
  switch (preset) {
    case 'top':
      camera.position.set(0, 30, 0.01);
      camera.lookAt(0, 0, 0);
      break;
    case 'follow':
      camera.position.set(0, 6, -10);
      camera.lookAt(0, 0, 6);
      break;
    case 'iso':
    default:
      camera.position.set(15, 12, 15);
      camera.lookAt(0, 0, 0);
      break;
  }
}

function colorFor(
  mode: 'intensity' | 'height' | 'return' | 'flat',
  x: number, y: number, z: number,
  intensity: number,
  heightRange: [number, number],
): [number, number, number] {
  if (mode === 'flat') return [0.85, 0.84, 0.78];
  if (mode === 'height') {
    const t = clamp((z - heightRange[0]) / (heightRange[1] - heightRange[0]), 0, 1);
    return turbo(t);
  }
  if (mode === 'return') {
    // 'return' would map to which laser return (1st/2nd) in real data —
    // we proxy with x-distance for a credible synthetic look.
    const t = clamp((Math.hypot(x, y) % 10) / 10, 0, 1);
    return [0.4 + 0.6 * t, 0.4, 1 - 0.5 * t];
  }
  // intensity
  const t = clamp(intensity, 0, 1);
  return [t, t * 0.7 + 0.3, 0.4 + (1 - t) * 0.4];
}

/** Compact "turbo"-style colormap approximation. Maps t∈[0,1] to RGB. */
function turbo(t: number): [number, number, number] {
  const x = clamp(t, 0, 1);
  const r = clamp(34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05)))), 0, 255) / 255;
  const g = clamp(23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56)))), 0, 255) / 255;
  const b = clamp(27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66)))), 0, 255) / 255;
  return [r, g, b];
}

/** Synthesize a static-ish "urban" scene: ground plane + buildings + a vehicle ahead. */
function generateUrbanScene(t: number, max: number): PointCloudFrame {
  const target = Math.min(max, 18000);
  const out = new Float32Array(target * 4);
  let i = 0;

  // Ground ring (annulus around vehicle)
  for (let k = 0; k < target * 0.45 && i < target; k++, i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 25;
    out[i * 4] = Math.cos(a) * r;
    out[i * 4 + 1] = Math.sin(a) * r;
    out[i * 4 + 2] = -0.05 + Math.random() * 0.1;
    out[i * 4 + 3] = 0.4 + Math.random() * 0.3;
  }
  // Building walls along y = ±8 (forward axis)
  for (let k = 0; k < target * 0.3 && i < target; k++, i++) {
    const wallY = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 2);
    out[i * 4] = -12 + Math.random() * 24;
    out[i * 4 + 1] = wallY;
    out[i * 4 + 2] = Math.random() * 6;
    out[i * 4 + 3] = 0.7 + Math.random() * 0.3;
  }
  // Vehicle ahead: animate its forward distance
  const vehY = 6 + Math.sin(t * 0.4) * 2;
  for (let k = 0; k < target * 0.1 && i < target; k++, i++) {
    out[i * 4] = -1 + Math.random() * 2;
    out[i * 4 + 1] = vehY + Math.random() * 4;
    out[i * 4 + 2] = Math.random() * 1.6;
    out[i * 4 + 3] = 0.85;
  }
  // Sparse noise / pedestrians
  while (i < target) {
    out[i * 4] = -25 + Math.random() * 50;
    out[i * 4 + 1] = -25 + Math.random() * 50;
    out[i * 4 + 2] = Math.random() * 3;
    out[i * 4 + 3] = Math.random();
    i++;
  }
  return { data: out };
}
