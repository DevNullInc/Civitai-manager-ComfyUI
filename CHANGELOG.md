# Changelog

All notable changes, fixes, and unversioned enhancements to **CivitAI Model Manager (ComfyUI Edition)** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### 🌟 Added
- **Dedicated Workflows Tab & Visual Node Map**:
  - Interactive spatial canvas renderer preserving LiteGraph node positions (`pos`), sizes, and bezier link wiring.
  - Node readiness status color-coding: 🟢 **Ready** (Installed), 🟡 **Missing Model**, 🔴 **Missing Extension**.
  - Interactive canvas controls (pan, zoom slider, reset fit-view).
  - Canvas node selection focusing corresponding dependency and resolution cards.
- **Dual PNG Chunk Metadata Parser (`tEXt` & `iTXt`)**:
  - Automatically extracts and uncompresses **both** `workflow` (canvas spatial graph) and `prompt` (execution fallback graph) from ComfyUI generated `.png` files.
  - Direct in-memory buffer parsing without intermediate disk writes.
- **4-Tier Custom Node Dependency Resolver**:
  - **Tier 1:** Local `custom_nodes/` scanning and Python `NODE_CLASS_MAPPINGS` inspection for multi-node packs (e.g. `ComfyUI-Impact-Pack` $\rightarrow$ `ImpactWildcardProcessor`).
  - **Tier 2:** SQLite cache for `extension-node-map.json` and `custom-node-list.json` with 24-hour TTL and `If-None-Match` ETag validation.
  - **Tier 3:** Scoped GitHub Search API queue (750ms debounce, respecting 10 req/min limit) querying `topic:comfyui <term>` with prefix stripping (`ComfyUI-`, `Comfy_`, `comfyui-`) returning top 3 repository candidates with star badges and commit dates.
  - **Tier 4:** Targeted Python environment locator (Windows portable `python_embeded/python.exe` vs Linux/macOS `venv/bin/python`) and 1-click pip dependency runner (`requirements.txt` / `install.py`).
- **Real-Time Inline Download Progress Bars**:
  - Live speed metrics (`MB/s`) and percentage bars rendered directly inside the workflow model dependency matrix.
- **Dynamic Backend Health Heartbeat & "Offline" Status Badge**:
  - Dedicated `/api/health` and `/health` endpoints on the native HTTP API bridge (`127.0.0.1:5174`).
  - Periodic 3-second heartbeat polling in the frontend; switches top-right menu badge to red **"Offline"** with `WifiOff` icon upon backend shutdown or disconnection.
- **Workflow Queue Management**:
  - Top-right `(X)` close button on each workflow card in the loaded workflows carousel for individual dismissal.
  - Automatic `sessionStorage` backup synchronization for loaded workflows.

### 🛡️ Fixed & Improved
- **Process Shutdown Protection & Sanity Checking**:
  - Added strict blacklist protections in `cmm.sh`, `cmm.ps1`, and `src/main/index.ts` forbidding termination of web browsers (`firefox`, `chrome`, `chromium`, `brave`, `opera`, `msedge`, `safari`, `zen-browser`, `tor`) and system processes during `./cmm.sh stop` or `./cmm.sh restart`.
  - Port inspection filtered to `-sTCP:LISTEN` sockets only, preventing client TCP socket connections from being targeted.
  - Verified process binaries and working directories to ensure only internal CMM Electron and Vite dev server processes are stopped.
- **Deep ComfyUI JSON Format Normalization**:
  - Robust parser supporting direct UI canvas exports, nested `{ workflow: { nodes } }`, API execution prompts `{ "3": { class_type } }`, array node lists, and stringified metadata wrappers (`extra_pnginfo.workflow`, `extra.prompt`).
  - Strict JSON validity verification: immediately alerts user on non-ComfyUI JSON payloads or corrupted files without adding empty 0/0 cards to the queue.
- **Tab State Persistence**:
  - Maintained persistent DOM mounting across all primary navigation tabs (`browse`, `library`, `workflows`, `downloads`, `settings`, `about`) via display styling, preventing component unmounting, scroll resets, and workflow queue clears during tab switching.
