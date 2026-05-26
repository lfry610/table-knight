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
    bio          = COALESCE($3, bio),
    avatar_url   = COALESCE($4, avatar_url)
WHERE id = $1
RETURNING *;

-- name: GetUserByGoogleID :one
SELECT * FROM users WHERE google_id = sqlc.arg(google_id);

-- name: CreateGoogleUser :one
INSERT INTO users (email, display_name, avatar_url, google_id, password)
VALUES (sqlc.arg(email), sqlc.arg(display_name), sqlc.arg(avatar_url), sqlc.arg(google_id), sqlc.arg(password))
RETURNING *;

-- name: LinkGoogleID :one
UPDATE users
SET
    google_id  = sqlc.arg(google_id),
    avatar_url = COALESCE(sqlc.arg(avatar_url), avatar_url)
WHERE email = sqlc.arg(email)
RETURNING *;
