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
