# ⚡ CivitAI Model Manager (ComfyUI Edition) — Feature Crib-Notes

> **The TL;DR feature breakdown for anyone who wants the quick crib-notes without scrolling through long docs.**

---

## 🎯 At A Glance

* **Desktop App & Web UI in One**: Run as a native Electron desktop window or open `http://127.0.0.1:5173` in any browser.
* **100% Cross-Platform**: Works natively on **Linux**, **Windows**, and **macOS** (Apple Silicon & Intel).
* **Zero Cloud Lock-In**: Stores everything in a lightning-fast local SQLite database.

---

## 📦 1. Model Discovery & Catalog

* **Direct CivitAI Catalog Browsing**: Search, filter, and inspect thousands of Checkpoints, LoRAs, ControlNets, VAEs, Upscalers, and Motion Modules inside the app.
* **Hugging Face Hub Integration**: Inspect HF repositories directly, validate gated-model API tokens, and resolve model files.
* **Mirror & CivitAI Red Support**: Switch between standard CivitAI endpoints and custom mirrors.
* **NSFW Filter Slider**: Configurable blur/unblur and rating level gates (PG to XXX) with 1-click toggling.

---

## 📥 2. Download Queue & Smart Routing

* **Automated Folder Routing**: Automatically routes downloads into ComfyUI's standard directories (`checkpoints/`, `loras/`, `vae/`, `controlnet/`, `diffusion_models/`, `upscale_models/`, `text_encoders/`, etc.).
* **Automatic Subfolder Scaffolding**: If any standard ComfyUI model subdirectories are missing from your storage folders, CMM builds them on the fly.
* **Queue Management**: Multi-file concurrent downloads with pause, resume, cancel, speed throttling, and inline progress tracking.
* **Custom Filename Regex Patterns**: Map custom keywords (e.g. `ip-adapter`, `pulid`, `gguf`, `unet`) to specific custom folders.
* **Duplicate Conflict Handling**: Choose how to handle filename collisions (Rename, Replace, Skip, or Prompt).
* **SHA-256 Hash Verification**: Compares downloaded checksums against CivitAI for tamper protection.

---

## 📚 3. Local Library & Ghost Model Resurrector

* **Instant Search & Filter**: Search your installed model collection by base model (SD 1.5, SDXL, Flux.1, SD3, Pony, Illustrious, AuraFlow), creator, model type, or keyword.
* **Missing on Disk ("Ghost Model") Detector**:
  * Automatically flags models that exist in your database but are missing from your disk (e.g. after importing a backup on a fresh machine).
  * **1-Click "Download Model" (Hash Match)**: Queries CivitAI by SHA-256 hash or version ID and pulls missing files directly to disk.
  * **Batch "Download All Missing Models"**: Queue all missing assets at once.
* **Backup & Restore**: Export and import full library archives (JSON metadata and ZIP backups).

---

## 🔄 4. Automated Updates & Version Tracking

* **1-Click Update Checker**: Compares all local models against CivitAI API for newer revisions, bugfixes, and v2 releases.
* **Update Badging**: Shows update tags on model cards with changelogs and download buttons.
* **Ignore List**: Mute updates for specific model versions you don't want to change.

---

## 🗺️ 5. Interactive Workflows & Dependency Engine

* **Saved Workflows Selector Dropdown**: Instantly dropdown-select existing `.json` and `.png` workflows discovered in your ComfyUI directories (`workflows/`, `user/default/workflows/`).
* **Visual Spatial Node Map**: Full interactive pan/zoom canvas displaying nodes, bezier connections, and readiness color codes.
* **Dual PNG Metadata Extraction**: Parses embedded workflow and prompt graphs from ComfyUI generated `.png` images in-memory.
* **Model Dependency Matrix**: Lists required checkpoints, LoRAs, and VAEs with installed vs. missing status and 1-click downloads.
* **4-Tier Custom Node Resolver**:
  1. *Local Check*: Inspects installed `custom_nodes/` extensions.
  2. *Registry Cache*: Checks ComfyUI-Manager registry database.
  3. *GitHub Fallback*: Queries GitHub Search API for unindexed nodes and repositories.
  4. *1-Click Clone & Install*: Clones custom node repositories and auto-installs Python dependencies (`requirements.txt`).

---

## 🔌 6. Companion Node & Local API Bridge

* **Official Companion Custom Node (`ComfyUI-Model-Manager`)**: Companion node providing in-graph nodes (`CMMDownloadModel`, `CMMInspectWorkflow`, `CMMCheckHuggingFace`).
* **Localhost HTTP API Bridge (`http://127.0.0.1:5174`)**: REST API allowing external tools and ComfyUI nodes to scan, query, download, and parse workflows locally.
* **Webhook Automation**: Dispatches webhooks on `on_download_complete` and `on_update_available`.

---

## 💻 7. CLI Runner & Power-User Tools

* **Full CLI Suite (`cmm`)**:
  * `cmm scan --path <dir>`: Scan local folders into database.
  * `cmm download --id <id> --version <vid>`: Download models from terminal.
  * `cmm check-updates`: Check library for new versions.
  * `cmm export --format <json|zip>`: Backup configuration and models.
  * `cmm hf check <repo_id>`: Inspect Hugging Face repos.
  * `cmm workflows --path <dir>`: Scan and extract workflow model dependencies.

---

## 🚀 8. Developer Tools & Launchers

* **Single-Command Launchers**: `./cmm.sh` (Linux/macOS) and `.\cmm.ps1` / `cmm.bat` (Windows).
* **1-Command Self-Updater**: `./cmm.sh update` or `.\cmm.ps1 update` automatically pulls the latest commits, installs dependencies, and rebuilds.
* **Non-Blocking Dev Update Alerts**: Fixed top banner notifies developers if a newer commit is available on GitHub `main`.
* **Release Mode Switcher**: `npm run mode:release` / `npm run mode:dev` cleans all dev alerts before building production release binaries.
