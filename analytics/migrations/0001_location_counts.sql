CREATE TABLE location_counts (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 1 CHECK (views > 0),
  PRIMARY KEY (day, path, country, region, city)
) WITHOUT ROWID;
