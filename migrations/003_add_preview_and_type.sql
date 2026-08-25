CREATE TABLE IF NOT EXISTS local_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  modified_at INTEGER NOT NULL,
  sha256 TEXT,
  civitai_model_id INTEGER,
  civitai_version_id INTEGER,
  preview_url TEXT,
  model_type TEXT,
  is_duplicate INTEGER DEFAULT 0,
  version INTEGER,
  version_metadata TEXT
);

-- If the table already exists, add the new columns if they don't exist.
ALTER TABLE local_models ADD COLUMN preview_url TEXT;
ALTER TABLE local_models ADD COLUMN model_type TEXT;
