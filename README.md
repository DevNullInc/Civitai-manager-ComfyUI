# CivitAI Model Manager (CMM)

**The missing model manager for ComfyUI.** A unified desktop application for discovering, downloading, organizing, and version-managing generative AI models across multiple CivitAI sources with intelligent auto-sorting into ComfyUI's folder structure.

![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey.svg)

---

## 🎯 Why CMM?

If you've been manually downloading models from CivitAI, creating folders, moving files, and losing track of what you have, this tool is for you. CMM acts as a **Steam-like library manager** for your AI models:

- **Auto-organizes** downloads into the correct ComfyUI folders (checkpoints → `checkpoints/`, LoRAs → `loras/`, etc.)
- **Persistent Background Scanning** - scan thousands of models in the background across tabs with a live, real-time footer widget and instant cancellation (after final SHA256 on the last scanned file)
- **Multi-Criteria Library Sorting** - sort local models by Name, Model Type, File Size, or Date Modified (Ascending / Descending)
- **Browse Tab Update Badging & Selective Update Ignoring** - see instant `Installed` or `Update Available` flags on browse cards; ignore specific updates that target different base models
- **Safe Version Updating with Old File Removal** - optionally delete superseded previous versions safely *only after* the update download completes 100% and passes SHA256 verification
- **Intentionally Duplicated Sets** - ignore duplicate sets required across specific custom node paths with automatic re-alerting if a new copy is detected
- **Dual Delete Modes** - choose to remove models from library catalog only or permanently delete from disk & library
- **LLM & HuggingFace Hub Cache Support** - parses human-readable folder names from `/blobs/<hash>` cache structures with responsive UI layout protection
- **Multi-Path Download Routing** - pick target destination when multiple ComfyUI root paths are configured with "Always use this folder" preference
- **Complete System Backup & Restore (.ZIP)** - export/import your entire model database, configuration, download history, and ignore lists in a standard portable `.zip` archive
- **Single-Instance Windowing** - focuses existing running window automatically rather than spawning duplicate instances
- **Dual-source support** - search both civitai.com and civitai.red
- **Hardware-accelerated hash verification** - 64MB streaming buffer utilizing CPU SHA-NI / AVX-512

---

## ✨ Features

### 🔍 Discovery & Search
- Search across CivitAI's entire model database
- **Installed & Update Indicators**: Model cards feature instant emerald **`Installed`** or amber **`Update Available`** badges
- Filter by **Base Model**: SD 1.5, SDXL 1.0, Illustrious, Flux.1 D, Pony, Qwen, Wan Video, and more
- Filter by **Model Type**: Checkpoint, LoRA, LLM, LyCORIS, Embedding, VAE, ControlNet, Upscaler, etc.
- Filter by **Rating**: SFW-only or include NSFW content with configurable blur levels
- Sort by: Most Downloaded, Highest Rated, Newest, Trending

### 📥 Download Management & Version Updating
- **Intelligent auto-sorting**: Downloads route to the correct ComfyUI folder automatically
- **Multi-Path Destination Prompt**: Choose target directory when multiple folder roots are configured, with "Always use this folder" toggle
- **Safe Previous Version Cleanup**: Option to delete previous versions only after the update file finishes downloading 100% and passes SHA256 verification
- **Resume support**: Interrupted downloads resume where they left off
- **Hash verification**: SHA256 verification ensures file integrity
- **Queue system**: Download multiple models with priority management
- **API key support**: Higher rate limits and access to gated content

### 📁 Library Management & Persistent Scanner
- **Persistent Background Scanning**: Folder indexing continues seamlessly across tab switches
- **Draggable Floating HUD**: Real-time progress percentage, active file status, and instant stop controls
- **Multi-Criteria Sorting**: Sort by Name (A-Z), Model Type, File Size, or Date Modified (Asc / Desc) with saved preferences
- **Dual Delete Modes**: Separate "Remove from Library Only" and "Delete from Disk & Library" dialog options
- **LLM & HuggingFace Hub Cache Resolution**: Converts raw `/blobs/<hash>` names into clean, readable model folder titles (e.g. `models--Org--ModelName`) with responsive layout protection
- **Duplicate Detection & Consolidation**: Consolidates duplicate copies into single master cards in the Duplicates tab with interactive keeper selection
- **Ignore Intentionally Duplicated Sets**: Suppress duplicate warnings for models needed across specific custom node paths, with automatic re-flagging if new duplicate copies are discovered
- **Selective Update Ignoring**: Mark version updates as ignored so LoRAs or Checkpoints uploaded for different base models don't trigger unwanted update badges

