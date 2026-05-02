import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@altara/core/styles.css';
import { AltaraProvider } from '@altara/core';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <AltaraProvider theme="dark">
      <main style={{ padding: '24px', color: 'var(--vt-text-primary)' }}>
        <h1>Altara Demo</h1>
        <p>Components arrive in Phase 3.</p>
      </main>
    </AltaraProvider>
  </StrictMode>,
);
