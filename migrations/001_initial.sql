-- Initial Schema Migration (v1)

CREATE TABLE IF NOT EXISTS civitai_models (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    nsfw INTEGER DEFAULT 0,
    nsfw_level INTEGER DEFAULT 1,
    creator_username TEXT,
    download_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS civitai_versions (
    id INTEGER PRIMARY KEY,
    model_id INTEGER,
    name TEXT,
    base_model TEXT,
    published_at TIMESTAMP,
    download_url TEXT,
    size_kb REAL,
    sha256 TEXT,
    raw_json TEXT,
    FOREIGN KEY (model_id) REFERENCES civitai_models(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS local_models (
    id TEXT PRIMARY KEY,
    file_path TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    sha256 TEXT,
    civitai_model_id INTEGER,
    civitai_version_id INTEGER,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_duplicate INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    civitai_version_id INTEGER,
    civitai_model_id INTEGER,
    model_name TEXT,
    version_name TEXT,
    local_path TEXT,
    file_name TEXT,
    size_kb REAL,
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error TEXT,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT
);
