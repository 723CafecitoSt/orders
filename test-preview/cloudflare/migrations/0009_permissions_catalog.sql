-- Additive migration; preserves existing products, tax rates, orders and sessions.
CREATE TABLE employee_permissions(employee_id TEXT NOT NULL REFERENCES employees(id),permission TEXT NOT NULL CHECK(permission IN('administrator','cashier','beverages','food')),PRIMARY KEY(employee_id,permission));
INSERT INTO employee_permissions SELECT id,CASE role WHEN 'admin' THEN 'administrator' ELSE 'cashier' END FROM employees;
CREATE TABLE bootstrap_once(singleton INTEGER PRIMARY KEY CHECK(singleton=1),created_at INTEGER NOT NULL);
CREATE TABLE product_display(product_id TEXT PRIMARY KEY REFERENCES products(id),temperature TEXT NOT NULL DEFAULT 'none' CHECK(temperature IN('none','hot','cold','hotcold')),notes TEXT NOT NULL DEFAULT '',display_station TEXT NOT NULL DEFAULT 'Coffee Station' CHECK(display_station IN('Coffee Station','Cooler Station','Waffle Station')),seasonal INTEGER NOT NULL DEFAULT 0 CHECK(seasonal IN(0,1)));
CREATE TRIGGER display_insert_rev AFTER INSERT ON product_display BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER display_update_rev AFTER UPDATE ON product_display BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE singleton=1; END;
-- Existing products retain configured tax rates. 825 is the API default only for newly created products.
CREATE TABLE catalog_commands(id TEXT PRIMARY KEY,expected_revision INTEGER NOT NULL,employee_id TEXT NOT NULL REFERENCES employees(id),created_at INTEGER NOT NULL);
CREATE TRIGGER catalog_command_guard BEFORE INSERT ON catalog_commands WHEN NEW.expected_revision<>(SELECT revision FROM catalog_revision WHERE singleton=1) BEGIN SELECT RAISE(ABORT,'Catalog revision conflict'); END;
CREATE INDEX api_rate_window ON api_rate_limits(window_start);
