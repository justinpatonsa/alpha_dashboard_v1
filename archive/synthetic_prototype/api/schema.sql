-- Demo stand-in for Alpha's read-only Supabase schema. Same shape as the
-- four data areas in the RFP; every row is synthetic.

CREATE TABLE employees (
  employee_id  TEXT PRIMARY KEY,
  plant        TEXT NOT NULL,
  department   TEXT NOT NULL,
  role         TEXT NOT NULL,
  shift        TEXT NOT NULL,
  hire_date    TEXT NOT NULL,      -- ISO date
  term_date    TEXT,               -- NULL while employed
  term_type    TEXT,               -- Voluntary | Involuntary
  updated_at   TEXT NOT NULL
);
CREATE INDEX employees_term ON employees (term_date);
CREATE INDEX employees_hire ON employees (hire_date);

CREATE TABLE compensation (
  employee_id      TEXT PRIMARY KEY REFERENCES employees,
  annual_pay       REAL NOT NULL,
  role_median_pay  REAL NOT NULL
);

CREATE TABLE training (
  employee_id         TEXT PRIMARY KEY REFERENCES employees,
  training_hours_12m  REAL NOT NULL
);

CREATE TABLE hr_measures (
  employee_id        TEXT PRIMARY KEY REFERENCES employees,
  overtime_hours_wk  REAL NOT NULL,   -- average weekly overtime, last 12 months
  job_satisfaction   INTEGER NOT NULL -- 1 (low) to 4 (high)
);

CREATE TABLE surveys (
  employee_id        TEXT PRIMARY KEY REFERENCES employees,
  survey_date        TEXT NOT NULL,
  pay_benefits       INTEGER, workload INTEGER, manager_support INTEGER,
  career_growth      INTEGER, safety_conditions INTEGER, schedule INTEGER  -- 1 to 5
);

CREATE TABLE exit_interviews (
  employee_id     TEXT PRIMARY KEY REFERENCES employees,
  interview_date  TEXT NOT NULL,
  reason          TEXT NOT NULL,
  theme           TEXT NOT NULL,
  comment         TEXT
);

-- Rows the demo script changed, so `demo.py undo` can put them back.
CREATE TABLE demo_changes (
  employee_id     TEXT NOT NULL,
  prev_term_date  TEXT,
  prev_term_type  TEXT,
  changed_at      TEXT NOT NULL
);
