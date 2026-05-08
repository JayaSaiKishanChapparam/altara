import { useEffect, useState } from 'react';
import type { ProcessFlowDiagramProps, PFDNode, PFDEdge, PFDNodeType } from '../types';

const NODE_W = 80;
const NODE_H = 56;

const DEFAULT_NODES: PFDNode[] = [
  { id: 'tank1', type: 'tank', x: 30, y: 60, label: 'TK-101' },
  { id: 'pump1', type: 'pump', x: 200, y: 80, label: 'P-101' },
  { id: 'valve1', type: 'valve', x: 360, y: 80, label: 'FV-101' },
  { id: 'hx1', type: 'heat-exchanger', x: 510, y: 60, label: 'E-101' },
  { id: 'tank2', type: 'tank', x: 700, y: 60, label: 'TK-102' },
  { id: 'fic1', type: 'instrument', x: 270, y: 200, label: 'FIC-101' },
];

const DEFAULT_EDGES: PFDEdge[] = [
  { from: 'tank1', to: 'pump1', active: true },
  { from: 'pump1', to: 'valve1', active: true },
  { from: 'valve1', to: 'hx1', active: true },
  { from: 'hx1', to: 'tank2', active: true },
  { from: 'fic1', to: 'valve1' },
];

/**
 * Composable process-flow diagram. Tanks, pumps, heat exchangers,
 * valves, and instrument bubbles are rendered as standard SVG
 * primitives connected by orthogonal flow paths. Live values per node
 * update via the `values` prop.
 */
export function ProcessFlowDiagram({
  nodes: nodesProp,
  edges: edgesProp,
  values: valuesProp,
  width = 820,
  height = 320,
  interactive: _interactive = false,
  mockMode,
  className,
}: ProcessFlowDiagramProps) {
  const nodes = nodesProp ?? (mockMode ? DEFAULT_NODES : []);
  const edges = edgesProp ?? (mockMode ? DEFAULT_EDGES : []);
  const [values, setValues] = useState(valuesProp ?? {});

  useEffect(() => { if (valuesProp) setValues(valuesProp); }, [valuesProp]);

  // mockMode: oscillating tank levels + flow rates.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      setValues({
        tank1: 70 + Math.sin(t * 0.18) * 12,
        tank2: 35 + Math.sin(t * 0.18 + Math.PI) * 12,
        pump1: 24 + Math.sin(t * 0.5) * 1.5,
        valve1: 45 + Math.sin(t * 0.3) * 8,
        hx1: 92 + Math.sin(t * 0.2) * 4,
        fic1: 24 + Math.sin(t * 0.5) * 1.5,
      });
    }, 200);
    return () => clearInterval(id);
  }, [mockMode]);

  return (
    <div
      className={['vt-component vt-pfd', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        width, height,
        background: 'var(--vt-bg-panel)',
        border: '1px solid var(--vt-border)',
        borderRadius: 6,
      }}
      role="img"
      aria-label={`Process flow diagram — ${nodes.length} nodes, ${edges.length} pipes`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <defs>
          <marker id="pfd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--vt-color-active)" />
          </marker>
          <marker id="pfd-arrow-idle" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--vt-text-muted)" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const f = nodes.find((n) => n.id === e.from);
          const t = nodes.find((n) => n.id === e.to);
          if (!f || !t) return null;
          const x1 = f.x + NODE_W / 2;
          const y1 = f.y + NODE_H / 2;
          const x2 = t.x + NODE_W / 2;
          const y2 = t.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const stroke = e.active ? 'var(--vt-color-active)' : 'var(--vt-text-muted)';
          const marker = e.active ? 'url(#pfd-arrow)' : 'url(#pfd-arrow-idle)';
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 6} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              markerEnd={marker}
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            {renderShape(n.type)}
            {n.label && (
              <text
                x={NODE_W / 2}
                y={NODE_H + 12}
                textAnchor="middle"
                fill="var(--vt-text-muted)"
                fontSize={10}
                fontFamily="monospace"
              >
                {n.label}
              </text>
            )}
            {values[n.id] !== undefined && (
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 4}
                textAnchor="middle"
                fill="var(--vt-text-primary)"
                fontSize={12}
                fontFamily="monospace"
                fontWeight={600}
              >
                {values[n.id]!.toFixed(1)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function renderShape(type: PFDNodeType) {
  switch (type) {
    case 'tank':
      return (
        <>
          <rect x={6} y={4} width={NODE_W - 12} height={NODE_H - 8} fill="var(--vt-bg-elevated)" stroke="var(--vt-text-primary)" strokeWidth={1.5} rx={6} />
          <ellipse cx={NODE_W / 2} cy={6} rx={(NODE_W - 12) / 2} ry={4} fill="var(--vt-bg-elevated)" stroke="var(--vt-text-primary)" strokeWidth={1.5} />
        </>
      );
    case 'pump':
      return (
        <>
          <circle cx={NODE_W / 2} cy={NODE_H / 2} r={20} fill="var(--vt-bg-elevated)" stroke="var(--vt-text-primary)" strokeWidth={1.5} />
          <polygon
            points={`${NODE_W / 2 - 14},${NODE_H / 2 + 8} ${NODE_W / 2 + 14},${NODE_H / 2 + 8} ${NODE_W / 2},${NODE_H / 2 - 14}`}
            fill="none" stroke="var(--vt-text-primary)" strokeWidth={1.5}
          />
        </>
      );
    case 'valve':
      // Bowtie
      return (
        <polygon
          points={`8,${NODE_H / 2 - 14} 8,${NODE_H / 2 + 14} ${NODE_W - 8},${NODE_H / 2 - 14} ${NODE_W - 8},${NODE_H / 2 + 14}`}
          fill="var(--vt-bg-elevated)" stroke="var(--vt-text-primary)" strokeWidth={1.5}
        />
      );
    case 'heat-exchanger':
      return (
        <>
          <rect x={6} y={6} width={NODE_W - 12} height={NODE_H - 12} fill="var(--vt-bg-elevated)" stroke="var(--vt-text-primary)" strokeWidth={1.5} rx={4} />
          <line x1={6} y1={NODE_H / 2 - 8} x2={NODE_W - 6} y2={NODE_H / 2 - 8} stroke="var(--vt-text-primary)" />
          <line x1={6} y1={NODE_H / 2 + 8} x2={NODE_W - 6} y2={NODE_H / 2 + 8} stroke="var(--vt-text-primary)" />
        </>
      );
    case 'instrument':
    default:
      return (
        <circle cx={NODE_W / 2} cy={NODE_H / 2} r={18} fill="var(--vt-bg-elevated)" stroke="var(--vt-color-active)" strokeWidth={2} />
      );
  }
}