### ⚙️ System Backup & Diagnostics
- **Complete System Backup & Restore (.ZIP)**: Create and restore comprehensive `.zip` archives containing your raw SQLite database, model catalog, download records, folder settings, and ignore sets
- **Quick Config Sharing**: Direct clipboard copy and paste for quick pattern rule and settings sharing
- **Console Feedback & Diagnostics**: Built-in system log capture and one-click diagnostic report generation for bug reports
- **Single-Instance Management**: Automatically detects and focuses existing application windows

### 🔧 ComfyUI Integration
- Recognizes **50+ specialized folders** (ipadapter, photomaker, pulid, reactor, sam3, ultralytics, etc.)
- **Filename pattern matching**: Routes `ip-adapter_*.safetensors` to `ipadapter/`, `*.gguf` to `gguf/`, etc.
- **Custom folder mappings**: Override defaults to match your workflow
- **Workflow detection**: Scans `workflows/` folder for embedded model references

---

## 📦 Installation

### Windows
```bash
# Download the latest release from GitHub (Assets)
CivitAI-Model-Manager-Setup-<version>.exe
# Or portable standalone:
CivitAI-Model-Manager-Standalone-<version>.exe

# Or install via winget (when available)
winget install CivitAI.ModelManager
```

### Linux
```bash
# Extract standalone Linux release bundle
tar -xzf civitai-model-manager-<version>.tar.gz
cd civitai-model-manager-<version>
./civitai-model-manager

# Or AppImage (when building on Linux/CI)
chmod +x CivitAI-Model-Manager-<version>.AppImage
./CivitAI-Model-Manager-<version>.AppImage
```

### Build & Run from Source

```bash
git clone https://github.com/DevNullInc/Civitai-manager-ComfyUI.git
cd Civitai-manager-ComfyUI

# Install dependencies
npm install
```

#### 🚀 Recommended: Launch with `cmm.ps1` (PowerShell)

The included `cmm.ps1` script is the primary launcher and controller for starting, stopping, restarting, and managing background processes.

```powershell
# 1. Start Electron desktop application + Web UI (port 5173)
.\cmm.ps1 start

# 2. Start on a custom port
.\cmm.ps1 start -Port 8080

# 3. Start in Headless / Web-only mode (No Electron desktop window)
.\cmm.ps1 start -Headless
# (or use -NoWindow)

# 4. Check application running status and active process IDs
.\cmm.ps1 status

# 5. Build standalone executables and release bundles in ./release/
.\cmm.ps1 package
# (alias: .\cmm.ps1 publish)

# 6. Stop all running application instances cleanly
.\cmm.ps1 stop
```

#### Packaging Standalone Binaries & Cross-Platform Releases

You can compile standalone binaries using `cmm.ps1`, the dedicated release builder script `build-release.ps1`, or npm scripts:

```powershell
# Build Windows portable standalone .exe and NSIS setup installer
.\build-release.ps1 -Target win

# Build Linux standalone release bundle (.tar.gz)
.\build-release.ps1 -Target linux

# Build all cross-platform targets (Windows + Linux)
.\build-release.ps1 -Target all

# Or via npm scripts:
npm run dist:portable    # Single standalone .exe (runs directly without installation)
npm run dist:installer   # Standard Windows Setup installer (.exe)
npm run dist:linux       # Standalone Linux archive (.tar.gz)
npm run dist:all         # All release targets
```

Outputs will be saved in the `release/` directory:
- `CivitAI Model Manager-Standalone-v<version>.exe` (Windows Portable binary)
- `CivitAI Model Manager Setup <version>.exe` (Windows Installer binary)
- `civitai-model-manager-<version>.tar.gz` (Linux Standalone distribution)

#### Script Parameters & Flags Reference

