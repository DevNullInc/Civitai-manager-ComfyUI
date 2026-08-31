# Changelog

All notable changes, fixes, and unversioned enhancements to **Renegade Core Model Manager** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### 🌟 Added

- **Dedicated macOS Launcher Scripts (`cmm-mac.sh` / `cmm-dev-mac.sh`)**:
  - Added `cmm-mac.sh` as the dedicated macOS launcher (mirroring `cmm.sh` for Linux and `cmm.ps1` for Windows) with full command support: `start`, `stop`, `restart`, `status`, `update`, `package`/`dist`, `help`, and CLI passthrough.
  - macOS-specific Electron binary path resolution (`Electron.app/Contents/MacOS/Electron`) instead of Linux `electron/dist/electron`.
  - Window focus via `osascript` (AppleScript) instead of Linux `wmctrl`/`xdotool`.
  - Port detection using `lsof` only (no `ss` fallback — `ss` is Linux-only).
  - macOS-specific protected process blacklist (Finder, Dock, WindowServer, loginwindow, Spotlight, launchd, etc.) preventing accidental termination of system services.
  - Node.js install hint includes `brew install node` for Homebrew users.
  - Homebrew path auto-detection for both Apple Silicon (`/opt/homebrew/bin`) and Intel (`/usr/local/bin`) Macs.
  - `timeout` command gracefully falls back to `gtimeout` (GNU coreutils) or no-timeout when checking Git remotes.
  - Packaging target uses `electron-builder --mac dmg zip` and scans for `.dmg` and `.zip` release artifacts.
  - Banner identifies itself as the **macOS Launcher** variant.
  - Added `cmm-dev-mac.sh` development wrapper setting `CMM_DEV_BUILD=true` and `NODE_ENV=development` before delegating to `cmm-mac.sh`.
  - Added `cmm:start:mac`, `cmm:stop:mac`, `cmm:restart:mac`, `cmm:status:mac`, `cmm:package:mac` npm convenience scripts in `package.json`.
  - `cmm.sh` is now explicitly Linux-only; macOS users should use `cmm-mac.sh`.

- **Automatic ComfyUI Model Subfolder Scaffolding & Verification**:
  - Automatically creates and verifies the full standard ComfyUI model subfolder tree (`checkpoints/`, `loras/`, `vae/`, `controlnet/`, `diffusion_models/`, `upscale_models/`, `clip/`, `clip_vision/`, `text_encoders/`, `unet/`, `hypernetworks/`, `gligen/`, `style_models/`, `model_patches/`, `configs/`, `vae_approx/`, `ipadapter/`, `insightface/`, `photomaker/`, `pulid/`, `reactor/`, `gguf/`, `wildcards/`, `ultralytics/`, `yolo/`, `sams/`) inside configured model directories if any subdirectories are missing.
  - Workflows directory is explicitly omitted from model folders since workflows are managed separately (`workflows/`, `user/default/workflows/`).
  - Added 1-click **"Build Missing Subfolders"** action in Settings with live scaffolding diagnostics and toasts.
  - Auto-triggers scaffolding on startup, configuration save, new folder additions, and library scans.
- **Saved ComfyUI Workflows Dropdown Selector**:
  - Integrated a dedicated workflow selector dropdown situated directly above the drag-and-drop zone in the Workflows tab.
  - Automatically scans and indexes all existing `.json` workflows and workflow-embedded `.png` images across the user's ComfyUI directory (`workflows/`, `user/default/workflows/`, etc.).
  - Selecting any workflow from the dropdown instantly loads and renders its visual node map, model dependencies, node resolution matrix, and custom node download status.
  - Features real-time folder rescanning with a 1-click **"Rescan ComfyUI Folder"** action.
