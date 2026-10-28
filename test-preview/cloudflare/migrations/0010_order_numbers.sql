-- Independent test numbering. Existing orders receive a separate internal number without repricing.
CREATE TABLE order_numbers(number INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id));
INSERT INTO order_numbers(order_id) SELECT id FROM orders ORDER BY created_at,id;
CREATE TRIGGER number_new_order AFTER INSERT ON orders BEGIN INSERT INTO order_numbers(order_id) VALUES(NEW.id); END;
