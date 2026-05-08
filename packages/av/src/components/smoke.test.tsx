import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  LiDARPointCloud,
  OccupancyGrid,
  ObjectDetectionOverlay,
  PathPlannerOverlay,
  VelocityVectorDisplay,
  PerceptionStateMachine,
  SensorHealthMatrix,
  CameraFeed,
  ControlTrace,
  RadarSweep,
  SLAMMap,
} from '../index';

function makeFakeCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    fillRect: noop, clearRect: noop, fillText: noop, strokeRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
    stroke: noop, fill: noop, arc: noop, save: noop, restore: noop,
    setTransform: noop, translate: noop, rotate: noop, clip: noop,
    setLineDash: noop, drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 0 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt',
    font: '', textAlign: 'left', textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.useFakeTimers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function getContext() {
    return makeFakeCtx();
  };
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('@altara/av components mount without errors', () => {
  // LiDARPointCloud lazy-imports three; in happy-dom it falls into the
  // `unavailable` placeholder branch (no WebGL). Either branch must mount.
  it('LiDARPointCloud (mockMode)', () => {
    expect(() => render(<LiDARPointCloud mockMode width={400} height={300} />)).not.toThrow();
  });
  it('OccupancyGrid (mockMode)', () => {
    expect(() => render(<OccupancyGrid mockMode width={300} height={300} />)).not.toThrow();
  });
  it('ObjectDetectionOverlay (mockMode)', () => {
    expect(() => render(<ObjectDetectionOverlay mockMode />)).not.toThrow();
  });
  it('PathPlannerOverlay (mockMode)', () => {
    expect(() => render(<PathPlannerOverlay mockMode />)).not.toThrow();
  });
  it('VelocityVectorDisplay (mockMode)', () => {
    expect(() => render(<VelocityVectorDisplay mockMode />)).not.toThrow();
  });
  it('PerceptionStateMachine (mockMode)', () => {
    expect(() => render(<PerceptionStateMachine mockMode />)).not.toThrow();
  });
  it('SensorHealthMatrix (mockMode)', () => {
    expect(() => render(<SensorHealthMatrix mockMode />)).not.toThrow();
  });
  it('CameraFeed (mockMode)', () => {
    expect(() => render(<CameraFeed mockMode />)).not.toThrow();
  });
  it('ControlTrace (mockMode)', () => {
    expect(() => render(<ControlTrace mockMode />)).not.toThrow();
  });
  it('RadarSweep (mockMode)', () => {
    expect(() => render(<RadarSweep mockMode />)).not.toThrow();
  });
  it('SLAMMap (mockMode)', () => {
    expect(() => render(<SLAMMap mockMode />)).not.toThrow();
  });
});

describe('static-prop rendering', () => {
  it('SensorHealthMatrix renders custom sensors', () => {
    const { getByRole } = render(
      <SensorHealthMatrix sensors={[{ name: 'GPS', topic: '/gps', expectedHz: 5, status: 'active' }]} />,
    );
    expect(getByRole('group').getAttribute('aria-label')).toContain('Sensor health matrix');
  });

  it('VelocityVectorDisplay reflects props in aria-label', () => {
    const { getByRole } = render(<VelocityVectorDisplay vx={5.5} vy={1.0} omega={0.3} />);
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('5.5');
    expect(label).toContain('1.0');
    expect(label).toContain('0.30');
  });
});
