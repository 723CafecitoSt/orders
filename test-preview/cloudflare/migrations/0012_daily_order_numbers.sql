-- Additive. Existing order numbers and immutable snapshots are never renumbered.
CREATE TABLE daily_order_counters(business_date TEXT PRIMARY KEY,last_number INTEGER NOT NULL CHECK(last_number>=0));
CREATE TABLE business_order_numbers(order_id TEXT PRIMARY KEY REFERENCES orders(id),business_date TEXT NOT NULL CHECK(business_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),daily_number INTEGER NOT NULL CHECK(daily_number>0),UNIQUE(business_date,daily_number));
CREATE INDEX orders_created_at ON orders(created_at);
CREATE TRIGGER daily_number_new_order AFTER INSERT ON orders WHEN json_extract(NEW.snapshot_json,'$.businessDate') IS NOT NULL BEGIN
 INSERT INTO daily_order_counters(business_date,last_number) VALUES(json_extract(NEW.snapshot_json,'$.businessDate'),1) ON CONFLICT(business_date) DO UPDATE SET last_number=last_number+1;
 INSERT INTO business_order_numbers(order_id,business_date,daily_number) SELECT NEW.id,business_date,last_number FROM daily_order_counters WHERE business_date=json_extract(NEW.snapshot_json,'$.businessDate');
END;
