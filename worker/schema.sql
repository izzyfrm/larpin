CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  bio          TEXT NOT NULL DEFAULT '',
  avatar_v     INTEGER NOT NULL DEFAULT 0,
  pass_hash    TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  is_banned    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- status: pending | approved | rejected | flagged | quarantined | removed
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  media_key    TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  width        INTEGER NOT NULL DEFAULT 0,
  height       INTEGER NOT NULL DEFAULT 0,
  duration     INTEGER NOT NULL DEFAULT 0,
  frames       INTEGER NOT NULL DEFAULT 0,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  reason       TEXT NOT NULL DEFAULT '',
  attempts     INTEGER NOT NULL DEFAULT 0,
  downloads    INTEGER NOT NULL DEFAULT 0,
  review_at    INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  published_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_due ON posts (status, review_at);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL,
  reporter_id TEXT,
  reason      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  resolved    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_open ON reports (resolved, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key     TEXT NOT NULL,
  window  INTEGER NOT NULL,
  count   INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);
