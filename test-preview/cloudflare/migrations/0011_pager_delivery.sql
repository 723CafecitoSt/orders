-- Mutable fulfillment metadata is separated from immutable sale snapshots.
CREATE TABLE order_fulfillment(order_id TEXT PRIMARY KEY REFERENCES orders(id),pager_number TEXT CHECK(pager_number IS NULL OR (length(pager_number) BETWEEN 1 AND 4 AND pager_number NOT GLOB '*[^0-9]*' AND CAST(pager_number AS INTEGER) BETWEEN 1 AND 9999 AND pager_number=CAST(CAST(pager_number AS INTEGER) AS TEXT))),delivered_at INTEGER CHECK(delivered_at IS NULL OR delivered_at>=0),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),updated_by TEXT NOT NULL REFERENCES employees(id),updated_at INTEGER NOT NULL);
INSERT INTO order_fulfillment(order_id,pager_number,updated_by,updated_at) SELECT id,NULL,employee_id,created_at FROM orders;
CREATE UNIQUE INDEX one_active_order_per_pager ON order_fulfillment(pager_number) WHERE pager_number IS NOT NULL AND delivered_at IS NULL;
CREATE INDEX fulfillment_delivery ON order_fulfillment(delivered_at,order_id);
CREATE TRIGGER initialize_order_fulfillment AFTER INSERT ON orders BEGIN
 INSERT INTO order_fulfillment(order_id,pager_number,updated_by,updated_at) VALUES(NEW.id,json_extract(NEW.snapshot_json,'$.initialPagerNumber'),NEW.employee_id,NEW.created_at);
END;
CREATE TRIGGER fulfillment_creation_audit AFTER INSERT ON order_fulfillment BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'order_fulfillment_created',NEW.order_id,NEW.updated_at,json_object('pager',NEW.pager_number));
END;
CREATE TRIGGER pager_change_audit AFTER UPDATE OF pager_number ON order_fulfillment WHEN OLD.pager_number IS NOT NEW.pager_number BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'pager_changed',NEW.order_id,NEW.updated_at,json_object('fromPager',OLD.pager_number,'toPager',NEW.pager_number,'version',NEW.version));
END;
CREATE TRIGGER delivery_audit AFTER UPDATE OF delivered_at ON order_fulfillment WHEN OLD.delivered_at IS NULL AND NEW.delivered_at IS NOT NULL BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.updated_by,'order_delivered',NEW.order_id,NEW.updated_at,json_object('pager',NEW.pager_number,'version',NEW.version));
END;
CREATE TRIGGER delivered_fulfillment_is_final BEFORE UPDATE ON order_fulfillment WHEN OLD.delivered_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'Delivered order is final'); END;
CREATE TRIGGER delivery_requires_ready BEFORE UPDATE OF delivered_at ON order_fulfillment WHEN NEW.delivered_at IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM kitchen_items WHERE order_id=NEW.order_id) OR EXISTS(SELECT 1 FROM kitchen_items WHERE order_id=NEW.order_id AND status<>'ready')) BEGIN SELECT RAISE(ABORT,'Items are not ready'); END;
CREATE TRIGGER delivered_items_are_final BEFORE UPDATE ON kitchen_items WHEN EXISTS(SELECT 1 FROM order_fulfillment WHERE order_id=NEW.order_id AND delivered_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'Delivered items are final'); END;
