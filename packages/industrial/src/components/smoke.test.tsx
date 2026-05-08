import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  WaterfallSpectrogram,
  PIDTuningPanel,
  OEEDashboard,
  AlarmAnnunciatorPanel,
  TrendRecorder,
  PIDNode,
  ProcessFlowDiagram,
  MotorDashboard,
  PredictiveMaintenanceGauge,
} from '../index';

function makeFakeCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const fakeImageData = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  return {
    fillRect: noop, clearRect: noop, fillText: noop, strokeRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
    stroke: noop, fill: noop, arc: noop, save: noop, restore: noop,
    setTransform: noop, translate: noop, rotate: noop, clip: noop,
    setLineDash: noop, drawImage: noop,
    createImageData: () => fakeImageData,
    putImageData: noop,
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

describe('@altara/industrial components mount without errors', () => {
  it('WaterfallSpectrogram (mockMode)', () => {
    expect(() => render(<WaterfallSpectrogram mockMode width={400} height={200} />)).not.toThrow();
  });
  it('PIDTuningPanel (mockMode)', () => {
    expect(() => render(<PIDTuningPanel mockMode />)).not.toThrow();
  });
  it('OEEDashboard (mockMode)', () => {
    expect(() => render(<OEEDashboard mockMode shift="A1" />)).not.toThrow();
  });
  it('AlarmAnnunciatorPanel (mockMode)', () => {
    expect(() => render(<AlarmAnnunciatorPanel mockMode />)).not.toThrow();
  });
  it('TrendRecorder (mockMode)', () => {
    expect(() => render(<TrendRecorder mockMode />)).not.toThrow();
  });
  it('PIDNode (static)', () => {
    expect(() => render(<PIDNode firstLetter="F" functionLetters="IC" value={42.3} unit="m³/h" />)).not.toThrow();
  });
  it('ProcessFlowDiagram (mockMode)', () => {
    expect(() => render(<ProcessFlowDiagram mockMode />)).not.toThrow();
  });
  it('MotorDashboard (mockMode)', () => {
    expect(() => render(<MotorDashboard mockMode />)).not.toThrow();
  });
  it('PredictiveMaintenanceGauge (mockMode)', () => {
    expect(() => render(<PredictiveMaintenanceGauge mockMode />)).not.toThrow();
  });
});

describe('static-prop rendering', () => {
  it('OEEDashboard reflects props in aria-label', () => {
    const { getByRole } = render(<OEEDashboard availability={0.9} performance={0.8} quality={0.95} />);
    const label = getByRole('group').getAttribute('aria-label') ?? '';
    expect(label).toContain('OEE dashboard');
    expect(label).toMatch(/68\.4|68\.40/);
  });

  it('PIDNode renders label letters', () => {
    const { getByRole } = render(<PIDNode firstLetter="F" functionLetters="IC" status="warning" />);
    expect(getByRole('img').getAttribute('aria-label')).toContain('FIC');
    expect(getByRole('img').getAttribute('aria-label')).toContain('warning');
  });
});
