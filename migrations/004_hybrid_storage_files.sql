CREATE TABLE IF NOT EXISTS storage_files (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  uploaded_by_uid INTEGER NOT NULL,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('product_photo', 'profile_picture', 'hr_document', 'chat_attachment', 'spreadsheet')),
  storage_tier TEXT NOT NULL CHECK (storage_tier IN ('hot_local', 'cold_gdrive')),
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  relative_path TEXT,
  drive_file_id TEXT,
  sha256_hash TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (storage_tier = 'hot_local' AND relative_path IS NOT NULL)
    OR (storage_tier = 'cold_gdrive' AND drive_file_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_storage_files_company_type
  ON storage_files(company_id, upload_type, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS idx_storage_files_company_tier
  ON storage_files(company_id, storage_tier, created_at_utc DESC);
