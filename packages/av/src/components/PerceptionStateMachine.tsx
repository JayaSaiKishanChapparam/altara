import { useEffect, useState } from 'react';
import type { PerceptionStateMachineProps, PerceptionModule } from '../types';

const STATUS_COLOR = {
  active: 'var(--vt-color-active)',
  stale: 'var(--vt-color-warn)',
  error: 'var(--vt-color-danger)',
  off: 'var(--vt-text-muted)',
} as const;

const DEFAULT_LAYOUT = [
  { name: 'Localization', col: 0, row: 0 },
  { name: 'Lidar Detection', col: 1, row: 0 },
  { name: 'Camera Detection', col: 1, row: 1 },
  { name: 'Sensor Fusion', col: 2, row: 0 },
  { name: 'Tracking', col: 3, row: 0 },
  { name: 'Prediction', col: 4, row: 0 },
  { name: 'Planning', col: 5, row: 0 },
];

const MOCK_SEQUENCE: PerceptionModule[][] = [
  [
    { name: 'Localization', status: 'active', latencyMs: 12, topic: '/loc' },
    { name: 'Lidar Detection', status: 'active', latencyMs: 32, topic: '/lidar/det' },
    { name: 'Camera Detection', status: 'active', latencyMs: 48, topic: '/cam/det' },
    { name: 'Sensor Fusion', status: 'active', latencyMs: 10, topic: '/fusion' },
    { name: 'Tracking', status: 'active', latencyMs: 8, topic: '/track' },
    { name: 'Prediction', status: 'active', latencyMs: 22, topic: '/pred' },
    { name: 'Planning', status: 'active', latencyMs: 18, topic: '/plan' },
  ],
  [
    { name: 'Localization', status: 'active', latencyMs: 14, topic: '/loc' },
    { name: 'Lidar Detection', status: 'active', latencyMs: 35, topic: '/lidar/det' },
    { name: 'Camera Detection', status: 'stale', latencyMs: 220, topic: '/cam/det' },
    { name: 'Sensor Fusion', status: 'active', latencyMs: 11, topic: '/fusion' },
    { name: 'Tracking', status: 'active', latencyMs: 9, topic: '/track' },
    { name: 'Prediction', status: 'active', latencyMs: 24, topic: '/pred' },
    { name: 'Planning', status: 'active', latencyMs: 20, topic: '/plan' },
  ],
  [
    { name: 'Localization', status: 'active', latencyMs: 13, topic: '/loc' },
    { name: 'Lidar Detection', status: 'error', topic: '/lidar/det' },
    { name: 'Camera Detection', status: 'active', latencyMs: 42, topic: '/cam/det' },
    { name: 'Sensor Fusion', status: 'stale', latencyMs: 180, topic: '/fusion' },
    { name: 'Tracking', status: 'stale', latencyMs: 200, topic: '/track' },
    { name: 'Prediction', status: 'off', topic: '/pred' },
    { name: 'Planning', status: 'off', topic: '/plan' },
  ],
];

/**
 * Perception-pipeline state machine. Each module is a node; arrows
 * follow the perception data-flow. Status drives node color (active /
 * stale / error / off) and a per-node latency readout.
 */
export function PerceptionStateMachine({
  modules: modulesProp,
  staleness: _staleness = 500,
  mockMode,
  className,
}: PerceptionStateMachineProps) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => setStep((n) => (n + 1) % MOCK_SEQUENCE.length), 2200);
    return () => clearInterval(id);
  }, [mockMode]);

  const modules: PerceptionModule[] = mockMode ? MOCK_SEQUENCE[step]! : modulesProp ?? [];
  const layoutByName: Record<string, { col: number; row: number }> = {};
  DEFAULT_LAYOUT.forEach((l) => { layoutByName[l.name] = { col: l.col, row: l.row }; });

  // Edges in the default flow
  const EDGES: [string, string][] = [
    ['Localization', 'Sensor Fusion'],
    ['Lidar Detection', 'Sensor Fusion'],
    ['Camera Detection', 'Sensor Fusion'],
    ['Sensor Fusion', 'Tracking'],
    ['Tracking', 'Prediction'],
    ['Prediction', 'Planning'],
  ];

  const W = 720;
  const H = 240;
  const cellW = W / 6;
  const cellH = H / 2;
  const nodeW = 110;
  const nodeH = 56;

  function nodeXY(name: string) {
    const layout = layoutByName[name];
    if (!layout) return { x: 0, y: 0 };
    const x = layout.col * cellW + (cellW - nodeW) / 2;
    const y = layout.row * cellH + (cellH - nodeH) / 2;
    return { x, y };
  }

  return (
    <div
      className={['vt-component vt-perception', className].filter(Boolean).join(' ')}
      style={{ width: W, height: H, display: 'inline-block', background: 'var(--vt-bg-panel)', border: '1px solid var(--vt-border)', borderRadius: 6 }}
      role="img"
      aria-label="Perception pipeline state machine"
    >
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <defs>
          <marker id="psm-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--vt-text-muted)" />
          </marker>
        </defs>
        {/* Edges */}
        {EDGES.map(([from, to], i) => {
          const a = nodeXY(from);
          const b = nodeXY(to);
          const x1 = a.x + nodeW;
          const y1 = a.y + nodeH / 2;
          const x2 = b.x;
          const y2 = b.y + nodeH / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 4} ${y2}`}
              fill="none"
              stroke="var(--vt-text-muted)"
              strokeWidth={1.5}
              markerEnd="url(#psm-arrow)"
            />
          );
        })}
        {/* Nodes */}
        {DEFAULT_LAYOUT.map((l) => {
          const m = modules.find((mm) => mm.name === l.name);
          const status = m?.status ?? 'off';
          const color = STATUS_COLOR[status];
          const { x, y } = nodeXY(l.name);
          return (
            <g key={l.name}>
              <rect
                x={x}
                y={y}
                width={nodeW}
                height={nodeH}
                rx={6}
                fill="var(--vt-bg-elevated)"
                stroke={color}
                strokeWidth={1.5}
              />
              <text x={x + nodeW / 2} y={y + 18} textAnchor="middle" fill="var(--vt-text-primary)" fontSize={11} fontFamily="sans-serif" fontWeight={600}>
                {l.name}
              </text>
              <text x={x + nodeW / 2} y={y + 36} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace" style={{ textTransform: 'uppercase' }}>
                {status}
              </text>
              {m?.latencyMs !== undefined && (
                <text x={x + nodeW / 2} y={y + 49} textAnchor="middle" fill="var(--vt-text-muted)" fontSize={9} fontFamily="monospace">
                  {m.latencyMs} ms
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
