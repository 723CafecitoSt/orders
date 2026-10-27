-- Local testing only. Existing products must be assigned explicitly by an administrator.
CREATE TABLE product_stations(product_id TEXT PRIMARY KEY REFERENCES products(id),station TEXT NOT NULL CHECK(station IN('beverages','food')),updated_by TEXT NOT NULL REFERENCES employees(id),updated_at INTEGER NOT NULL);
CREATE TRIGGER station_insert_rev AFTER INSERT ON product_stations BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE singleton=1; INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'station_assigned',NEW.product_id,NEW.updated_at,json_object('station',NEW.station)); END;
CREATE TRIGGER station_update_rev AFTER UPDATE ON product_stations BEGIN UPDATE catalog_revision SET revision=revision+1 WHERE singleton=1; INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'station_assigned',NEW.product_id,NEW.updated_at,json_object('station',NEW.station)); END;
CREATE TABLE kitchen_items(order_id TEXT NOT NULL REFERENCES orders(id),line_index INTEGER NOT NULL,station TEXT NOT NULL CHECK(station IN('beverages','food')),snapshot_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN('new','preparing','ready')),version INTEGER NOT NULL DEFAULT 0,updated_by TEXT REFERENCES employees(id),updated_at INTEGER NOT NULL,PRIMARY KEY(order_id,line_index));
CREATE INDEX kitchen_station ON kitchen_items(station,updated_at);
CREATE TRIGGER order_kitchen_insert AFTER INSERT ON orders BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.snapshot_json,'$.items') AS item LEFT JOIN product_stations s ON s.product_id=json_extract(item.value,'$.productId') WHERE s.product_id IS NULL) THEN RAISE(ABORT,'Product station missing') END;
 INSERT INTO kitchen_items(order_id,line_index,station,snapshot_json,updated_at) SELECT NEW.id,CAST(item.key AS INTEGER),s.station,item.value,NEW.created_at FROM json_each(NEW.snapshot_json,'$.items') item JOIN product_stations s ON s.product_id=json_extract(item.value,'$.productId');
END;
CREATE TRIGGER kitchen_state_audit AFTER UPDATE OF status ON kitchen_items WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'kitchen_status',NEW.order_id,NEW.updated_at,json_object('line',NEW.line_index,'from',OLD.status,'to',NEW.status,'version',NEW.version));
END;
