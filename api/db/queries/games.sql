-- db/queries/games.sql

-- name: UpsertGame :one
INSERT INTO games (bgg_id, title, min_players, max_players, playtime_mins, weight, image_url, categories, bgg_rating, description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (bgg_id) DO UPDATE SET
    title         = EXCLUDED.title,
    min_players   = EXCLUDED.min_players,
    max_players   = EXCLUDED.max_players,
    playtime_mins = EXCLUDED.playtime_mins,
    weight        = EXCLUDED.weight,
    image_url     = EXCLUDED.image_url,
    categories    = EXCLUDED.categories,
    bgg_rating    = EXCLUDED.bgg_rating,
    description   = EXCLUDED.description,
    cached_at     = NOW()
RETURNING *;

-- name: CountGames :one
SELECT COUNT(*) FROM games;

-- name: GetGameByBGGID :one
SELECT * FROM games WHERE bgg_id = $1;

-- name: SearchLocalGames :many
SELECT * FROM games
WHERE title ILIKE '%' || $1 || '%'
ORDER BY
  (lower(title) = lower($1))::int DESC,
  title
LIMIT 20;

-- name: GetGameByID :one
SELECT * FROM games WHERE id = $1;

-- name: ListAllGames :many
SELECT * FROM games ORDER BY cached_at ASC;

-- name: AddGameToCollection :one
INSERT INTO user_games (user_id, game_id, status, played)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, game_id) DO UPDATE
SET status = EXCLUDED.status,
    played = user_games.played OR EXCLUDED.played
RETURNING *;

-- name: GetUserCollection :many
SELECT
    g.*,
    ug.status,
    ug.played,
    ug.user_rating,
    ug.added_at
FROM games g
JOIN user_games ug ON g.id = ug.game_id
WHERE ug.user_id = $1
ORDER BY ug.added_at DESC;

-- name: UpdateCollectionEntry :one
UPDATE user_games
SET
    status      = COALESCE(sqlc.narg('status'), status),
    user_rating = COALESCE(sqlc.narg('user_rating'), user_rating)
WHERE user_id = $1 AND game_id = $2
RETURNING *;

-- name: RemoveFromCollection :exec
DELETE FROM user_games WHERE user_id = $1 AND game_id = $2;

-- name: AddToCollectionIfAbsent :exec
INSERT INTO user_games (user_id, game_id, status, played)
VALUES ($1, $2, 'played', TRUE)
ON CONFLICT (user_id, game_id) DO UPDATE
SET played = TRUE;

-- name: GetUserSessionsForGame :many
SELECT
    s.id,
    s.group_id,
    s.game_id,
    s.played_at,
    s.duration_mins,
    s.notes,
    s.logged_by,
    g.title     AS game_title,
    g.image_url AS game_image
FROM sessions s
JOIN games g ON s.game_id = g.id
WHERE g.bgg_id = sqlc.arg(bgg_id)
  AND (s.logged_by = sqlc.arg(user_id)
       OR EXISTS (SELECT 1 FROM session_players sp WHERE sp.session_id = s.id AND sp.user_id = sqlc.arg(user_id))
       OR (s.group_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM group_members gm WHERE gm.group_id = s.group_id AND gm.user_id = sqlc.arg(user_id)
       )))
ORDER BY s.played_at DESC;

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
