import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupWebBridgeIfNeeded } from './utils/webBridge';
import { initConsoleCapture } from './utils/consoleCapture';

// Setup console capture ring buffer for diagnostics
initConsoleCapture();

// Setup HTTP Native Server Bridge if running in browser outside Electron container
setupWebBridgeIfNeeded();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
