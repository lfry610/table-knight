-- db/queries/groups.sql

-- name: CreateGroup :one
INSERT INTO groups (name, created_by)
VALUES ($1, $2)
RETURNING *;

-- name: GetGroupByID :one
SELECT * FROM groups WHERE id = $1;

-- name: GetGroupByInviteCode :one
SELECT * FROM groups WHERE invite_code = $1;

-- name: GetUserGroups :many
SELECT g.*
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = $1
ORDER BY g.created_at DESC;

-- name: AddGroupMember :one
INSERT INTO group_members (group_id, user_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (group_id, user_id) DO NOTHING
RETURNING *;

-- name: GetGroupMembers :many
SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    gm.role,
    gm.joined_at
FROM users u
JOIN group_members gm ON u.id = gm.user_id
WHERE gm.group_id = $1
ORDER BY gm.joined_at ASC;

-- name: IsGroupMember :one
SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = $1 AND user_id = $2
) AS is_member;

-- db/queries/sessions.sql

-- name: CreateSession :one
INSERT INTO sessions (group_id, game_id, played_at, duration_mins, notes, logged_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: AddSessionPlayer :one
INSERT INTO session_players (session_id, user_id, result, score)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserSessions :many
SELECT
    s.id,
    s.group_id,
    s.game_id,
    s.played_at,
    s.duration_mins,
    s.notes,
    s.logged_by,
    g.title  AS game_title,
    g.image_url AS game_image
FROM sessions s
JOIN games g ON s.game_id = g.id
WHERE s.logged_by = $1
   OR EXISTS (SELECT 1 FROM session_players sp WHERE sp.session_id = s.id AND sp.user_id = $1)
   OR (s.group_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM group_members gm WHERE gm.group_id = s.group_id AND gm.user_id = $1
   ))
ORDER BY s.played_at DESC
LIMIT $2 OFFSET $3;

-- name: GetGroupSessions :many
SELECT
    s.*,
    g.title AS game_title,
    g.image_url AS game_image
FROM sessions s
JOIN games g ON s.game_id = g.id
WHERE s.group_id = $1
ORDER BY s.played_at DESC
LIMIT $2 OFFSET $3;

-- name: GetSessionByID :one
SELECT id, logged_by FROM sessions WHERE id = $1;

-- name: UpdateSession :exec
UPDATE sessions SET played_at = $2 WHERE id = $1 AND logged_by = $3;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = $1 AND logged_by = $2;

-- name: UpdateSessionPlayer :exec
UPDATE session_players
SET result = $3, score = $4
WHERE session_id = $1 AND user_id = $2;

-- name: GetUserStats :one
WITH my_sessions AS (
    SELECT s.id, s.game_id, s.played_at, s.duration_mins, g.title AS game_title
    FROM sessions s
    JOIN games g ON s.game_id = g.id
    WHERE s.logged_by = $1
       OR EXISTS (SELECT 1 FROM session_players sp2 WHERE sp2.session_id = s.id AND sp2.user_id = $1)
       OR (s.group_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM group_members gm WHERE gm.group_id = s.group_id AND gm.user_id = $1
       ))
)
SELECT
    COUNT(ms.id)::int                                                                                        AS total_sessions,
    (COUNT(ms.id) FILTER (WHERE DATE_TRUNC('month', ms.played_at) = DATE_TRUNC('month', NOW())))::int       AS sessions_this_month,
    COUNT(DISTINCT ms.game_id)::int                                                                          AS unique_games,
    COALESCE(SUM(ms.duration_mins), 0)::int                                                                 AS total_playtime_mins,
    COALESCE((SELECT ms2.game_title FROM my_sessions ms2 GROUP BY ms2.game_id, ms2.game_title ORDER BY COUNT(*) DESC LIMIT 1), '')         AS most_played_game,
    COALESCE((SELECT COUNT(*)::int FROM my_sessions ms2 GROUP BY ms2.game_id, ms2.game_title ORDER BY COUNT(*) DESC LIMIT 1), 0)         AS most_played_game_count,
    (SELECT g2.image_url FROM my_sessions ms2 JOIN games g2 ON g2.id = ms2.game_id GROUP BY ms2.game_id, ms2.game_title, g2.image_url ORDER BY COUNT(*) DESC LIMIT 1) AS most_played_game_image,
    COUNT(CASE WHEN sp.result = 'win'::session_result THEN 1 END)::int                                     AS wins,
    COUNT(sp.result)::int                                                                                    AS total_results
FROM my_sessions ms
LEFT JOIN session_players sp ON sp.session_id = ms.id AND sp.user_id = $1;

-- name: GetSessionPlayers :many
SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    sp.result,
    sp.score
FROM users u
JOIN session_players sp ON u.id = sp.user_id
WHERE sp.session_id = $1;
