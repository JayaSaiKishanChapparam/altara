import type { Meta, StoryObj } from '@storybook/react';
import { EventLog } from '@altara/core';
import type { EventLogEntry } from '@altara/core';

const meta: Meta<typeof EventLog> = {
  title: 'Components/EventLog',
  component: EventLog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Scrollable timestamped log with `info` / `warn` / `error` severity. Auto-scrolls to the latest entry while the user is pinned to the bottom; pauses if they scroll away. Filterable via the toolbar.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: 320 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof EventLog>;

const SEVERITIES: EventLogEntry['severity'][] = ['info', 'info', 'info', 'warn', 'error'];
const MESSAGES = [
  'Battery healthy at 87%',
  'GPS lock acquired (8 satellites)',
  'IMU calibrated',
  'Wind speed approaching limit (12 m/s)',
  'Lost telemetry link to /drone/imu',
  'Resuming flight plan',
  'Geofence breach detected',
  'Telemetry rate dropped to 24 Hz',
  'Compass calibration complete',
  'GPS dilution-of-precision elevated',
];

function generate(count: number, spacingMs = 1000): EventLogEntry[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    timestamp: now - (count - i) * spacingMs,
    severity: SEVERITIES[i % SEVERITIES.length]!,
    message: MESSAGES[i % MESSAGES.length]!,
  }));
}

// ── Story 1: Default — small mixed-severity feed ───────────────────────
export const Default: Story = {
  name: 'Default',
  args: { entries: generate(20) },
};

// ── Story 2: Mixed severity — explicit demonstration of all three ──────
export const MixedSeverity: Story = {
  name: 'Mixed severity',
  parameters: {
    docs: {
      description: {
        story:
          'Three rows demonstrating each severity level — `info` (blue), `warn` (amber), `error` (red).',
      },
    },
  },
  args: {
    entries: [
      { timestamp: Date.now() - 3000, severity: 'info', message: 'Startup complete' },
      {
        timestamp: Date.now() - 2000,
        severity: 'warn',
        message: 'Battery dropping below 30%',
      },
      {
        timestamp: Date.now() - 1000,
        severity: 'error',
        message: 'Geofence breach — return-to-home triggered',
      },
    ],
  },
};

// ── Story 3: High volume — 500 entries in the buffer ───────────────────
export const HighVolume: Story = {
  name: 'High volume',
  parameters: {
    docs: {
      description: {
        story:
          '500 entries fed in at once. The log only renders the visible window — scroll up to inspect older messages.',
      },
    },
  },
  args: { entries: generate(500, 250) },
};

// ── Story 4: Pre-applied filter (warn+ only) ───────────────────────────
export const WithFilter: Story = {
  name: 'With filter',
  parameters: {
    docs: {
      description: {
        story: 'Mounts with `filter: "warn"` — only warn + error rows are visible.',
      },
    },
  },
  args: { entries: generate(40), filter: 'warn' },
};
