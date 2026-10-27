ALTER TABLE employees ADD COLUMN role TEXT NOT NULL DEFAULT 'cashier' CHECK(role IN ('admin','cashier'));
CREATE TABLE login_failures (username TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0);