- **Development Version Update Notice & Startup Git Check**:
  - Top-level fixed `<DevelopmentUpdateBanner />` in the UI indicating when a newer development commit is available on GitHub (with commit hash, message, and direct link).
  - Explicitly informs users that they are running an active **development version** (not a tagged release).
  - Centralized **Release vs Development Build Toggle** (`BUILD_CONFIG.IS_DEV_BUILD` in `src/version.ts`) to cleanly disable the update banner and commit diff checks prior to building production release packages.
  - Dedicated CLI & npm mode switchers (`npm run mode:release`, `npm run mode:dev`, `npm run mode:status`, `./cmm.sh mode [release|dev]`, `.\cmm.ps1 mode [release|dev]`).
  - Includes a "Dismiss" action that saves the dismissed commit hash to `localStorage` so it doesn't reappear until a newer commit is pushed.
  - Added non-blocking Git remote check to `./cmm.sh` and `.\cmm.ps1` startup scripts warning terminal users if local development branches are behind upstream `main`.
  - Added `./cmm.sh update` and `.\cmm.ps1 update` launcher commands to automatically pull latest commits, install dependencies, and rebuild the application.
- **Missing Models Detection & 1-Click CivitAI Pulling on Library/Backup Import**:
  - Automatically identifies restored library models whose physical files are missing from local disk (e.g. after importing a library or system backup zip on a fresh machine).
  - Prominent **"Missing on Disk"** filter tab and badge styling across the Library catalog.
  - 1-Click **"Download Model"** / **"Pull from CivitAI (Hash Match)"** on individual model cards, querying CivitAI by SHA256 checksum or version ID and routing downloads into user-configured model directories.
  - Batch **"Download All Missing Models"** header action queueing downloads for all matched missing models with real-time feedback.
  - Backup restoration diagnostics reporting the exact count of missing model files with direct navigation to the Library tab.
- **ComfyUI Base Directory Structure Diagnostic & Health Validation**:
  - Automated structural inspection of local ComfyUI installations against the core program structure (`main.py`, `custom_nodes/`, `models/`, `input/`, `output/`, `extra_model_paths.yaml`).
  - Interactive diagnostic grid rendering real-time confidence scores and pass/fail indicators for all critical ComfyUI directories.
  - Automatic directory resolution for portable Windows distributions (e.g., `ComfyUI_windows_portable/ComfyUI`) and user-selected subfolders.
- **Automatic Model Folder Auto-Population & Synchronization**:
  - Setting or modifying the ComfyUI base installation path (e.g. `C:\AI\comfyui`) automatically derives and populates the primary model directory (`C:\AI\comfyui\models`) into `config.comfyui_folders`.
  - Comprehensive ComfyUI installation auto-detection scanning common drive paths, home directory locations, and configured model roots with real-time visual feedback banners and spinner state.
