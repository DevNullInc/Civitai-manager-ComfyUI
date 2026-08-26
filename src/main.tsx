/**
 * CivitAI Model Manager - ComfyUI Edition
 * Copyright (C) 2025-2026 TheStygianRenegade / /dev/null Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
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
