/**
 * The synthetic quadrotor telemetry model, shared by two very different hosts:
 *
 *  - `scripts/telemetry-server.mjs`, which streams it over a real WebSocket for
 *    local development.
 *  - `src/telemetry/simulatedWorker.ts`, which runs it *inside* the library's
 *    own Web Worker when no server is reachable, so a statically hosted build
 *    still exercises the real pipeline.
 *
 * Plain JavaScript on purpose: Node imports it directly and Vite bundles it for
 * the worker, with no build step in between. Types live in `flightModel.d.ts`.
 *
 * Nothing here touches Node or DOM APIs — keep it that way.
 */

/** Wall-clock rate of each channel, in Hz. */
export const CHANNEL_HZ = {
  gyro_x: 1000,
  gyro_y: 1000,
  gyro_z: 1000,
  vibe: 1000,
  current: 1000,
  altitude: 50,
  battery: 10,
};

/** How often a batch goes out. Each batch carries every sample due since the last. */
export const TICK_HZ = 50;

/** Gaussian via Box–Muller — turbulence is not uniform noise. */
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Minimal flight model. Not accurate aerodynamics — just enough structure that
 * the traces have the shape of real telemetry: correlated noise, bounded
 * excursions, transients that decay, and cross-coupling between channels.
 */
export function createFlightModel() {
  // Body rates (deg/s) and their velocities, per axis.
  const rate = { x: 0, y: 0, z: 0 };
  const vel = { x: 0, y: 0, z: 0 };
  // Ornstein-Uhlenbeck turbulence state, per axis.
  const turb = { x: 0, y: 0, z: 0 };
  // Commanded attitude rate, re-rolled occasionally to mimic pilot/autopilot input.
  const cmd = { x: 0, y: 0, z: 0 };
  let cmdHold = 0;
  // Decaying gust impulse.
  const gust = { x: 0, y: 0, z: 0 };

  let altitude = 120;
  let climbRate = 0;
  let climbTarget = 0;
  let climbHold = 0;
  let battery = 96;
  // Motor vibration: a resonance that drifts with throttle.
  let vibePhase = 0;
  let resonance = 0;

  const axes = ['x', 'y', 'z'];

  /** Advance the model by `dt` seconds and return the current sample values. */
  return function step(dt) {
    // Re-roll the manoeuvre command every 1.5–4.5 s.
    cmdHold -= dt;
    if (cmdHold <= 0) {
      cmdHold = 1.5 + Math.random() * 3;
      cmd.x = (Math.random() - 0.5) * 40;
      cmd.y = (Math.random() - 0.5) * 30;
      cmd.z = (Math.random() - 0.5) * 60;
    }

    for (const a of axes) {
      // OU turbulence: mean-reverting, so it wanders without drifting away.
      turb[a] += (-turb[a] * 2.5 + gauss() * 14) * dt;

      // Rare sharp gust — the transient min/max bucketing must not average away.
      if (Math.random() < 0.4 * dt) gust[a] += (Math.random() - 0.5) * 120;
      gust[a] *= Math.exp(-dt / 0.08);

      // Damped second-order tracking of the commanded rate.
      const stiffness = 26;
      const damping = 6.5;
      const accel = (cmd[a] - rate[a]) * stiffness - vel[a] * damping;
      vel[a] += accel * dt;
      rate[a] += vel[a] * dt;
    }

    // Altitude: slow commanded climb/descent with a lagged response.
    climbHold -= dt;
    if (climbHold <= 0) {
      climbHold = 4 + Math.random() * 6;
      climbTarget = (Math.random() - 0.45) * 5;
    }
    climbRate += (climbTarget - climbRate) * 1.2 * dt;
    altitude = Math.max(0, altitude + climbRate * dt);

    // Throttle demand rises with climb and with how hard the airframe is working.
    const effort =
      Math.abs(climbRate) * 0.9 +
      (Math.abs(rate.x) + Math.abs(rate.y) + Math.abs(rate.z)) * 0.02;
    const current = 11 + effort * 1.6 + Math.abs(gauss()) * 0.35 + Math.abs(gust.x) * 0.006;

    // Vibration rides a motor-frequency carrier whose amplitude tracks effort,
    // with occasional resonance bursts.
    vibePhase += dt * (150 + effort * 30) * 2 * Math.PI;
    if (Math.random() < 0.25 * dt) resonance = 1.4 + Math.random() * 2.2;
    resonance *= Math.exp(-dt / 0.35);
    const vibe =
      Math.sin(vibePhase) * (0.5 + effort * 0.22 + resonance) + gauss() * 0.28;

    battery = Math.max(0, battery - (current / 3600) * dt * 4.2);

    return {
      gyro_x: rate.x + turb.x + gust.x,
      gyro_y: rate.y + turb.y + gust.y,
      gyro_z: rate.z + turb.z + gust.z,
      vibe,
      current,
      altitude,
      battery,
    };
  };
}

/**
 * Advance the model and return every sample due over `elapsedMs`.
 *
 * Callers supply the wall-clock `now` so each host stays honest about its own
 * clock. `owed` carries fractional sample debt between calls, which is what
 * keeps a 50 Hz channel on rate when the tick is 20 ms.
 */
export function collectBatch(step, owed, channels, now, elapsedMs) {
  const dt = elapsedMs / 1000;
  const maxHz = Math.max(...Object.values(CHANNEL_HZ));
  const steps = Math.max(1, Math.round(dt * maxHz));
  const stepDt = dt / steps;

  const samples = [];
  for (let i = 0; i < steps; i++) {
    const values = step(stepDt);
    // Timestamp each sample at its true position inside the window, so the ring
    // buffers see an evenly spaced stream rather than 100 samples sharing one
    // instant.
    const timestamp = now - elapsedMs + ((i + 1) / steps) * elapsedMs;
    for (const [name, hz] of channels) {
      let debt = owed.get(name) + hz * stepDt;
      while (debt >= 1) {
        samples.push({ channel: name, value: values[name], timestamp });
        debt -= 1;
      }
      owed.set(name, debt);
    }
  }
  return samples;
}

/** Fresh per-channel debt map. */
export function createOwedMap() {
  return new Map(Object.keys(CHANNEL_HZ).map((name) => [name, 0]));
}

/** Every channel this model produces, as `[name, hz]` pairs. */
export function allChannels() {
  return Object.entries(CHANNEL_HZ);
}
