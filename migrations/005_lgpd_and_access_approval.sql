CREATE TABLE IF NOT EXISTS user_access_approvals (
  user_id INTEGER PRIMARY KEY,
  company_id INTEGER,
  nome TEXT NOT NULL,
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  approval_status TEXT NOT NULL DEFAULT 'pending_approval',
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT NOT NULL DEFAULT 'LGPD-TERMOS-2026.1',
  terms_accepted_at_utc TIMESTAMPTZ,
  terms_accepted_ip TEXT DEFAULT '',
  approved_by_uid INTEGER,
  approved_at_utc TIMESTAMPTZ,
  rejection_reason TEXT DEFAULT '',
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_access_approvals_status_company
  ON user_access_approvals (approval_status, company_id);
