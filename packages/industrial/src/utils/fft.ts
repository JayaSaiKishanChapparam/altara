/**
 * Iterative radix-2 Cooley-Tukey FFT. Operates in-place on two parallel
 * Float32Arrays (real, imag). Throws if `n` is not a power of two.
 *
 * For very large FFTs (≥4096) at high cadences, you'd typically push
 * this into a Web Worker — see `createWorkerDataSource` from
 * @altara/core. This implementation is fine for ≤2048 at 30 Hz.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n !== imag.length) throw new Error('fft: real/imag length mismatch');
  if (n & (n - 1)) throw new Error('fft: length must be a power of two');
  if (n <= 1) return;

  // Bit-reverse permutation.
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i]!; real[i] = real[j]!; real[j] = tr;
      const ti = imag[i]!; imag[i] = imag[j]!; imag[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }

  // Butterfly.
  for (let size = 2; size <= n; size <<= 1) {
    const halfsize = size >> 1;
    const tableStep = (-2 * Math.PI) / size;
    for (let block = 0; block < n; block += size) {
      for (let k = 0; k < halfsize; k++) {
        const angle = tableStep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const i = block + k;
        const ipair = i + halfsize;
        const tr = real[ipair]! * wr - imag[ipair]! * wi;
        const ti = real[ipair]! * wi + imag[ipair]! * wr;
        real[ipair] = real[i]! - tr; imag[ipair] = imag[i]! - ti;
        real[i] = real[i]! + tr; imag[i] = imag[i]! + ti;
      }
    }
  }
}

/** Hann window — reduces spectral leakage. */
export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/**
 * Convert a real-valued frame into magnitude (dB) bins. `windowed`
 * pre-allocated to length n; reused across calls to avoid GC churn.
 */
export function magnitudeDb(
  frame: Float32Array,
  window: Float32Array,
  windowed: Float32Array,
  imag: Float32Array,
  out: Float32Array,
): void {
  const n = frame.length;
  for (let i = 0; i < n; i++) {
    windowed[i] = frame[i]! * window[i]!;
    imag[i] = 0;
  }
  fft(windowed, imag);
  const half = n >> 1;
  // Magnitude in dB; reference = 1.0
  for (let i = 0; i < half; i++) {
    const mag = Math.sqrt(windowed[i]! * windowed[i]! + imag[i]! * imag[i]!) / n;
    out[i] = 20 * Math.log10(Math.max(1e-10, mag));
  }
}
