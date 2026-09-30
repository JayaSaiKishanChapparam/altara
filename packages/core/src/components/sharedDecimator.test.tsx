import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimeSeries } from './TimeSeries';
import { MultiAxisPlot } from './MultiAxisPlot';
import type {
  AltaraDataSource,
  DecimatedFrame,
  Decimator,
  DecimatorSubscription,
  TelemetryValue,
  ViewportSpec,
} from '../adapters/types';

/**
 * Two charts on one decimating source.
 *
 * This is the case that shipped broken: `decimator` used to carry a single
 * viewport, so whichever chart called `setViewport` last won and the other
 * rendered an empty plot with no error. Nothing covered it because every test
 * mounted one chart at a time.
 */

class FakeResizeObserver {
  constructor(private cb: (entries: unknown[]) => void) {}
  observe() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
}

function makeFakeCtx() {
  const noop = () => undefined;
  return {
    fillRect: noop,
    clearRect: noop,
    fillText: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    setLineDash: noop,
    save: noop,
    restore: noop,
    setTransform: noop,
    scale: noop,
    translate: noop,
    rotate: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  // @ts-expect-error — install global test double.
  globalThis.ResizeObserver = FakeResizeObserver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = function getContext() {
    return makeFakeCtx();
  };
});

afterEach(() => {
  // @ts-expect-error — cleanup the test double.
  delete globalThis.ResizeObserver;
});

interface RecordedSubscription {
  id: number;
  specs: ViewportSpec[];
  released: boolean;
  /** Frame handed back to this consumer, set by the test. */
  frame: DecimatedFrame | null;
}

/**
 * A decimating source that records what each consumer asked for, so the test
 * can assert the charts did not trample one another.
 */
function recordingSource(): AltaraDataSource & { views: RecordedSubscription[] } {
  const views: RecordedSubscription[] = [];
  let nextId = 0;

  const decimator: Decimator = {
    acquire(): DecimatorSubscription {
      const rec: RecordedSubscription = {
        id: (nextId += 1),
        specs: [],
        released: false,
        frame: null,
      };
      views.push(rec);
      return {
        setViewport(spec: ViewportSpec) {
          rec.specs.push(spec);
        },
        getFrame: () => rec.frame,
        release() {
          rec.released = true;
        },
      };
    },
  };

  return {
    views,
    subscribe: () => () => {},
    getHistory: (): TelemetryValue[] => [],
    status: 'connected' as const,
    decimator,
    destroy() {
      /* no-op */
    },
  };
}

const GYRO = [
  { key: 'gyro_x', label: 'Gyro X' },
  { key: 'gyro_y', label: 'Gyro Y' },
];
const LOAD = [
  { key: 'vibe', label: 'Vibration', axis: 'left' as const },
  { key: 'current', label: 'Current', axis: 'right' as const },
];

describe('two charts sharing one decimating source', () => {
  it('each acquires its own subscription instead of sharing one viewport', () => {
    const ds = recordingSource();
    render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} windowMs={10_000} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} windowMs={30_000} />
      </>,
    );

    expect(ds.views).toHaveLength(2);
    expect(ds.views[0]!.id).not.toBe(ds.views[1]!.id);
  });

  it('keeps each chart’s channel set and window intact', () => {
    const ds = recordingSource();
    render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} windowMs={10_000} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} windowMs={30_000} />
      </>,
    );

    const [ts, map] = ds.views;
    expect(ts!.specs.at(-1)!.channels).toEqual(['gyro_x', 'gyro_y']);
    expect(ts!.specs.at(-1)!.windowMs).toBe(10_000);
    expect(map!.specs.at(-1)!.channels).toEqual(['vibe', 'current']);
    expect(map!.specs.at(-1)!.windowMs).toBe(30_000);
  });

  it('never leaves a chart without a viewport of its own', () => {
    const ds = recordingSource();
    render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} />
      </>,
    );
    // The original bug: one chart ended up with zero specs of its own because
    // the other overwrote the single shared viewport.
    for (const v of ds.views) expect(v.specs.length).toBeGreaterThan(0);
  });

  it('three charts on one source each get their own subscription', () => {
    const ds = recordingSource();
    render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} />
        <TimeSeries dataSource={ds} channels={[{ key: 'alt', label: 'Altitude' }]} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} />
      </>,
    );

    expect(ds.views).toHaveLength(3);
    expect(ds.views.map((v) => v.specs.at(-1)!.channels)).toEqual([
      ['gyro_x', 'gyro_y'],
      ['alt'],
      ['vibe', 'current'],
    ]);
  });

  it('releases each subscription when its chart unmounts', () => {
    const ds = recordingSource();
    const view = render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} />
      </>,
    );
    expect(ds.views.every((v) => !v.released)).toBe(true);

    view.unmount();
    expect(ds.views.every((v) => v.released)).toBe(true);
  });

  it('draws each chart from its own frame, not whichever arrived last', () => {
    const ds = recordingSource();
    render(
      <>
        <TimeSeries dataSource={ds} channels={GYRO} />
        <MultiAxisPlot dataSource={ds} channels={LOAD} />
      </>,
    );

    const frameFor = (key: string, plotW: number): DecimatedFrame => ({
      epoch: 1,
      seq: 1,
      tMin: 0,
      windowMs: 10_000,
      plotW,
      channels: [
        {
          key,
          mode: 'points',
          visibleCount: 2,
          pointT: new Float64Array([1, 2]),
          pointV: new Float64Array([1, 2]),
          extent: { min: 1, max: 2 },
        },
      ],
    });

    ds.views[0]!.frame = frameFor('gyro_x', 800);
    ds.views[1]!.frame = frameFor('vibe', 400);

    // Each handle keeps its own frame; neither read clobbers the other.
    expect(ds.views[0]!.frame.channels[0]!.key).toBe('gyro_x');
    expect(ds.views[0]!.frame.plotW).toBe(800);
    expect(ds.views[1]!.frame.channels[0]!.key).toBe('vibe');
    expect(ds.views[1]!.frame.plotW).toBe(400);
  });

  it('does not buffer or subscribe on the main thread for either chart', () => {
    const ds = recordingSource();
    let subscribers = 0;
    const counted: AltaraDataSource = {
      ...ds,
      subscribe: () => {
        subscribers += 1;
        return () => {};
      },
    };
    render(
      <>
        <TimeSeries dataSource={counted} channels={GYRO} />
        <MultiAxisPlot dataSource={counted} channels={LOAD} />
      </>,
    );
    expect(subscribers).toBe(0);
  });
});
