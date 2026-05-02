import type { Meta, StoryObj } from '@storybook/react';
import { ConnectionBar } from '@altara/core';

const meta: Meta<typeof ConnectionBar> = {
  title: 'Components/ConnectionBar',
  component: ConnectionBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Persistent status strip for telemetry connections. Controlled component — pair with `useWebSocket` (or a similar hook) and pipe its derived status, latency, and message rate into the props.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionBar>;

// ── Connected — happy path ─────────────────────────────────────────────
export const Connected: Story = {
  name: 'Connected',
  args: {
    url: 'ws://localhost:9090',
    status: 'connected',
    latencyMs: 14,
    messagesPerSecond: 250,
  },
};

// ── Reconnecting — backoff in progress ─────────────────────────────────
export const Reconnecting: Story = {
  name: 'Reconnecting',
  parameters: {
    docs: {
      description: {
        story:
          'Mid-reconnect: amber dot, latency unknown, rate dropped to zero. `useWebSocket` reports this state during exponential backoff after a drop.',
      },
    },
  },
  args: {
    url: 'wss://broker.altara.dev/imu',
    status: 'connecting',
    messagesPerSecond: 0,
  },
};

// ── Disconnected — link dropped ────────────────────────────────────────
export const Disconnected: Story = {
  name: 'Disconnected',
  args: {
    url: 'ws://localhost:9090',
    status: 'disconnected',
  },
};

// ── HighLatency — connected but slow ───────────────────────────────────
export const HighLatency: Story = {
  name: 'High latency',
  parameters: {
    docs: {
      description: {
        story:
          'Connected but the round-trip exceeds one second — the latency formatter switches from `ms` to `s` automatically.',
      },
    },
  },
  args: {
    url: 'wss://broker.altara.dev/imu',
    status: 'connected',
    latencyMs: 1850,
    messagesPerSecond: 30,
  },
};
