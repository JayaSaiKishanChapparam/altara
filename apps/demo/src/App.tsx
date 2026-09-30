import { useState } from 'react';
import { ConnectionBar } from '@altara/core';
import { GcsView } from './views/GcsView';
import { CoreView } from './views/CoreView';
import { AerospaceView } from './views/AerospaceView';
import { AvView } from './views/AvView';
import { IndustrialView } from './views/IndustrialView';
import { ReplayView } from './views/ReplayView';
import { WorkerPipelineView } from './views/WorkerPipelineView';

type ViewKey = 'gcs' | 'replay' | 'worker' | 'core' | 'aerospace' | 'av' | 'industrial';

const TABS: { key: ViewKey; label: string; description: string }[] = [
  { key: 'gcs', label: 'Drone GCS', description: 'PFD + map + battery + events over @altara/ros' },
  {
    key: 'replay',
    label: 'Replay',
    description: 'Synthetic session played back through the AltaraDataSource interface',
  },
  {
    key: 'worker',
    label: 'Worker Pipeline',
    description: '5 kHz feed — decimation in a Web Worker, off the render thread',
  },
  { key: 'core', label: 'Telemetry', description: '@altara/core primitives' },
  { key: 'aerospace', label: 'Drone / Aerospace', description: '@altara/aerospace flight instruments' },
  { key: 'av', label: 'Autonomous Vehicle', description: '@altara/av perception & control' },
  { key: 'industrial', label: 'Industrial / SCADA', description: '@altara/industrial HMI' },
];

export function App() {
  const [active, setActive] = useState<ViewKey>('gcs');
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <div className="demo-shell">
      <header className="demo-header">
        <h1>Altara — Live Demo</h1>
        <p className="demo-tagline">{tab.description}</p>
        <div className="spacer" />
        <a href="../storybook/" rel="noopener">Storybook ↗</a>
        <a
          href="https://github.com/JayaSaiKishanChapparam/altara"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </header>

      <div role="tablist" className="demo-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className="demo-tab"
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* The Worker Pipeline tab is the only one with a real socket, and it
          renders its own ConnectionBar with measured values. Every other tab is
          driven by in-browser generators, so there is no link, latency, or
          message rate to report — the strip says so instead of inventing them. */}
      {active !== 'worker' && (
        <div style={{ padding: '16px 20px 0' }}>
          <ConnectionBar url="mock://in-browser-generators" status="connected" />
        </div>
      )}

      {active === 'gcs' && <GcsView />}
      {active === 'replay' && <ReplayView />}
      {active === 'worker' && <WorkerPipelineView />}
      {active === 'core' && <CoreView />}
      {active === 'aerospace' && <AerospaceView />}
      {active === 'av' && <AvView />}
      {active === 'industrial' && <IndustrialView />}
    </div>
  );
}
