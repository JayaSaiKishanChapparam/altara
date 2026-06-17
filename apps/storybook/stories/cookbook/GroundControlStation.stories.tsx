import type { Meta, StoryObj } from '@storybook/react';
import { LiveMap, Gauge, EventLog, type EventLogEntry } from '@altara/core';
import { PrimaryFlightDisplay } from '@altara/aerospace';

/**
 * The drone ground-control station from the dev.to article, verbatim — the
 * exact component a reader pastes. mockMode everywhere; EventLog is a static
 * array (no streaming). This story is the source for the article hero GIF.
 */
const demoEvents: EventLogEntry[] = [
  { timestamp: Date.now() - 9000, severity: 'info', message: 'EKF using GPS' },
  { timestamp: Date.now() - 6000, severity: 'info', message: 'Armed' },
  { timestamp: Date.now() - 3000, severity: 'warn', message: 'Wind 11 m/s, approaching limit' },
  { timestamp: Date.now() - 1000, severity: 'info', message: 'Waypoint 3 reached' },
];

function GroundControlStation() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, alignItems: 'start' }}>
      <PrimaryFlightDisplay mockMode size="md" showFlightDirector />
      <LiveMap mockMode />
      <Gauge
        mockMode
        mockProfile="ramp"
        min={0}
        max={100}
        label="Battery"
        unit="%"
        thresholds={[
          { value: 0, color: 'var(--vt-color-danger)' },
          { value: 20, color: 'var(--vt-color-warn)' },
          { value: 40, color: 'var(--vt-color-active)' },
        ]}
      />
      <EventLog entries={demoEvents} />
    </div>
  );
}

const meta: Meta = {
  title: 'Drone GCS',
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj = {
  name: 'Ground Control Station',
  render: () => <GroundControlStation />,
};
