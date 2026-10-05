
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { startSyncWatcher } from './utils/sync.ts';
import { startPriceCloudSync } from './utils/priceCloud.ts';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// watch the connection and retry anything that could not reach the cloud
startSyncWatcher();
// the Pricing Desk's duty sheets follow the operator from computer to computer
startPriceCloudSync();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
