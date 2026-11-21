CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  date TEXT,                                   -- YYYY-MM-DD, NULL when unknown
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  who TEXT NOT NULL CHECK (who IN ('Antoine', 'Kiryl', 'Both')), -- whose money / whose card
  what TEXT NOT NULL,
  added_by TEXT,                               -- Access email of whoever entered it
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The spreadsheet as of 2026-11-20 (no dates were recorded).
INSERT INTO entries (kind, amount_cents, who, what) VALUES
  ('in', 18500, 'Both', 'Casino (Kiryl and Antoine)'),
  ('out', 551, 'Antoine', 'Domain'),
  ('out', 839, 'Antoine', 'Claude credits'),
  ('out', 13683, 'Antoine', 'Apple Developer Membership'),
  ('out', 7715, 'Kiryl', 'Influencer mic');
