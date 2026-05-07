import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  PrimaryFlightDisplay,
  HorizontalSituationIndicator,
  Altimeter,
  VerticalSpeedIndicator,
  AirspeedIndicator,
  EngineInstrumentCluster,
  RadioAltimeter,
  TerrainAwareness,
  TCASDisplay,
  AutopilotModeAnnunciator,
  FuelGauge,
} from '../index';

// Stub canvas API for happy-dom — Altara components paint to it.
function makeFakeCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    save: noop,
    restore: noop,
    setTransform: noop,
    translate: noop,
    rotate: noop,
    clip: noop,
    measureText: () => ({ width: 0 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
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

describe('aerospace components mount without errors', () => {
  it('PrimaryFlightDisplay (mockMode)', () => {
    expect(() => render(<PrimaryFlightDisplay mockMode />)).not.toThrow();
  });
  it('HorizontalSituationIndicator (mockMode)', () => {
    expect(() => render(<HorizontalSituationIndicator mockMode />)).not.toThrow();
  });
  it('Altimeter (mockMode)', () => {
    expect(() => render(<Altimeter mockMode />)).not.toThrow();
  });
  it('VerticalSpeedIndicator (mockMode)', () => {
    expect(() => render(<VerticalSpeedIndicator mockMode />)).not.toThrow();
  });
  it('AirspeedIndicator (mockMode)', () => {
    expect(() => render(<AirspeedIndicator mockMode />)).not.toThrow();
  });
  it('EngineInstrumentCluster (mockMode)', () => {
    expect(() => render(<EngineInstrumentCluster mockMode engineCount={2} />)).not.toThrow();
  });
  it('RadioAltimeter (mockMode)', () => {
    expect(() => render(<RadioAltimeter mockMode decisionHeight={200} />)).not.toThrow();
  });
  it('TerrainAwareness (mockMode)', () => {
    expect(() => render(<TerrainAwareness mockMode />)).not.toThrow();
  });
  it('TCASDisplay (mockMode)', () => {
    expect(() => render(<TCASDisplay mockMode />)).not.toThrow();
  });
  it('AutopilotModeAnnunciator (mockMode)', () => {
    expect(() => render(<AutopilotModeAnnunciator mockMode />)).not.toThrow();
  });
  it('FuelGauge (mockMode)', () => {
    expect(() => render(<FuelGauge mockMode />)).not.toThrow();
  });
});

describe('static-prop rendering', () => {
  it('PFD renders an aria-label with the live readout', () => {
    const { getByRole } = render(
      <PrimaryFlightDisplay roll={-5} pitch={2} heading={120} airspeed={140} altitude={5500} vs={300} />,
    );
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/heading 120/);
    expect(label).toMatch(/140 kt/);
    expect(label).toMatch(/5500 ft/);
  });

  it('FuelGauge totalises tank quantities', () => {
    const { getByRole } = render(
      <FuelGauge tanks={[
        { id: 'L', label: 'L', quantity: 10, capacity: 50 },
        { id: 'R', label: 'R', quantity: 30, capacity: 50 },
      ]} />,
    );
    expect(getByRole('group').getAttribute('aria-label')).toContain('40.0');
  });
});
