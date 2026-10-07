/**
 * The cases the pixel test renders, shared by the page (`fixture.tsx`) and the
 * runner (`run.mjs`, which loads this file through esbuild).
 *
 * Every case is above one sample per pixel column, so the chart draws in
 * min/max bucket mode, the mode that rendered blank in #39. Plot widths: 792 px
 * for TimeSeries, 752 px for MultiAxisPlot.
 */
export const WINDOW_MS = 30_000;
/** Used by nothing else on the page, so line pixels can be told apart from axes and labels. */
export const LINE_COLOR = '#ff00ff';

export type Kind = 'flat' | 'spike' | 'sine';

export interface PixelCase {
  id: string;
  chart: 'TimeSeries' | 'MultiAxisPlot';
  path: 'local' | 'worker';
  kind: Kind;
  /** Samples in the window. 10 000 is ~12 per column; 900 is ~1.1–1.2. */
  n: number;
}

const SHAPES: Array<{ kind: Kind; n: number; label: string }> = [
  { kind: 'flat', n: 10_000, label: 'flat-dense' },
  { kind: 'spike', n: 10_000, label: 'spike-dense' },
  { kind: 'spike', n: 900, label: 'spike-sparse' },
  { kind: 'sine', n: 10_000, label: 'sine-dense' },
  { kind: 'sine', n: 900, label: 'sine-sparse' },
];

export const CASES: PixelCase[] = (['TimeSeries', 'MultiAxisPlot'] as const).flatMap((chart) =>
  (['local', 'worker'] as const).flatMap((path) =>
    SHAPES.map(({ kind, n, label }) => ({
      id: `${chart === 'TimeSeries' ? 'ts' : 'map'}-${path}-${label}`,
      chart,
      path,
      kind,
      n,
    })),
  ),
);
