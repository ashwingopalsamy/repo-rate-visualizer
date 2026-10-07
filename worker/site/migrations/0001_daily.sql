-- Daily analytics totals, kept after Analytics Engine's three-month retention. event '_all' holds the day's uniques.
CREATE TABLE IF NOT EXISTS daily (
  date TEXT NOT NULL,
  event TEXT NOT NULL,
  route TEXT NOT NULL,
  cc TEXT NOT NULL,
  country TEXT NOT NULL,
  count INTEGER NOT NULL,
  visitors INTEGER NOT NULL,
  PRIMARY KEY (date, event, route, cc, country)
);
