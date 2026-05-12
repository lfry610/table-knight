-- 001_initial_schema.sql
-- Run: psql $DATABASE_URL -f db/migrations/001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url   TEXT,
    password     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Games (cached from BGG) ────────────────────────────────────────────────────
CREATE TABLE games (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bgg_id        INT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    min_players   INT NOT NULL DEFAULT 1,
    max_players   INT NOT NULL DEFAULT 8,
    playtime_mins INT,
    weight        NUMERIC(3,2),
    image_url     TEXT,
    categories    TEXT[] NOT NULL DEFAULT '{}',
    bgg_rating    NUMERIC(4,2),
    cached_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX games_bgg_id_idx ON games(bgg_id);

-- ── User game collections ──────────────────────────────────────────────────────
CREATE TYPE game_status AS ENUM ('owned', 'want_to_play', 'for_trade', 'wishlist');

CREATE TABLE user_games (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    status      game_status NOT NULL DEFAULT 'owned',
    user_rating INT CHECK (user_rating BETWEEN 1 AND 5),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, game_id)
);

CREATE INDEX user_games_user_id_idx ON user_games(user_id);

-- ── Groups ────────────────────────────────────────────────────────────────────
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE DEFAULT substring(gen_random_uuid()::text, 1, 8),
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX groups_invite_code_idx ON groups(invite_code);

-- ── Group members ─────────────────────────────────────────────────────────────
CREATE TYPE member_role AS ENUM ('admin', 'member');

CREATE TABLE group_members (
    group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- ── Sessions (play log) ───────────────────────────────────────────────────────
CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID REFERENCES groups(id) ON DELETE SET NULL,
    game_id       UUID NOT NULL REFERENCES games(id),
    played_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_mins INT,
    notes         TEXT,
    logged_by     UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX sessions_group_id_idx ON sessions(group_id);
CREATE INDEX sessions_game_id_idx ON sessions(game_id);

-- ── Session players ───────────────────────────────────────────────────────────
CREATE TYPE session_result AS ENUM ('win', 'loss', 'draw', 'dnf');

CREATE TABLE session_players (
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result     session_result NOT NULL,
    score      INT,
    PRIMARY KEY (session_id, user_id)
);

-- ── Game nights (scheduling) ──────────────────────────────────────────────────
CREATE TYPE night_status AS ENUM ('polling', 'confirmed', 'cancelled');

CREATE TABLE game_nights (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    proposed_dates TIMESTAMPTZ[] NOT NULL DEFAULT '{}',
    confirmed_date TIMESTAMPTZ,
    status         night_status NOT NULL DEFAULT 'polling',
    created_by     UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE availability_responses (
    night_id  UUID NOT NULL REFERENCES game_nights(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date      TIMESTAMPTZ NOT NULL,
    available BOOLEAN NOT NULL,
    PRIMARY KEY (night_id, user_id, date)
);
