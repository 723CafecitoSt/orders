-- Additive: legacy orders retain NULL fingerprints and cannot be replayed automatically.
ALTER TABLE orders ADD COLUMN request_fingerprint TEXT;
