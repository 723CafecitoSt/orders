-- Additive only. Do not apply remotely without database identity, backup and approval.
CREATE TABLE api_rate_limits (bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, employee_id TEXT, event TEXT NOT NULL, entity_id TEXT, created_at INTEGER NOT NULL, details TEXT NOT NULL);
CREATE INDEX audit_events_entity ON audit_events(entity_id,created_at);
