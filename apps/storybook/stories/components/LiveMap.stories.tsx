import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { LiveMap, mergeChannels } from '@altara/core';
import { createNavSatFixAdapter, createRosbridgeAdapter } from '@altara/ros';

const meta: Meta<typeof LiveMap> = {
  title: 'Components/LiveMap',
  component: LiveMap,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Map view of a moving GPS asset. Leaflet + react-leaflet are optional peer deps loaded dynamically. The polyline track grows as new positions arrive (capped by `trackLength`); auto-follow disengages when the user drags the map. In `mockMode` the marker turns its nose along the orbit (great-circle bearing of travel); when you pass a controlled `position`, your `heading` prop wins.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 600, height: 400 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof LiveMap>;

// ── Story 1: Default — built-in mock drone orbit ───────────────────────
export const Default: Story = {
  name: 'Default',
  args: { mockMode: true },
};

// ── Story 2: Geofence circles overlaid ─────────────────────────────────
export const WithGeofence: Story = {
  name: 'With geofence',
  args: {
    mockMode: true,
    geofences: [
      { center: [37.7749, -122.4194], radius: 200, color: 'var(--vt-color-warn)' },
      { center: [37.7765, -122.418], radius: 80, color: 'var(--vt-color-danger)' },
    ],
  },
};

// ── Story 3: Path history — long trail (~10 minutes of orbit) ──────────
export const WithPathHistory: Story = {
  name: 'With path history',
  parameters: {
    docs: {
      description: {
        story:
          'Same orbit as Default but with `trackLength: 800` instead of the 200 default — the polyline retains a much longer trail.',
      },
    },
  },
  args: { mockMode: true, trackLength: 800 },
};

// ── Story 4: ROS2 NavSatFix integration ────────────────────────────────
export const WithROS2: Story = {
  name: 'With ROS2',
  parameters: {
    docs: {
      description: {
        story:
          'Wires the map to a `sensor_msgs/NavSatFix` topic. We build two NavSatFix adapters (one for latitude, one for longitude) and combine their latest values into a `{ lat, lng }` position. Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => {
    const Component = () => {
      const [position, setPosition] = useState<{ lat: number; lng: number } | undefined>(
        undefined,
      );
      useEffect(() => {
        const lat = createNavSatFixAdapter({
          url: 'ws://localhost:9090',
          topic: '/fix',
          axis: 'latitude',
        });
        const lng = createNavSatFixAdapter({
          url: 'ws://localhost:9090',
          topic: '/fix',
          axis: 'longitude',
        });
        let latest: { lat?: number; lng?: number } = {};
        const offLat = lat.subscribe((v) => {
          latest = { ...latest, lat: v.value };
          if (latest.lat !== undefined && latest.lng !== undefined) {
            setPosition({ lat: latest.lat, lng: latest.lng });
          }
        });
        const offLng = lng.subscribe((v) => {
          latest = { ...latest, lng: v.value };
          if (latest.lat !== undefined && latest.lng !== undefined) {
            setPosition({ lat: latest.lat, lng: latest.lng });
          }
        });
        return () => {
          offLat();
          offLng();
          lat.destroy();
          lng.destroy();
        };
      }, []);
      return <LiveMap position={position} heading={0} />;
    };
    return <Component />;
  },
};

// ── Story 5: ROS2 NavSatFix on a single socket (channels + mergeChannels) ─
export const WithROS2SingleSocket: Story = {
  name: 'With ROS2 (single socket)',
  parameters: {
    docs: {
      description: {
        story:
          'The tidier wiring: pull `lat`/`lng` as two channels off **one** `sensor_msgs/NavSatFix` socket via the `channels` extractor map, union them with `mergeChannels`, then accumulate into `{ lat, lng }`. Requires `rosbridge_server` on `ws://localhost:9090`.',
      },
    },
  },
  render: () => {
    const Component = () => {
      const [position, setPosition] = useState<{ lat: number; lng: number } | undefined>(
        undefined,
      );
      useEffect(() => {
        const gps = createRosbridgeAdapter({
          url: 'ws://localhost:9090',
          topic: '/mavros/global_position/global',
          messageType: 'sensor_msgs/NavSatFix',
          channels: {
            lat: (m) => m.latitude,
            lng: (m) => m.longitude,
          },
        });
        const source = mergeChannels({ lat: gps.lat, lng: gps.lng });
        const latest: { lat?: number; lng?: number } = {};
        const off = source.subscribe((v) => {
          if (v.channel === 'lat') latest.lat = v.value;
          if (v.channel === 'lng') latest.lng = v.value;
          if (latest.lat !== undefined && latest.lng !== undefined) {
            setPosition({ lat: latest.lat, lng: latest.lng });
          }
        });
        return () => {
          off();
          source.destroy();
        };
      }, []);
      return position ? <LiveMap position={position} /> : <LiveMap />;
    };
    return <Component />;
  },
};
