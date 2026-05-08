import { useState } from 'react';
import { ConnectionBar } from '@altara/core';
import { CoreView } from './views/CoreView';
import { AerospaceView } from './views/AerospaceView';
import { AvView } from './views/AvView';
import { IndustrialView } from './views/IndustrialView';

type ViewKey = 'core' | 'aerospace' | 'av' | 'industrial';

const TABS: { key: ViewKey; label: string; description: string }[] = [
  { key: 'core', label: 'Telemetry', description: '@altara/core primitives' },
  { key: 'aerospace', label: 'Drone / Aerospace', description: '@altara/aerospace flight instruments' },
  { key: 'av', label: 'Autonomous Vehicle', description: '@altara/av perception & control' },
  { key: 'industrial', label: 'Industrial / SCADA', description: '@altara/industrial HMI' },
];

export function App() {
  const [active, setActive] = useState<ViewKey>('core');
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
          rel="noopener"
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

      <div style={{ padding: '16px 20px 0' }}>
        <ConnectionBar
          url="ws://demo.altara.dev:9090"
          status="connected"
          latencyMs={14}
          messagesPerSecond={284}
        />
      </div>

      {active === 'core' && <CoreView />}
      {active === 'aerospace' && <AerospaceView />}
      {active === 'av' && <AvView />}
      {active === 'industrial' && <IndustrialView />}
    </div>
  );
}
