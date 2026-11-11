-- Existing daily totals are preserved. Individual times cannot be backfilled.
CREATE TABLE visit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE INDEX visit_events_time ON visit_events (occurred_at DESC, id DESC);
