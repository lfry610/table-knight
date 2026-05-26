ALTER TYPE activity_type ADD VALUE 'list_created';

CREATE TABLE lists (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lists_user_id_idx ON lists(user_id);

ALTER TABLE activity ADD COLUMN list_id UUID REFERENCES lists(id) ON DELETE SET NULL;

CREATE TABLE list_games (
    list_id  UUID     NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    game_id  UUID     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    PRIMARY KEY (list_id, game_id),
    UNIQUE (list_id, position)
);
