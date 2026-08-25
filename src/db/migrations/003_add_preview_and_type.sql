-- Migration to add preview_url and model_type columns to local_models table
ALTER TABLE local_models ADD COLUMN preview_url TEXT;
ALTER TABLE local_models ADD COLUMN model_type TEXT;