| Parameter / Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `Action` | `string` | `start` | Operation to execute: `start`, `stop`, `restart`, `status`, `package`, or `publish`. |
| `-Port <int>` | `int` | `5173` | Port for the Vite web server & HTTP bridge. |
| `-Headless` | `switch` | `false` | Runs background server and web UI without launching the Electron desktop window. Ideal for remote servers, Docker, WSL, or browser-only workflows. |
| `-NoWindow` | `switch` | `false` | Alias for `-Headless`. |

---

## 🚀 Quick Start

### 1. First Launch Setup
On first run, CMM will ask for:
- **ComfyUI Root Path**: The folder containing your `models/` directory (e.g., `D:\ComfyUI\models`)
- **CivitAI API Key** (optional but recommended): Get yours at [CivitAI Settings](https://civitai.com/user/account)

### 2. Scan Existing Library & Resolve Duplicates
```
Library → Scan ComfyUI Folders → Start Scan
```
CMM will:
- Walk all configured model directories
- Stream 64MB buffer chunks with CPU SHA-NI / AVX-512 hardware acceleration
- Match models in bulk against the CivitAI database
- Automatically flag duplicate files sharing the same SHA256 checksum
- **Inline Duplicate Resolution**: Click the **`Duplicate`** badge on any item to view all copies, compare folder paths, open files in Explorer, and choose which file to keep with one-click cleanup!

### 3. Search and Download
```
Browse → Search "realistic vision" → Select model → Download
```
The model automatically routes to the correct folder (e.g., `checkpoints/`, `loras/`, `upscale_models/`). Auto-cascades preview images across all version assets if an image URL returns 404 or 401.

---

## ⚙️ Configuration

### Folder Mappings
Edit `config.json` to customize where model types are saved:

```json
{
  "comfyui_root": "D:\\ComfyUI\\models",
  "folder_mappings": {
    "Checkpoint": "checkpoints",
    "LORA": "loras",
    "LoCon": "loras",
    "DoRA": "loras",
    "TextualInversion": "embeddings",
    "Hypernetwork": "hypernetworks",
    "VAE": "vae",
    "Controlnet": "controlnet",
    "Upscaler": "upscale_models",
    "MotionModule": "model_patches",
    "Wildcards": "wildcards",
    "Workflows": "workflows",
    "Detection": "detection"
  },
  "advanced_mappings": {
    "filename_patterns": [
      { "pattern": "ip-adapter", "folder": "ipadapter" },
      { "pattern": "photomaker", "folder": "photomaker" },
      { "pattern": "\\.gguf$", "folder": "gguf" },
      { "pattern": "llm|qwen", "folder": "LLM", "case_sensitive": false }
    ]
  },
  "organize_by": {
    "base_model": false,
    "creator": false
  }
}
```

### API Sources
Add multiple CivitAI sources in Settings:

| Source | URL | API Key Required |
|--------|-----|------------------|
| CivitAI | `https://civitai.com` | Optional (recommended) |
| CivitAI.red | `https://civitai.red` | Optional |

---

## 📂 Supported Folder Structure

CMM recognizes and manages models in these ComfyUI folders:

### Core Model Folders
- `checkpoints/` - Main SD checkpoints
- `loras/` - LoRA, LoCon, DoRA adapters
- `embeddings/` - Textual Inversions
- `hypernetworks/` - Hypernetworks
- `vae/` - VAE files
- `controlnet/` - ControlNet models
- `upscale_models/` - ESRGAN, SwinIR, etc.

### Specialized Folders
- `clip/` - CLIP models
- `clip_vision/` - CLIP Vision encoders
- `text_encoders/` - T5, text encoders
- `diffusion_models/` - Standalone diffusion models
- `unet/` - UNet models
- `gguf/` - GGUF quantized models
- `ipadapter/` - IP-Adapter models
- `photomaker/` - PhotoMaker models
- `pulid/` - PuLID models
- `reactor/` - ReActor models
- `insightface/` - InsightFace models
- `facerestore_models/` - Face restoration
- `ultralytics/` - Ultralytics models
- `yolo/` - YOLO detection models
- `sam3/` - Segment Anything v3
- `frame_interpolation/` - Video frame interpolation
- `optical_flow/` - Optical flow models
- `latent_upscale_models/` - Latent upscalers

### Utility Folders
- `wildcards/` - Wildcard text files
- `workflows/` - ComfyUI workflows
- `detection/` - Detection models
- `configs/` - Model configs
- `style_models/` - Style models
- `gligen/` - GLIGEN models
- `TTS/` - Text-to-speech
- `LLM/` - Large language models

---

## 🎮 Usage Guide

### Searching & Browsing Models
1. Go to **Browse** tab.
2. Search terms or filter by Base Model, Model Type, and NSFW preferences.
3. **Instant Installed / Update Badges**:
   - **`Installed`** (Emerald badge): Indicates this model is already present in your local library.
   - **`Update Available`** (Amber badge): Indicates a newer version of an installed model is available on CivitAI.
4. **Selective Update Ignoring**: Click on a model with an update available to view version details. If the new upload is for a different base model (e.g. SDXL vs SD 1.5), click **Ignore This Update** to prevent it from flagging as an update.

### Downloading & Safe Version Updating
1. Click on any model card to open the Details modal.
2. Select your desired version from the version selector dropdown.
3. **Destination Selection**: If multiple ComfyUI root paths are configured, CMM prompts you to choose the target folder, with an option to remember your choice.
4. **Safe Old Version Cleanup**: When downloading an update, check **"Delete previous version upon completion"**. The superseded old file will *only* be deleted after the update has completed downloading 100% and verified its SHA256 integrity hash.

### Managing & Deleting Library Models
- **Library** tab displays all indexed models across all configured ComfyUI directories.
- **Sorting**: Order models by **Name (A-Z)**, **Model Type**, **File Size**, or **Date Modified**, with instant Ascending/Descending toggle.
- **Dual Delete Modes**:
  - Click the trash icon on any card to open the delete confirmation modal.
  - **Remove from Library Only**: Removes the database record and catalog cache while preserving the physical file on disk for ComfyUI workflows.
  - **Delete from Disk & Library**: Permanently deletes the `.safetensors` file from your hard drive and removes its database entry.
- **Safety Prompt on Clear Library**: The **Clear Library** button requires explicit confirmation to prevent accidental catalog wipes.

### 👥 Duplicate Resolution & Ignored Duplicate Sets
1. Click the **Duplicates** filter tab in the Library.
2. Each unique duplicate group is consolidated into a single master card with all copies listed.
3. **Keep Selected & Delete Others**: Select which copy to keep with the radio button and click the delete button to remove redundant copies from disk.
4. **Ignore This Duplicate Set**: If a model must exist in multiple paths (e.g., specific custom node requirements), click **Ignore This Duplicate Set**. This records the SHA-256 in the database and suppresses duplicate warnings until a new, unexpected copy is discovered during a future scan.

### 🔄 Persistent Background Scanning & Floating HUD
1. Click **Scan ComfyUI Folders** in the Library tab.
2. The scanner operates as a global background provider—you can switch between Browse, Downloads, Settings, or About tabs while scanning proceeds uninterrupted.
3. A **draggable floating HUD widget** appears at the bottom of the screen displaying real-time progress, currently scanned file name, and indexing phase.
4. **Instant Cancellation**: Stop scanning at any time by clicking the red **Stop Scanning** button in the Library tab or the **Stop** icon on the floating HUD.

### 📦 Complete System Backup & Restore (.ZIP)
1. Go to the **Settings** tab.
2. In the **Complete System Backup & Restore (.ZIP)** card:
   - **Create Backup (.ZIP)**: Generates and downloads a complete standard `.zip` archive containing your SQLite database (`database.sqlite`), model catalog (`models.json`), download history (`downloads.json`), directory paths and pattern rules (`config.json`), and ignore lists.
   - **Restore Backup (.ZIP)**: Select any `.zip` backup archive (or legacy `.json` file) to restore your entire library state, download queue records, and configurations.
   - **Copy Config / Paste Config**: Quickly copy or paste raw JSON settings for fast pattern rule sharing across browsers.

### ℹ️ About & Diagnostics Reporting
1. Navigate to the **About** tab.
2. View application version information, author credits (**TheStygianRenegade / /dev/null Inc**), license details (GPL-3.0), and active runtime telemetry.
3. Under **Diagnostic Log & Console Feedback**:
   - Inspect live system event logs, scanner output, and network diagnostics.
   - Click **Copy Diagnostic Report** to generate a pre-formatted Markdown summary (including OS, version, active directory count, and recent console warnings/errors) ready to paste into GitHub Issues for instant troubleshooting.

---

## 🔐 API Key Setup

### Getting Your CivitAI API Key
1. Log in to [CivitAI](https://civitai.com)
2. Go to **User Menu** → **Settings** → **Account**
3. Scroll to **API Keys**
4. Click **Add API Key**
5. Copy the key (starts with `civitai_...`)

### Adding to CMM
```
Settings → API Sources → CivitAI → Paste Key → Test Connection
```

**Benefits of API Key:**
- Higher rate limits (more searches/downloads per minute)
- Access to early-access models
- Download gated/private models you have access to
- Better download speeds

---

## 🛠️ Troubleshooting

### Downloads Failing
- **Check API Key**: Unauthenticated users have stricter rate limits
- **Check Disk Space**: Large checkpoints (6-7GB) require sufficient space
- **Check Permissions**: Ensure CMM has write access to model folders

### Models Not Auto-Sorting
- Verify **ComfyUI Root Path** in settings points to your `models/` folder
- Check **Folder Mappings** in config match your structure
- Some rare model types may need manual mapping

### Hash Mismatch After Download
- Delete the `.part` file and retry
- Check internet connection stability
- Verify file isn't corrupted on CivitAI (rare)

### Scan Taking Forever
- First scan computes SHA256 for all files (normal for large libraries)
- Subsequent scans are incremental
- You can exclude folders from scanning in settings

### "Model Not Found on CivitAI"
- Some models are removed or set to private
- Local files will still work in ComfyUI
- You can manually add metadata if desired

---

## 🧪 Advanced Features

### Command Line Interface
```bash
# Scan library
cmm scan --path /path/to/comfyui

# Download specific model
cmm download --id 827184 --version 2514310

# Check for updates
cmm check-updates

# Export library
cmm export --format json --output backup.json
```

### Webhook Integration
Configure webhooks for download completion:
```json
{
  "webhooks": {
    "on_download_complete": "http://localhost:8080/cmm/webhook",
    "on_update_available": "http://localhost:8080/cmm/update"
  }
}
```

### Backup and Restore
```
Settings → Backup → Create Backup
```
Creates a zip containing:
- Database of all models
- Configuration files
- Download history

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

By contributing to this project, you agree that your contributions will be licensed under the GPL-3.0 license.

### Development Setup
```bash
git clone https://github.com/DevNullInc/Civitai-manager-ComfyUI.git
cd Civitai-manager-ComfyUI

# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm test

# Build
npm run build
```

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

### License Summary

| Permission | Condition |
|------------|-----------|
| ✅ Commercial use | 📋 License and copyright notice must be included |
| ✅ Modification | 📋 State changes must be disclosed |
| ✅ Distribution | 📋 Source code must be made available |
| ✅ Patent use | 📋 Same license applies to derivatives |
| ✅ Private use | |

**Key Points:**
- You **CAN** use this software commercially
- You **CAN** modify and distribute it
- If you distribute modified versions, you **MUST** release the source code under GPL-3.0
- You **MUST** preserve copyright notices and provide attribution
- This license includes an express grant of patent rights from contributors

For the full legal text, see [https://www.gnu.org/licenses/gpl-3.0.en.html](https://www.gnu.org/licenses/gpl-3.0.en.html)

---

## 🙏 Author & Acknowledgments

- **Lead Developer / Maintainer**: **TheStygianRenegade** / **/dev/null Inc**
- [CivitAI](https://civitai.com) for the amazing platform and API
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) for the incredible node-based interface
- The generative AI community for creating and sharing models

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/DevNullInc/Civitai-manager-ComfyUI/issues)
- **Vulnerability Reporting**: [GitHub Security](https://github.com/DevNullInc/Civitai-manager-ComfyUI/security)
- **Discussions**: [GitHub Discussions](https://github.com/DevNullInc/Civitai-manager-ComfyUI/discussions)

---

**Happy modeling! 🎨**