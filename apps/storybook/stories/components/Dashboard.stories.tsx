import type { Meta, StoryObj } from '@storybook/react';
import {
  Attitude,
  ConnectionBar,
  Gauge,
  SignalPanel,
  TimeSeries,
  createMockDataSource,
  randomWalk,
  sineWave,
  stepFunction,
} from '@altara/core';

/**
 * Hero story — every component on screen at once. Used by the GIF
 * recorder (`scripts/record-gifs.js`) to produce the README hero shot.
 */
const meta: Meta = {
  title: 'Dashboard',
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Hero: StoryObj = {
  name: 'Hero — all components',
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: 16,
        background: 'var(--vt-bg-base)',
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <ConnectionBar
          url="ws://localhost:9090"
          status="connected"
          latencyMs={14}
          messagesPerSecond={250}
        />
      </div>

      <TimeSeries
        mockMode
        height={220}
        channels={[
          { key: 'roll', label: 'Roll', unit: '°', color: '#1D9E75' },
          { key: 'pitch', label: 'Pitch', unit: '°', color: '#378ADD' },
        ]}
      />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <Gauge mockMode min={0} max={100} label="Battery" unit="%" size="md" />
        <Attitude mockMode size={200} />
      </div>

      <SignalPanel
        columns={2}
        signals={[
          {
            key: 'alt',
            label: 'Altitude',
            unit: 'm',
            dataSource: createMockDataSource({ generator: sineWave(0.1, 120), hz: 5 }),
          },
          {
            key: 'spd',
            label: 'Speed',
            unit: 'm/s',
            dataSource: createMockDataSource({ generator: sineWave(0.3, 8), hz: 5 }),
          },
          {
            key: 'hdg',
            label: 'Heading',
            unit: '°',
            dataSource: createMockDataSource({ generator: sineWave(0.05, 180), hz: 5 }),
          },
          {
            key: 'temp',
            label: 'Temp',
            unit: '°C',
            dataSource: createMockDataSource({
              generator: randomWalk(0.05, 50, 0.5),
              hz: 5,
            }),
          },
          {
            key: 'sats',
            label: 'Satellites',
            unit: '',
            dataSource: createMockDataSource({
              generator: stepFunction(2000, 7, 9),
              hz: 1,
            }),
          },
          {
            key: 'rssi',
            label: 'RSSI',
            unit: 'dBm',
            dataSource: createMockDataSource({
              generator: randomWalk(0.05, 120, 0.5),
              hz: 5,
            }),
          },
        ]}
      />
    </div>
  ),
};
