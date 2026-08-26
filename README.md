# CivitAI Model Manager (CMM)

**The missing model manager for ComfyUI.** A unified desktop application for discovering, downloading, organizing, and version-managing generative AI models across multiple CivitAI sources with intelligent auto-sorting into ComfyUI's folder structure.

![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey.svg)

---

## 🎯 Why CMM?

If you've been manually downloading models from CivitAI, creating folders, moving files, and losing track of what you have, this tool is for you. CMM acts as a **Steam-like library manager** for your AI models:

- **Auto-organizes** downloads into the correct ComfyUI folders (checkpoints → `checkpoints/`, LoRAs → `loras/`, etc.)
- **Tracks versions** - know when updates are available and downgrade if needed
- **Dual-source support** - search both civitai.com and civitai.red
- **Duplicate detection** - find identical models by hash across different folders and resolve with one-click cleanup
- **Hardware-accelerated hash verification** - 64MB streaming buffer utilizing CPU SHA-NI / AVX-512

---

## ✨ Features

### 🔍 Discovery & Search
- Search across CivitAI's entire model database
- Filter by **Base Model**: SD 1.5, SDXL 1.0, Illustrious, Flux.1 D, Pony, Qwen, Wan Video, and more
- Filter by **Model Type**: Checkpoint, LoRA, LyCORIS, Embedding, VAE, ControlNet, Upscaler, etc.
- Filter by **Rating**: SFW-only or include NSFW content
- Sort by: Most Downloaded, Highest Rated, Newest, Trending

### 📥 Download Management
- **Intelligent auto-sorting**: Downloads route to the correct ComfyUI folder automatically
- **Resume support**: Interrupted downloads resume where they left off
- **Hash verification**: SHA256 verification ensures file integrity
- **Queue system**: Download multiple models with priority management
- **API key support**: Higher rate limits and access to gated content

### 📁 Library Management
- **Multi-folder support**: Scan and manage models across multiple drives/paths
- **Duplicate detection & resolution**: Interactive keeper picker with full folder path comparison
- **Version tracking**: See installed versions vs. latest available
- **Update notifications**: One-click updates when new versions release
- **Side-by-side versions**: Keep multiple versions of the same model

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
# AppImage
chmod +x CivitAI-Model-Manager-<version>.AppImage
./CivitAI-Model-Manager-<version>.AppImage

# Or build from source (see Contributing)
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

# 6. Build standalone executable (.exe) and installer in ./release/
.\cmm.ps1 package

# 7. Stop all running application instances cleanly
.\cmm.ps1 stop
```

#### Packaging Standalone Binaries & Installers

You can compile standalone binaries using `cmm.ps1` or npm scripts:

```powershell
# Build both Portable Standalone .exe and NSIS Setup installer
.\cmm.ps1 package

# Or via npm scripts:
npm run dist:portable    # Single standalone .exe (runs directly without installation)
npm run dist:installer   # Standard Windows Setup installer (.exe)
npm run dist:dir         # Unpacked application folder
npm run dist:all         # Cross-platform builds (Windows & Linux)
```

Outputs will be saved in the `release/` directory:
- `CivitAI Model Manager-Standalone-v<version>.exe` (Portable binary)
- `CivitAI Model Manager Setup <version>.exe` (Installer binary)

#### Script Parameters & Flags Reference

| Parameter / Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `Action` | `string` | `start` | Operation to execute: `start`, `stop`, `restart`, `status`, or `package` (`dist`). |
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

### Searching for Models
1. Go to **Browse** tab
2. Enter search terms (e.g., "anime style", "photorealistic")
3. Apply filters:
   - **Base Model**: SDXL 1.0, Illustrious, Flux.1 D, etc.
   - **Type**: Checkpoint, LoRA, Embedding, etc.
   - **Rating**: Toggle NSFW content
4. Click **Search**

### Downloading
1. Click on a model to view details
2. Select version from dropdown (if multiple)
3. Click **Download**
4. File automatically routes to correct folder

### Managing Your Library
- **Library** tab shows all local models
- Green check = Matched with CivitAI
- Amber badge = Duplicate detected on disk
- Gray question = Unidentified (not found on CivitAI)

### Resolving Duplicate Models
1. In the **Library** tab, filter by "Duplicates" or click the amber **Duplicate (X)** badge on any model.
2. The row expands inline to show all duplicate copies sharing the same SHA256 checksum.
3. Inspect each copy's full folder location (`D:\ComfyUI\models\...`), file size, and last modified date.
4. Click **Show in Folder** to open the containing folder and highlight the file in Windows Explorer.
5. Select the **radio button** next to the copy you want to designate as the **Keeper**.
6. Click **Keep Selected & Delete Other Copy(ies)** to safely delete non-keeper duplicates from disk and update the library.

### Updating Models
1. Go to **Library** tab
2. Filter by "Updates Available"
3. Select models to update
4. Click **Update Selected**
5. Choose: Replace existing or Keep both versions

### Version Management
- Right-click any model → **View Versions**
- See changelog between versions
- Downgrade to previous version if needed
- Install multiple versions side-by-side

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

## 🙏 Acknowledgments

- [CivitAI](https://civitai.com) for the amazing platform and API
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) for the incredible node-based interface
- The generative AI community for creating and sharing models

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/DevNullInc/Civitai-manager-ComfyUI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DevNullInc/Civitai-manager-ComfyUI/discussions)

---

**Happy modeling! 🎨**