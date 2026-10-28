-- Internal test ledger only: no Square, external network, or movement of funds.
CREATE TABLE internal_cash_receipts(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE REFERENCES payment_attempts(id),
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
 employee_id TEXT NOT NULL REFERENCES employees(id),
 order_number INTEGER NOT NULL CHECK(order_number>0),
 business_date TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents>=0),
 tax_cents INTEGER NOT NULL CHECK(tax_cents>=0),
 received_cents INTEGER NOT NULL CHECK(received_cents>=amount_cents),
 change_cents INTEGER NOT NULL CHECK(change_cents=received_cents-amount_cents),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 environment TEXT NOT NULL DEFAULT 'test' CHECK(environment='test'),
 snapshot_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 CHECK(amount_cents=subtotal_cents+tax_cents)
);
CREATE INDEX internal_cash_business_date ON internal_cash_receipts(business_date,sequence);
CREATE TRIGGER internal_cash_append_only_update BEFORE UPDATE ON internal_cash_receipts BEGIN SELECT RAISE(ABORT,'Cash receipts are immutable'); END;
CREATE TRIGGER internal_cash_append_only_delete BEFORE DELETE ON internal_cash_receipts BEGIN SELECT RAISE(ABORT,'Cash receipts are immutable'); END;
CREATE TRIGGER internal_cash_audit AFTER INSERT ON internal_cash_receipts BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),NEW.employee_id,'internal_cash_recorded_test',NEW.order_id,NEW.created_at,json_object('receiptId',NEW.id,'amountCents',NEW.amount_cents,'receivedCents',NEW.received_cents,'changeCents',NEW.change_cents,'environment','test','sentToSquare',json('false')));
END;
