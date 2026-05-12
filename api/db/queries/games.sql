-- db/queries/games.sql

-- name: UpsertGame :one
INSERT INTO games (bgg_id, title, min_players, max_players, playtime_mins, weight, image_url, categories, bgg_rating)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (bgg_id) DO UPDATE SET
    title         = EXCLUDED.title,
    min_players   = EXCLUDED.min_players,
    max_players   = EXCLUDED.max_players,
    playtime_mins = EXCLUDED.playtime_mins,
    weight        = EXCLUDED.weight,
    image_url     = EXCLUDED.image_url,
    categories    = EXCLUDED.categories,
    bgg_rating    = EXCLUDED.bgg_rating,
    cached_at     = NOW()
RETURNING *;

-- name: GetGameByBGGID :one
SELECT * FROM games WHERE bgg_id = $1;

-- name: GetGameByID :one
SELECT * FROM games WHERE id = $1;

-- name: AddGameToCollection :one
INSERT INTO user_games (user_id, game_id, status)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, game_id) DO UPDATE SET status = EXCLUDED.status
RETURNING *;

-- name: GetUserCollection :many
SELECT
    g.*,
    ug.status,
    ug.user_rating,
    ug.added_at
FROM games g
JOIN user_games ug ON g.id = ug.game_id
WHERE ug.user_id = $1
ORDER BY ug.added_at DESC;

-- name: UpdateCollectionEntry :one
UPDATE user_games
SET
    status      = COALESCE($3, status),
    user_rating = COALESCE($4, user_rating)
WHERE user_id = $1 AND game_id = $2
RETURNING *;

-- name: RemoveFromCollection :exec
DELETE FROM user_games WHERE user_id = $1 AND game_id = $2;

-- name: GetGroupCollection :many
SELECT DISTINCT
    g.*,
    ug.status
FROM games g
JOIN user_games ug ON g.id = ug.game_id
JOIN group_members gm ON ug.user_id = gm.user_id
WHERE gm.group_id = $1
  AND ug.status = 'owned'
ORDER BY g.title;
