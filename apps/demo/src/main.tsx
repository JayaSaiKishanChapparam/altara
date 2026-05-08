import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@altara/core/styles.css';
import { AltaraProvider } from '@altara/core';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <AltaraProvider theme="dark">
      <App />
    </AltaraProvider>
  </StrictMode>,
);
