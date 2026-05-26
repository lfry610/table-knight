-- 005_google_auth.sql
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
