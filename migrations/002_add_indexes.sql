-- Database Performance Indexes Migration (v2)

CREATE INDEX IF NOT EXISTS idx_local_models_sha256 ON local_models(sha256);
CREATE INDEX IF NOT EXISTS idx_local_models_path ON local_models(file_path);
CREATE INDEX IF NOT EXISTS idx_civitai_versions_model_id ON civitai_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_civitai_versions_sha256 ON civitai_versions(sha256);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
