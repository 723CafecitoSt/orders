CREATE TABLE kitchen_access(employee_id TEXT NOT NULL REFERENCES employees(id),station TEXT NOT NULL CHECK(station IN('beverages','food')),PRIMARY KEY(employee_id,station));
