PRAGMA foreign_keys = ON;
CREATE TABLE inquiries (
 reference TEXT PRIMARY KEY, type TEXT NOT NULL,
 payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New',
 notification_status TEXT NOT NULL DEFAULT 'disabled',
 idempotency_hash TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX inquiries_type_date ON inquiries(type, created_at DESC);
CREATE TABLE inquiry_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reference TEXT NOT NULL REFERENCES inquiries(reference) ON DELETE CASCADE,
 actor TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE attachments (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL REFERENCES inquiries(reference) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE notifications (
 reference TEXT PRIMARY KEY REFERENCES inquiries(reference) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending',
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 last_result TEXT, provider_id TEXT
);
CREATE TABLE notification_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL REFERENCES inquiries(reference) ON DELETE CASCADE,
 attempt INTEGER NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE assets (
 id TEXT PRIMARY KEY, original_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
 width INTEGER NOT NULL, height INTEGER NOT NULL, alt TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('ai-concept','verified-photo')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','published')),
 desired_target TEXT NOT NULL DEFAULT '', focal_x REAL NOT NULL DEFAULT 50, focal_y REAL NOT NULL DEFAULT 50,
 created_by TEXT NOT NULL, provenance TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE asset_variants (
 asset_id TEXT NOT NULL REFERENCES assets(id), width INTEGER NOT NULL, height INTEGER NOT NULL,
 object_key TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, PRIMARY KEY(asset_id,width)
);
CREATE TABLE asset_usage (
 target TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id)
);
CREATE TABLE asset_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id TEXT NOT NULL REFERENCES assets(id),
 actor TEXT NOT NULL, action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