- **Official ComfyUI Companion Custom Node 1-Click Installer**:
  - Integrated 1-click Git clone for the official companion custom node repository ([`ComfyUI-Model-Manager`](https://github.com/DevNullInc/ComfyUI-Model-Manager)) directly into the active `custom_nodes/` directory.
  - Real-time detection and header status badge (🟢 **CMM Node Installed**, 🟡 **CMM Node: Not Installed (Click to 1-Click Install)**, or 🟠 **CMM Node: Directory Not Set**).
  - Pre-clone directory validation preventing clone failures if ComfyUI installation path is unconfigured or invalid.
  - Reorganized Settings hierarchy placing Base Installation & Structure Diagnostics at the top of the page.
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

- **Open-Source Contribution Guidelines**:
  - Added [`CONTRIBUTING.md`](CONTRIBUTING.md) with complete developer setup workflows, project architecture maps, and code style standards.
- **Complete Local REST API Reference**:
  - Updated [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) with 100% endpoint coverage, request/response schemas, and updated Python helper client (`CMMClient`) for companion custom node integration.
- **Custom Node Action-Oriented API Aliases & Recognition**:
  - Added backend route aliases (`/api/download-model`, `/api/resolve-node`, `/api/search-civitai`, `/api/check-huggingface`, `/api/inspect-workflow`) with flexible parameter mapping (camelCase & snake_case support).
  - Integrated `CMMDownloadModel`, `CMMInspectWorkflow`, and `CMMCheckHuggingFace` recognition in `workflowScanner.ts`.
- **Persistent Download Queue & Downloads Management UI**:
  - Download queue is now persisted to SQLite and fully restored across app restarts (tasks, progress, `completed_at` timing, and superseding old-version file deletion metadata survive relaunches).
  - Per-row checkbox selection with **"Delete Selected (N)"** and **"Clear All Finished (N)"** batch actions on the Downloads tab for cleaning up stale queue entries.
- **Workflow Viewer Map Polish**:
  - Connection wires are now rendered as bezier curves with hover tooltips showing `source -> target` node types.
  - One-click expand to fullscreen map with an `X` to shrink back, plus 5% zoom in/out steps (range 0.2x–2.0x).
  - Switching workflows always resets the zoom to auto-fit the full graph (imperative fit-on-select plus effect re-keyed to the active graph, covering sidebar, dropdown, parse/upload, and fullscreen toggles).
- **Auto-Library Update on Download Completion**:
  - A completed download is now registered straight into the Library immediately after it finishes (`registerCompletedFile` upserts the file with its SHA256 + CivitAI metadata at normal, skip-conflict, and force-complete paths) — no manual library re-scan required.
  - LibraryTab watches `download-progress` for newly-completed tasks and reloads the local-models list once the file is flushed to disk.
- **Auth & Secrets Links Open in the User's Real Browser**:
  - The Settings "CivitAI" API-key helper and the "huggingface.co/settings/tokens" helper now open via `shell.openExternal` (the system default browser, with a `window.open` fallback) instead of an embedded in-app window, so users can verify the HTTPS URL/certificate themselves rather than trusting an in-app clone they can't inspect.
  - Added [`docs/APISecurity.md`](docs/APISecurity.md) documenting exactly how the CivitAI API key and HuggingFace token are encrypted, stored, transmitted, and their real-world trust boundaries (with an honest note that at-rest encryption currently relies on a static embedded key, not an OS keychain — plus a roadmap to close that gap).
- **F5 / Ctrl+R Hard Refresh**:
  - The Electron frontend re-enables a hard refresh via `F5`, `Ctrl+R`, or `Cmd+R` (intercepting the key and calling `window.location.reload()`), which re-mounts the active tab so it re-fetches its data after a network drop — previously the removed default menu left no way to refresh the app.
- **Browse Tab: "Clear Filters" Action**:
  - A **Clear Filters** button in the browse filter toolbar resets the Model **Type** and **Base** selectors back to `All` and clears the search box with one click, then reloads page 1.
- **Resolution Cards: Hosting Extension / Pack Names**:
  - Missing-node cards now lead with the extension that hosts the node class (from the ComfyUI-Manager registry match — e.g. `EasyNegative` → **ComfyUI-Easy-Use**), with the node class beneath it in mono; installed cards show their folder as the pack.
  - "Search GitHub" now appends the pack name to the query for more targeted repository results.
- **"Show in Workflow" Locate Button on Resolution Cards**:
  - Missing-node cards gain a **Show in Workflow** action that pans and zooms the LiteGraph node map to the first node of that type in the viewport.

### 🔄 Changed

- **Workflow Node Map Rendered with LiteGraph.js (same engine ComfyUI uses)**:
  - Replaced the hand-rolled SVG layout/path/edge renderer (`buildLayeredLayout`, `resolveCanvasLayout`, `buildEdgePaths`, `computeBounds`, `normalizeEdge`, and the DOM drag/pan handlers) with a read-only **LiteGraph.js v0.7.18** canvas in the new `WorkflowNodeMap` component.
  - The map now reuses the exact LiteGraph canvas engine ComfyUI itself uses, so node boxes, wires, pan, and zoom behave (and render) identically; nodes keep their embedded canvas coordinates (`pos`/`size`) and bezier links.
  - Node readiness color-coding preserved: 🟢 **Ready** (emerald), 🟡 **Missing Model** (amber), 🔴 **Missing Extension** (rose); clicking a node still focuses its resolution cards.
  - Toolbar keeps zoom in/out (0.2x–2.0x), **Fit to View**, and one-click fullscreen expand/shrink.
  - Rendering is read-only for now; full LiteGraph editing mode is tracked for v1.6.0 (see ROADMAP).
  - Added LiteGraph.js copyright notice + full MIT license text to the top-level `LICENSE`.
- **Workflow Map Zoom Anchors at the Cursor, Throttled to 60fps**:
  - Replaced LiteGraph's wheel handlers (which zoom around the canvas center or raw document coordinates) with a pointer-anchored zoom so touchpad pinch and mouse-wheel scrolling zoom toward the cursor instead of jumping away.
  - Touchpad gestures emit many wheel events per frame, so zoom now accumulates `deltaY` into a running balance and one `requestAnimationFrame` flush applies the whole balance at once (never per hardware tick), capped at ~60 applies/second with an interval guard for ≥120 Hz displays. The balance is fully drained each flush so zoom never "coasts" after the fingers stop, and only the standard `wheel` event is listened to (the legacy `mousewheel`/`DOMMouseScroll` bindings were removed — Chromium can fire them in addition to `wheel`, double-applying a gesture).
- **Launcher Script (cmm.ps1) Start/Restart/Stop Speed**:
  - `start`/`restart` now build the renderer (Vite) and main process (TypeScript) **in parallel** (with a sequential fallback for Windows PowerShell 5.1), cutting build wall-clock roughly in half on multi-core machines.
  - The GitHub `git ls-remote` update check only contacts the remote if the last check is **> 1h old** and is hard-capped at 4 seconds — flaky DNS/network can no longer stall a launch for many seconds.
  - The C# `Add-Type` window-helper is compiled **lazily on first window focus** instead of on every invocation, so `status`/`stop`/`update`/etc. no longer pay a ~1s compiler round-trip.
  - Waiting for the Vite dev server now **polls the TCP port** until it accepts connections instead of a fixed 2-second sleep (usually ready well before that); restart's settle sleep was cut from 1s to 500ms.
  - `Get-RunningProcs`/`Stop-App` fetch all candidate command lines in a **single unfiltered WMI query** (~1s total) instead of one ~1s per-PID query — `status` went from ~6s to ~2s. (The `Win32_Process ... IN(...)` filter silently returns no rows on some machines, hence the unfiltered table scan.)
- **First-Run `.installed` Marker (all launchers)**:
  - Once a launcher has provisioned the environment (Node + `node_modules` present), it stamps a `.installed` file next to itself. On every later run the launchers **flat-skip the entire installer/dependency block** — no `node`/`npm`/`npx` PATH probing, no winget/MSI fallback, no `npm install` checks.
  - If `node_modules` is later wiped, the marker is invalidated and the full re-provision (and re-stamp) runs again.
  - Applied consistently to `cmm.ps1`, `cmm.sh` (and therefore `cmm.bat`, which delegates to `cmm.ps1`); the marker is git-ignored like `.cmm.pid`.

- **Project Rebranded → Renegade Core Model Manager (RenegadeCMM)**:
  - Display name is now **Renegade Core Model Manager**; the short technical/project identifier is **RenegadeCMM** (repo, `productName`, app id, npm package, binary/installer artifacts). The `ComfyUI Edition` tagline and all legacy "CivitAI Model Manager"-style names were dropped.
  - GitHub URLs (repo, issues, security, donations/docs links) updated to `DevNullInc/RenegadeCMM`; the development-update checker and auto-update metadata now target the new repository.
  - Source headers, UI strings (app title, about, footer), launcher window/process matching (`cmm.sh`/`cmm.ps1`/`cmm-mac.sh`/`cmm.bat`), CRUD backup/import format identifiers, and outbound HTTP `User-Agent` strings updated to the new brand.
  - **Note**: the companion-node detection aliases (`comfyui-model-manager`, `comfyui-civitai-manager-*`), internal identifiers (`window.civitaiAPI`), and DB columns/Uri (`civitai_api_key`, `civitai_version_id`, etc.) that name the third-party **CivitAI platform** are intentionally unchanged.
  - **Action required**: rename the GitHub repository `DevNullInc/Civitai-manager-ComfyUI` → `DevNullInc/RenegadeCMM` so the updated URLs, dev-update checker, and auto-update mechanism work.

### 🛡️ Fixed & Improved

- **Missing-Node Cards Now Show the Hosting Pack Name (registry lookup fixed)**:
  - The ComfyUI-Manager `extension-node-map.json` is keyed by **repository URL**, but `resolveMissingNode` was probing it by node class name (e.g. `nodeMap["TIPO"]`), so it never matched and no node ever got a `managerMatch`. Every missing node therefore fell back to showing its raw class name.
  - Added a **reverse index** (class name → `{ gitUrl, title_aux }`) built from the registry, so missing-node cards now lead with the supplying extension's name — e.g. `TIPO` → **TIPO-extension**, `VHS_VideoCombine` → **VideoHelperSuite**, `ShowText|pysssss` → **ComfyUI-Custom-Scripts** — with the node class beneath it and the pack name fed into the GitHub search.
  - Stale `status='missing'` resolution-cache rows (which had no pack info) are dropped so the next workflow scan re-resolves them against the fixed registry lookup.
- **"Show In Workflow" Works From Every View Mode**:
  - In **Dependency Matrix** view the map container is hidden, so clicking a resolution card's "Show in Workflow" panned/zoomed an invisible (zero-size) canvas — nothing moved. The button now switches to **Split view**, waits a frame, pans/zooms to the node, and scrolls the map into view.
- **Expanded (Fullscreen) Map Has On-Canvas Controls**:
  - The fullscreen map now renders a floating **zoom in/out + zoom % + Fit to View** cluster at the bottom-center and a prominent **close** button at the top-right, directly over the canvas, so controls are always reachable (Esc closes too).
- **Fullscreen Map No Longer Hidden Behind the Footer & Controls Stay Visible**:
  - The expanded map overlay is now **ported to `document.body`**, escaping the tab container's low (`z-10`) stacking context that the persistent sticky footer (`z-40`) painted over. Previously the footer obscured the bottom-center zoom cluster; the overlay now sits above the footer and the zoom/fit cluster is raised off the bottom edge for good measure.
- **Inline Node Map Only Captures Input When Clicked Into**:
  - The collapsed (non-expanded) LiteGraph map no longer swallows mouse-wheel / pointer events on hover, which used to hang up scrolling while moving through the workflow page. It is inert (`pointer-events: none`) until you explicitly click inside it (a click-catcher overlay activates it), and it releases the grab the moment you click anywhere outside the map again. The fullscreen map stays fully interactive.
- **"Search GitHub" Leads With the Pack Name Instead of a Noisy Query**:
  - The browser search previously concatenated `comfyui <nodeClass> <packName>` (e.g. `comfyui easy negative ComfyUI Easy Use`). It now searches just the hosting pack/repo name (e.g. `ComfyUI Easy Use`), falling back to `comfyui <nodeClass>` only when no pack is identified — a repo-title search returns the right extension.
- **ComfyUI Official Registry (registry.comfy.org) Fallback**:
  - Node resolution gained a **Tier 2.5**: when the ComfyUI-Manager community registry misses a node class, the app queries the official ComfyUI Registry (`GET https://api.comfy.org/nodes/search?comfy_node_search=<node>`) for an authoritative node-to-repo match before falling through to a broad GitHub search. Matched nodes get the correct pack name, author, and repo link on their card. Results (including negative/not-found) are cached in SQLite with a 24h TTL.

- **Date-Aware Update Detection (no more false "updates")**:
  - Update checks now compare a version's **upload/publish date** (`publishedAt`, falling back to `createdAt`) rather than a raw version-id mismatch. A model is updatable only when a remote version was uploaded strictly after the installed one; the installed version is located by id and dated directly. This stops older uploads that merely sit lower in the CivitAI list (or carry a different id) from being flagged as updates when the installed file is already the newest-dated version.
  - Browse tab's "Update Available" badge and per-version "✦ [Update]" dropdown tag were updated with the same date-aware logic, so only versions genuinely newer than the newest installed upload are marked.
- **Multi-Install Update Detection (latest-installed-date default)**:
  - When a model is installed for multiple consumers (e.g. one LoRA/checkpoint used by several workflows), update checks now default to the **latest installed date across every copy** rather than a single installed row. Update detection in both `batchCheckAllUpdates` and per-model checks gathers all installed version ids for the model (drawn from every `local_models` row) and compares the newest remote upload against the newest *installed* upload. A file uploaded in between two installs therefore no longer shows a false "update available" when the newest upload is already installed.
  - The Browse grid's "Update Available" badge got the same latest-installed-date baseline, matching the version-selector dropdown tag (which already used it).
- **Click Outside a Popup to Dismiss**:
  - Clicking anywhere on the dimmed/blurred backdrop now closes the top modal, matching common web behavior. The **X** button stays fully functional. Applied to the model detail popup (Browse), the delete-model dialog (Library), the folder-destination prompt, the folder browser, and the paste-JSON modal. Clicking inside a dialog still does nothing but interact with it (no accidental close), and in-flight delete operations are protected from dismissal.
- **Download Queue Persistence Fix (schema migration)**:
  - Older builds shipped a `downloads` table with a drifted column set (`civitai_version_id`/`civitai_model_id`, `local_path`, `downloaded_at`, no `progress`/`computed_path`). `CREATE TABLE IF NOT EXISTS` never rewrote it, so the manager's `INSERT OR REPLACE ... (model_version_id, progress, ...)` silently failed and completed downloads never survived a restart. `db.ts` now reconciles the table to the canonical schema at startup (renames the legacy table, recreates it, migrates surviving rows via a dynamic column map, then drops the legacy table), so persistence actually works.
- **Download Card Controls Actually Respond**:
  - Pause/Resume/Cancel/Force-Complete on the Downloads tab now re-fetch the queue after the backend call (with error handling), so the UI updates immediately instead of waiting for the progress push.
  - The main process no longer suppresses the `download-progress` push when the queue is empty, so cancelling the last download clears its card from the list.
- **Auth-Gated Downloads (CivitAI 401) & Token Preservation**:
  - All `add-download` paths (main IPC, main HTTP `/api/add-download`, vite dev route) now prefer the caller-supplied download URL (preserving any embedded `?token=`) and only build one from the version id when no URL is given, then always append the configured `civitai_api_key` when present. Previously the version-id branch discarded the URL (and its token), so updating auth-gated models could 401.
  - A failed download now shows an actionable message on HTTP 401/403 ("Add your API token in Settings...") instead of a raw Axios error.

- **Hash-Based Update Detection with Sticky Update Flags**:
  - Update detection now checks the installed file's SHA256 against the hashes CivitAI publishes for the newest version (`versionFileMatchesHash`) on top of the version-id comparison, so already-current files never show a false update banner.
  - Checks only run when the **"Check Updates"** button is pressed — no network calls on library load. Results are cached in a new `update_checked_at` column and stale-check filtering supports skipping models whose file hasn't changed since the last check (with a `force` option for manual re-checks).
  - Update badges now persist across library rescans, reloads, and app restarts: the library scanner's `INSERT OR REPLACE` (which previously wiped `has_update`/`update_*`/`ignored_version_id` on every scan) was replaced with an `ON CONFLICT(id) DO UPDATE` that preserves update-check state.
  - Badges clear only when the flagged update is actually installed locally (library load self-clears rows where `civitai_version_id = update_version_id`) or dismissed via the ignore action.
- **Library Update Badge Deep-Links to the Exact CivitAI Model**:
  - Clicking an update badge opens the model's page directly in Browse by its stored CivitAI model **id** (`getModel(id)`), replacing the fuzzy name-string keyword search; unmatched models still fall back to a name query.

- **CivitAI Keyword Search Pagination Fix**:
  - Fixed keyword searches in the Browse tab failing with HTTP 400 (`Cannot use page param with query search. Use cursor-based pagination.`) by no longer sending `page` alongside `query` — keyword searches now use CivitAI's required cursor-based pagination while non-query browsing keeps `page` support.
  - Credit to **haraguchi30** for identifying the root cause and contributing the fix.

- **Process Shutdown Protection & Sanity Checking**:
  - Added strict blacklist protections in `cmm.sh`, `cmm.ps1`, and `src/main/index.ts` forbidding termination of web browsers (`firefox`, `chrome`, `chromium`, `brave`, `opera`, `msedge`, `safari`, `zen-browser`, `tor`) and system processes during `./cmm.sh stop` or `./cmm.sh restart`.
  - Port inspection filtered to `-sTCP:LISTEN` sockets only, preventing client TCP socket connections from being targeted.
  - Verified process binaries and working directories to ensure only internal CMM Electron and Vite dev server processes are stopped.
- **Launcher Security & Exploit Hardening (`cmm.sh` & `cmm.ps1`)**:
  - Enforced strict integer port range validation (`1024`–`65535`) on `--port` and `--api-port` flags to reject malformed arguments and injection attempts.
  - Expanded protected process blacklist across `cmm.sh`, `cmm.ps1`, and `src/main/index.ts` shielding web browsers (`firefox`, `chrome`, `chromium`, `brave`, `opera`, `msedge`, `safari`, `zen-browser`, `tor`, `waterfox`, `librewolf`, `epiphany`, `midori`, `qutebrowser`), terminal emulators, and user shells.
  - Hardened process inspection using `/proc/$pid/exe` (Linux) and WMI `Win32_Process` (Windows) to strictly target CMM-owned Node/Electron processes.
  - Switched background process launching to structured parameter arrays to eliminate word splitting and shell command injection vectors.
- **Deep ComfyUI JSON Format Normalization**:
  - Robust parser supporting direct UI canvas exports, nested `{ workflow: { nodes } }`, API execution prompts `{ "3": { class_type } }`, array node lists, and stringified metadata wrappers (`extra_pnginfo.workflow`, `extra.prompt`).
  - Strict JSON validity verification: immediately alerts user on non-ComfyUI JSON payloads or corrupted files without adding empty 0/0 cards to the queue.
- **Tab State Persistence**:
  - Maintained persistent DOM mounting across all primary navigation tabs (`browse`, `library`, `workflows`, `downloads`, `settings`, `about`) via display styling, preventing component unmounting, scroll resets, and workflow queue clears during tab switching.
- **Workflow Node Map: Fit-to-View & Fullscreen Exit Fixes**:
  - **Fit to View** now resizes the LiteGraph drawing buffer to the visible container *before* computing the fit transform (with a fallback to the canvas size when the host is hidden) and forces an immediate redraw. Previously a stale or zero-sized buffer left the map zoomed into a blank corner, making the button appear to do nothing.
  - The render loop is now resilient: `draw()` is wrapped so a single aberrant node/link can't permanently kill the rAF loop (which previously made the canvas go blank), and rendering is correctly stopped on unmount.
  - The expanded fullscreen map can now be collapsed with the existing **X** button or the **Escape** key; the expand toggle uses a functional state update so rapid toggling can't get stuck.
- **Launcher Banner Box Centering**:
  - Centered the `cmm.sh` / `cmm-mac.sh` / `cmm.ps1` ASCII box title/subtitle: the box was 47 chars wide while the title spanned fewer, leaving the right pipe lopsided, and the macOS subtitle overflowed the box by a character. The box is now 39 chars with symmetric padding, and the macOS subtitle aligns to the same content width.
- **Workflow Map Mousedown Crash (`Cannot read properties of null (reading 'focus')`)**:
  - LiteGraph 0.7.18 cannot remove its own capture-phase listeners: `bindEvents` registers `mousedown`/`mouseup`/`keydown` with `capture=true`, but `unbindEvents` removes them with the default `false` (and passes the wrong callback for `mousemove`). A torn-down `LGraphCanvas` therefore kept its `mousedown` capture listener, whose now-nulled `this.canvas` threw on **every** canvas click — React StrictMode's dev double-mount leaked this immediately. The node map's teardown now removes the exact bound callbacks with matching capture flags (and the pre-existing `setCanvas(null, true)` skip-events detach was replaced with the unbinding variant).
- **Browse Resilient to Aborted API Responses**:
  - CivitAI responses whose body stream is reset after the 200 headers ("GET /models failed (status 200): aborted", Node `ECONNABORTED`) are now classified as transient and retried by the rate limiter instead of one bad response wiping the entire browse grid. `fetchModels` keeps the axios error code/status on the re-wrapped error so the retry classifier can still see it.
- **Embedded Subgraph / Component Nodes No Longer Flagged as Missing Extensions**:
  - Workflow nodes whose `type` is a UUID (component/subgraph references embedded in the workflow file — e.g. an "Easy Negative" component) are skipped when collecting custom node classes, so they never surface as missing extensions to install; the map still shows their friendly titles.
