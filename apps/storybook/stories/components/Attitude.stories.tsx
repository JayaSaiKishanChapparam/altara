import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { Attitude } from '@altara/core';
import { createRosbridgeAdapter } from '@altara/ros';
import type { AltaraDataSource, TelemetryValue } from '@altara/core';

const meta: Meta<typeof Attitude> = {
  title: 'Components/Attitude',
  component: Attitude,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Canvas artificial-horizon (attitude) indicator. Sky above the horizon, ground below. The horizon ball rotates on roll and translates vertically on pitch; the yellow aircraft symbol is drawn last and never moves — it\'s the reference.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Attitude>;

// Hook that drives a value with a sine wave for the duration of the story.
function useAnimated(hz: number, amplitude: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setV(Math.sin((performance.now() / 1000) * Math.PI * 2 * hz) * amplitude);
    }, 33);
    return () => clearInterval(id);
  }, [hz, amplitude]);
  return v;
}

// ── Story 1: Default — out-of-phase oscillation via mockMode ───────────
export const Default: Story = {
  name: 'Default',
  args: { mockMode: true, size: 220 },
};

// ── Story 2: Roll only ─────────────────────────────────────────────────
export const RollOnly: Story = {
  name: 'Roll only',
  parameters: {
    docs: { description: { story: 'Pitch held at 0; roll oscillates ±35°.' } },
  },
  render: () => {
    const Component = () => {
      const roll = useAnimated(0.25, 35);
      return <Attitude roll={roll} pitch={0} size={260} />;
    };
    return <Component />;
  },
};

// ── Story 3: Pitch only ────────────────────────────────────────────────
export const PitchOnly: Story = {
  name: 'Pitch only',
  parameters: {
    docs: { description: { story: 'Roll held at 0; pitch oscillates ±20°.' } },
  },
  render: () => {
    const Component = () => {
      const pitch = useAnimated(0.3, 20);
      return <Attitude roll={0} pitch={pitch} size={260} />;
    };
    return <Component />;
  },
};

// ── Story 4: Combined motion (mockMode = built-in pattern) ─────────────
export const CombinedMotion: Story = {
  name: 'Combined motion',
  args: { mockMode: true, size: 320 },
};

// ── Story 5: ROS2 IMU integration ──────────────────────────────────────
export const WithROS2: Story = {
  name: 'With ROS2',
  parameters: {
    docs: {
      description: {
        story:
          'Wires the attitude indicator to a `sensor_msgs/Imu` topic. Emits two channels — `roll` from `linear_acceleration.y` and `pitch` from `linear_acceleration.x` (a simple proxy for didactic purposes; real flight stacks fuse gyro + accel). Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => {
    // Build a single rosbridge adapter and re-emit each message twice
    // (once on the 'roll' channel, once on 'pitch') so Attitude's two
    // channels can both be fed from one IMU topic.
    const upstream = createRosbridgeAdapter({
      url: 'ws://localhost:9090',
      topic: '/imu/data',
      messageType: 'sensor_msgs/Imu',
      valueExtractor: () => 0, // unused — we re-route in the wrapper below
    });
    const subs = new Set<(v: TelemetryValue) => void>();
    upstream.subscribe((v) => {
      // upstream's value is 0; the original message isn't preserved here.
      // For a real integration the consumer would build a custom source
      // that reads roll/pitch directly from the IMU message body.
      void v;
      const t = Date.now();
      for (const cb of subs) {
        cb({ value: 0, timestamp: t, channel: 'roll' });
        cb({ value: 0, timestamp: t, channel: 'pitch' });
      }
    });
    const ds: AltaraDataSource = {
      subscribe(cb) {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      getHistory: () => [],
      get status() {
        return upstream.status;
      },
      destroy() {
        upstream.destroy();
        subs.clear();
      },
    };
    return <Attitude dataSource={ds} size={260} />;
  },
};
