-- db/queries/round_table.sql

-- name: GetRoundTable :many
SELECT
    g.id,
    g.bgg_id,
    g.title,
    g.min_players,
    g.max_players,
    g.playtime_mins,
    g.weight,
    g.image_url,
    g.categories,
    g.bgg_rating,
    g.cached_at,
    rt.position
FROM round_table rt
JOIN games g ON g.id = rt.game_id
WHERE rt.user_id = $1
ORDER BY rt.position;

-- name: SetRoundTableSlot :exec
INSERT INTO round_table (user_id, game_id, position)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, position) DO UPDATE SET game_id = EXCLUDED.game_id;

-- name: ClearRoundTable :exec
DELETE FROM round_table WHERE user_id = $1;
