# 🔌 CivitAI Model Manager (CMM) — Local API Reference

This document provides complete documentation and code examples for developers building **ComfyUI Custom Nodes**, scripts, and local extensions that integrate with CivitAI Model Manager via its native HTTP API bridge.

---

## 🔒 Security & Localhost Isolation

For the protection of the user's local filesystem and machine security, CMM's HTTP Server Bridge is strictly isolated:

- **Binding Address:** `127.0.0.1:<port>` (Default port: **`5174`**).
- **Settings Toggle:** The API Bridge can be switched **ON** or **OFF** at any time inside the app's **Settings tab** under *Localhost HTTP API Bridge*.
- **Custom Port Selection:** The port can be customized in Settings or on launch to avoid port collisions (e.g. `./cmm.sh start --api-port 5175` or `.\cmm.ps1 start -ApiPort 5175` or setting `API_PORT=5175`).
- **Localhost Only:** Any incoming socket whose remote IP address is not `127.0.0.1` or `::1` is immediately rejected with HTTP 403 Forbidden.
- **CSRF & Origin Protection:** Non-local web origins attempting cross-origin requests from external browser pages are blocked.
- **No Cloud/Remote Exposure:** The API is never exposed to the local network (LAN) or public internet.

---

## 🚀 Quick Start for ComfyUI Node Developers (Python)

When building ComfyUI custom nodes, allow the user to optionally specify a port (or full URL) while automatically falling back to the default `5174`:

```python
import requests

class CMMClient:
    """
    Client helper for ComfyUI custom nodes connecting to CivitAI Model Manager.
    Automatically defaults to port 5174 if no port or base_url is provided.
    """
    def __init__(self, port: int = 5174, base_url: str = None):
        if base_url:
            self.base_url = base_url.rstrip("/")
        else:
            self.base_url = f"http://127.0.0.1:{port or 5174}"

    def is_online(self) -> bool:
        """Verify if CivitAI Model Manager is running and the API Bridge is enabled."""
        try:
            res = requests.get(f"{self.base_url}/api/status", timeout=1.5)
            return res.status_code == 200 and res.json().get("status") == "online" and res.json().get("enabled") is True
        except requests.RequestException:
            return False

    def parse_workflow(self, workflow_data: dict) -> dict:
        """Inspect a raw workflow / prompt dictionary directly in-memory to detect missing models."""
        res = requests.post(f"{self.base_url}/api/workflows", json={"workflow": workflow_data})
        return res.json()

    def download_model(self, model_name: str, model_type: str, model_version_id: int, base_model: str = "SDXL 1.0"):
        """Trigger an automatic model download into the user's configured folder structure."""
        payload = {
            "fileName": f"{model_name}.safetensors",
            "modelType": model_type,
            "baseModel": base_model,
            "modelVersionId": model_version_id
        }
        res = requests.post(f"{self.base_url}/api/add-download", json=payload)
        return res.json()

# Example Usage:
# 1. Default (Port 5174):
cmm = CMMClient()

# 2. Custom Port if the user started CMM on a different port:
# cmm = CMMClient(port=5180)
```

---

## 📑 API Endpoints Reference

### 1. Health & Server Status

#### `GET /api/status`

Checks if CMM is running, whether the API Bridge is enabled, and returns the active port.

- **Response `200 OK` (When Enabled):**

```json
{
  "status": "online",
  "enabled": true,
  "name": "CivitAI Model Manager",
  "version": "1.3.0",
  "port": 5174,
  "host": "127.0.0.1",
  "localhostOnly": true
}
```

- **Response `200 OK` (When Disabled via Settings Toggle):**

```json
{
  "status": "disabled",
  "enabled": false,
  "name": "CivitAI Model Manager",
  "version": "1.3.0",
  "port": 5174,
  "host": "127.0.0.1",
  "localhostOnly": true
}
```

*(When disabled, external API endpoints return `503 Service Unavailable` with `{"error": "Local API Bridge is disabled in Settings."}`)*

---

### 2. Configuration & Folders

#### `GET /api/config`

Retrieves current app configuration including ComfyUI paths, folder mappings, conflict strategies, and webhook settings.

#### `POST /api/save-config`

Updates configuration keys.

- **Body:** JSON object matching partial `AppConfig`.

---

### 3. Local Library & Model Queries

#### `GET /api/local-models`

Returns all indexed models from the local SQLite database.

- **Response `200 OK`:**

```json
[
  {
    "id": 1,
    "filePath": "/home/user/ComfyUI/models/checkpoints/juggernautXL.safetensors",
    "fileName": "juggernautXL.safetensors",
    "fileSize": 6938000000,
    "modifiedAt": 1718000000,
    "sha256": "4b7b...",
    "civitaiModelId": 133005,
    "civitaiVersionId": 782002,
    "previewUrl": "https://image.civitai.com/...",
    "modelType": "Checkpoint",
    "isMatched": true,
    "isDuplicate": false
  }
]
```

