-- Makeover: categories, transfers (settle up), recurring flag, receipts.
-- Back up first: bunx wrangler d1 export pliffo-finances --remote --output backup.sql

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

INSERT INTO categories (id, name, emoji, color, sort) VALUES
  (1, 'Software', '💻', 'blue', 1),
  (2, 'Hosting', '☁️', 'teal', 2),
  (3, 'Domains', '🌐', 'violet', 3),
  (4, 'Hardware', '🎙️', 'orange', 4),
  (5, 'Legal & fees', '⚖️', 'gray', 5),
  (6, 'Marketing', '📣', 'pink', 6),
  (7, 'Travel', '✈️', 'amber', 7),
  (8, 'Other', '📦', 'gray', 8);

-- SQLite cannot change a CHECK constraint in place, so rebuild entries and copy the rows across.
CREATE TABLE entries_new (
  id INTEGER PRIMARY KEY,
  date TEXT,                                   -- YYYY-MM-DD, NULL when unknown
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out', 'transfer')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  who TEXT NOT NULL CHECK (who IN ('Antoine', 'Kiryl', 'Both')), -- whose money / whose card; sender of a transfer
  to_who TEXT CHECK (to_who IN ('Antoine', 'Kiryl')),            -- receiver of a transfer
  what TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  repeat TEXT CHECK (repeat IN ('monthly', 'yearly')),           -- reminder only, nothing is auto-created
  receipt_key TEXT,                            -- R2 object key
  added_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((kind = 'transfer') = (to_who IS NOT NULL))
);

INSERT INTO entries_new (id, date, kind, amount_cents, who, what, added_by, created_at)
  SELECT id, date, kind, amount_cents, who, what, added_by, created_at FROM entries;

DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;

-- Categorise the seed rows from the spreadsheet (matched by id and name, so later rows are untouched).
UPDATE entries SET category_id = 3, repeat = 'yearly'  WHERE id = 2 AND what = 'Domain';
UPDATE entries SET category_id = 1, repeat = 'monthly' WHERE id = 3 AND what = 'Claude credits';
UPDATE entries SET category_id = 1, repeat = 'yearly'  WHERE id = 4 AND what = 'Apple Developer Membership';
UPDATE entries SET category_id = 4                     WHERE id = 5 AND what = 'Influencer mic';
