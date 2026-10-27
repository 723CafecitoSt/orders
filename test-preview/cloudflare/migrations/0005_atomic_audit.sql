-- Append-only audit for database writes, recorded in the same transaction as each mutation.
-- No production database may receive this migration without review and explicit authorization.
CREATE TRIGGER audit_order_insert AFTER INSERT ON orders BEGIN
 INSERT INTO audit_events(id,employee_id,event,entity_id,created_at,details)
 VALUES(lower(hex(randomblob(16))),NEW.employee_id,'order_created',NEW.id,NEW.created_at,json_object('totalCents',NEW.total_cents));
END;
CREATE TRIGGER audit_attempt_insert AFTER INSERT ON payment_attempts BEGIN
 INSERT INTO audit_events(id,employee_id,event,entity_id,created_at,details)
 VALUES(lower(hex(randomblob(16))),(SELECT employee_id FROM orders WHERE id=NEW.order_id),'attempt_created',NEW.id,NEW.created_at,json_object('orderId',NEW.order_id,'status',NEW.status));
END;
CREATE TRIGGER audit_attempt_status AFTER UPDATE OF status ON payment_attempts WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO audit_events(id,employee_id,event,entity_id,created_at,details)
 VALUES(lower(hex(randomblob(16))),NULL,'attempt_status_changed',NEW.id,NEW.updated_at,json_object('oldStatus',OLD.status,'newStatus',NEW.status));
END;