#### `POST /api/scan-library`

Initiates an asynchronous background scan of a specified models directory or configured ComfyUI root.

- **Body:**

```json
{
  "rootPath": "/path/to/ComfyUI/models"
}
```

#### `GET /api/get-scan-status`

Returns current progress of active library scan.

- **Response `200 OK`:**

```json
{
  "isScanning": false,
  "progress": 100,
  "currentFile": "",
  "processed": 420,
  "total": 420
}
```

---

### 4. CivitAI Queries & Downloads

#### `POST /api/search-models`

Searches CivitAI models via proxy query parameters.

- **Body:**

```json
{
  "query": "realism",
  "types": ["LORA"],
  "baseModels": ["Flux.1 D"],
  "limit": 20
}
```

#### `GET /api/model/:id`

Fetches detailed metadata for a specific CivitAI Model ID.

#### `GET /api/version/:id`

Fetches metadata and download URLs for a specific CivitAI Model Version ID.

#### `POST /api/add-download`

Queues a model for automatic download and folder routing.

- **Body:**

```json
{
  "fileName": "hyper-flux-8step.safetensors",
  "modelType": "LORA",
  "baseModel": "Flux.1 D",
  "creator": "ByteDance",
  "modelVersionId": 678910,
  "targetRoot": "/path/to/ComfyUI/models" // (optional: falls back to configured default)
}
```

- **Response `200 OK`:**

```json
{
  "id": "dl-uuid-12345",
  "fileName": "hyper-flux-8step.safetensors",
  "status": "pending",
  "progress": 0,
  "targetFolder": "loras",
  "computedPath": "/path/to/ComfyUI/models/loras/hyper-flux-8step.safetensors"
}
```

#### `GET /api/downloads`

Returns the list of active, paused, queued, and completed downloads with real-time speed, bytes downloaded, and status.

#### `POST /api/pause-download`

- **Body:** `{ "id": "<task-id>" }`

#### `POST /api/resume-download`

- **Body:** `{ "id": "<task-id>" }`

#### `POST /api/cancel-download`

- **Body:** `{ "id": "<task-id>" }`

---

### 5. Workflow Inspection & In-Memory Parsing

#### `POST /api/workflows` or `POST /api/workflow/parse`

Extracts all referenced checkpoints, LoRAs, UNETs, VAEs, CLIP models, and upscalers directly from **in-memory raw JSON** or scanned disk folders.

##### Option A: Direct Raw JSON In-Memory Payload (Recommended for Custom Nodes)

Send the raw workflow/prompt dictionary directly in the POST body without saving any files to disk.

- **Request Body (Direct Workflow JSON / ComfyUI Canvas Format):**

```json
{
  "workflow": {
    "nodes": [
      {
        "id": 4,
        "type": "CheckpointLoaderSimple",
        "widgets_values": ["flux1-dev.safetensors"]
      },
      {
        "id": 10,
        "type": "LoraLoader",
        "widgets_values": ["cinematic_realism_v1.safetensors"]
      }
    ]
  }
}
```

*Or pass the ComfyUI API Prompt format directly:*

```json
{
  "prompt": {
    "3": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": "sd_xl_base_1.0.safetensors"
      }
    }
  }
}
```

- **Response `200 OK`:**

```json
{
  "fileName": "direct_workflow.json",
  "fileType": "json",
  "modelCount": 2,
  "models": [
    {
      "nodeId": "4",
      "nodeType": "CheckpointLoaderSimple",
      "inputName": "widget_value",
      "modelName": "flux1-dev.safetensors",
      "isInstalled": true,
      "localPath": "/home/user/ComfyUI/models/checkpoints/flux1-dev.safetensors"
    },
    {
      "nodeId": "10",
      "nodeType": "LoraLoader",
      "inputName": "widget_value",
      "modelName": "cinematic_realism_v1.safetensors",
      "isInstalled": false
    }
  ]
}
```

##### Option B: Local Disk Folder Scanning

- **Request Body:**

```json
{
  "folderPaths": ["/path/to/ComfyUI/workflows"]
}
```

---

### 6. Hugging Face Integration

#### `POST /api/hf/check`

Inspects a Hugging Face repository and returns file lists, sizes, and `.safetensors` model metadata.

- **Body:**

```json
{
  "repoId": "black-forest-labs/FLUX.1-dev"
}
```

#### `GET /api/hf/whoami`

Returns Hugging Face login authentication status.
