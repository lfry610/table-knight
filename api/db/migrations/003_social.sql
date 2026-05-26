CREATE TABLE follows (
    follower_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX follows_following_id_idx ON follows(following_id);

CREATE TYPE activity_type AS ENUM ('session_logged', 'game_added', 'game_for_trade');

CREATE TABLE activity (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       activity_type NOT NULL,
    game_id    UUID          REFERENCES games(id) ON DELETE SET NULL,
    session_id UUID          REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_user_id_idx   ON activity(user_id);
CREATE INDEX activity_created_at_idx ON activity(created_at DESC);
