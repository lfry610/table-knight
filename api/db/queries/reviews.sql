-- db/queries/reviews.sql

-- name: UpsertReview :one
INSERT INTO reviews (user_id, game_id, rating, body)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, game_id) DO UPDATE
SET rating     = EXCLUDED.rating,
    body       = EXCLUDED.body,
    updated_at = NOW()
RETURNING *;

-- name: GetUserReviews :many
SELECT
    r.*,
    g.title     AS game_title,
    g.image_url AS game_image,
    g.bgg_id    AS game_bgg_id
FROM reviews r
JOIN games g ON g.id = r.game_id
WHERE r.user_id = $1
ORDER BY r.updated_at DESC;

-- name: GetGameReviewStats :many
SELECT
    rating,
    COUNT(*)::int AS count
FROM reviews
WHERE game_id = $1
GROUP BY rating
ORDER BY rating DESC;

-- name: GetUserReview :one
SELECT * FROM reviews WHERE user_id = $1 AND game_id = $2;

-- name: DeleteReview :exec
DELETE FROM reviews WHERE user_id = $1 AND game_id = $2;

-- name: GetReviewableGames :many
SELECT DISTINCT g.id, g.bgg_id, g.title, g.image_url
FROM games g
JOIN user_games ug ON ug.game_id = g.id
WHERE ug.user_id = $1
  AND (ug.status = 'owned' OR ug.played = TRUE)
ORDER BY g.title;
