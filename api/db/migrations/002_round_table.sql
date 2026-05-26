CREATE TABLE round_table (
    user_id  UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id  UUID     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, position),
    UNIQUE (user_id, game_id)
);
