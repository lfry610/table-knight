ALTER TABLE user_games ADD COLUMN played BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE user_games SET played = TRUE WHERE status = 'played';
