CREATE TABLE IF NOT EXISTS rate_hits (
  bucket TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_hits_bucket
  ON rate_hits(bucket, created_at);

CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY,
  host_player_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'lobby',
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  ai_phase TEXT NOT NULL DEFAULT 'idle',
  rounds_total INTEGER NOT NULL DEFAULT 3,
  turn_seconds INTEGER NOT NULL DEFAULT 60,
  current_round INTEGER NOT NULL DEFAULT 0,
  active_round_id TEXT,
  whiteboard_uuid TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  waiting_for_players_since INTEGER,
  host_epoch INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL,
  rtc_uid TEXT NOT NULL,
  seat_token_hash TEXT NOT NULL UNIQUE,
  score INTEGER NOT NULL DEFAULT 0,
  ready INTEGER NOT NULL DEFAULT 0,
  connected INTEGER NOT NULL DEFAULT 1,
  joined_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  left_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_game_players_room
  ON game_players(room_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_game_players_room_presence
  ON game_players(room_id, left_at, last_seen_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_players_one_ai_per_room
  ON game_players(room_id)
  WHERE role = 'ai';

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  artist_id TEXT NOT NULL REFERENCES game_players(id),
  phase TEXT NOT NULL,
  secret_word TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  revealed_json TEXT NOT NULL DEFAULT '[]',
  started_at INTEGER,
  ends_at INTEGER,
  winner_type TEXT,
  winner_id TEXT,
  end_reason TEXT,
  created_at INTEGER NOT NULL,
  choose_ends_at INTEGER,
  result_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_room
  ON game_rounds(room_id, number);

CREATE TABLE IF NOT EXISTS game_guesses (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  player_id TEXT,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  normalized TEXT NOT NULL,
  correctness TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_guesses_round
  ON game_guesses(round_id, created_at);

CREATE TABLE IF NOT EXISTS ai_proof_attempts (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  guess TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL,
  provider_job_id TEXT,
  playback_url TEXT,
  verify_nonce_hash TEXT,
  phase TEXT NOT NULL,
  verification_result TEXT,
  failure_code TEXT,
  vision_ms INTEGER,
  generation_ms INTEGER,
  verification_ms INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_proof_attempts_round
  ON ai_proof_attempts(round_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_proof_attempts_room
  ON ai_proof_attempts(room_id, updated_at DESC);
