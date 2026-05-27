-- db/queries/social.sql

-- name: FollowUser :exec
INSERT INTO follows (follower_id, following_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnfollowUser :exec
DELETE FROM follows WHERE follower_id = $1 AND following_id = $2;

-- name: IsFollowing :one
SELECT EXISTS(
    SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2
) AS is_following;

-- name: GetFollowing :many
SELECT u.id, u.display_name, u.avatar_url, f.created_at AS followed_at
FROM follows f
JOIN users u ON u.id = f.following_id
WHERE f.follower_id = $1
ORDER BY f.created_at DESC;

-- name: SearchUsers :many
SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    EXISTS(
        SELECT 1 FROM follows WHERE follower_id = sqlc.arg(me) AND following_id = u.id
    ) AS is_following
FROM users u
WHERE u.display_name ILIKE '%' || sqlc.arg(query) || '%'
  AND u.id != sqlc.arg(me)
ORDER BY u.display_name
LIMIT 20;

-- name: InsertActivity :exec
INSERT INTO activity (user_id, type, game_id, session_id, list_id, group_id)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: GetFeed :many
SELECT
    a.id            AS activity_id,
    a.type,
    a.created_at,
    u.id            AS actor_id,
    u.display_name,
    u.avatar_url,
    g.id            AS game_id,
    g.title         AS game_title,
    g.image_url     AS game_image,
    s.id            AS session_id,
    s.notes         AS session_notes,
    s.duration_mins AS session_duration,
    lst.id          AS list_id,
    lst.title       AS list_title,
    grp.id          AS group_id,
    grp.name        AS group_name
FROM activity a
JOIN users u ON u.id = a.user_id
LEFT JOIN games g ON g.id = a.game_id
LEFT JOIN sessions s ON s.id = a.session_id
LEFT JOIN lists lst ON lst.id = a.list_id
LEFT JOIN groups grp ON grp.id = a.group_id
WHERE a.user_id = $1
   OR a.user_id IN (
    SELECT following_id FROM follows WHERE follower_id = $1
)
ORDER BY a.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetFollowers :many
SELECT u.id, u.display_name, u.avatar_url, f.created_at AS followed_at
FROM follows f
JOIN users u ON u.id = f.follower_id
WHERE f.following_id = $1
ORDER BY f.created_at DESC;

-- name: GetFollowerCount :one
SELECT COUNT(*) FROM follows WHERE following_id = $1;

-- name: GetFollowingCount :one
SELECT COUNT(*) FROM follows WHERE follower_id = $1;

-- name: GetGroupMates :many
SELECT DISTINCT u.id, u.display_name, u.avatar_url
FROM group_members gm1
JOIN group_members gm2 ON gm1.group_id = gm2.group_id AND gm2.user_id != gm1.user_id
JOIN users u ON u.id = gm2.user_id
WHERE gm1.user_id = $1
  AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id)
ORDER BY u.display_name
LIMIT 20;
