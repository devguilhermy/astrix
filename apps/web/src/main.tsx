import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './i18n/config';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './ui/recovery/ErrorBoundary';
// Resolve at runtime: Vite treats new URL('../', import.meta.url) as a filesystem asset.
const entryUrl = new URL(import.meta.url);
const basePath = new URL('../', entryUrl).pathname;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary scope="application">
      <App basePath={basePath}/>
    </ErrorBoundary>
  </React.StrictMode>,
);
