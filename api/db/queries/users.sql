-- db/queries/users.sql

-- name: CreateUser :one
INSERT INTO users (email, display_name, password)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: UpdateUserProfile :one
UPDATE users
SET
    display_name = COALESCE($2, display_name),
    avatar_url   = COALESCE($3, avatar_url)
WHERE id = $1
RETURNING *;
