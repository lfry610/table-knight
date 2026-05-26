-- db/queries/lists.sql

-- name: CreateList :one
INSERT INTO lists (user_id, title, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetListsByUser :many
SELECT l.*, COUNT(lg.game_id)::int AS game_count
FROM lists l
LEFT JOIN list_games lg ON lg.list_id = l.id
WHERE l.user_id = $1
GROUP BY l.id
ORDER BY l.created_at DESC;

-- name: GetListByID :one
SELECT l.*, COUNT(lg.game_id)::int AS game_count
FROM lists l
LEFT JOIN list_games lg ON lg.list_id = l.id
WHERE l.id = $1
GROUP BY l.id;

-- name: GetListGames :many
SELECT
    g.id,
    g.bgg_id,
    g.title,
    g.image_url,
    g.bgg_rating,
    g.weight,
    g.min_players,
    g.max_players,
    g.playtime_mins,
    lg.position
FROM list_games lg
JOIN games g ON g.id = lg.game_id
WHERE lg.list_id = $1
ORDER BY lg.position;

-- name: AddGameToList :exec
INSERT INTO list_games (list_id, game_id, position)
VALUES ($1, $2, $3)
ON CONFLICT (list_id, game_id) DO UPDATE SET position = EXCLUDED.position;

-- name: RemoveGameFromList :exec
DELETE FROM list_games WHERE list_id = $1 AND game_id = $2;

-- name: ReorderListGames :exec
UPDATE list_games SET position = $3
WHERE list_id = $1 AND game_id = $2;

-- name: UpdateList :one
UPDATE lists
SET
    title       = COALESCE(sqlc.narg('title'), title),
    description = COALESCE(sqlc.narg('description'), description),
    updated_at  = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteList :exec
DELETE FROM lists WHERE id = $1 AND user_id = $2;

-- name: GetListGameCount :one
SELECT COUNT(*)::int AS count FROM list_games WHERE list_id = $1;
