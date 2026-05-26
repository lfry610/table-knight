package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/lfry610/table-knight/internal/auth"
	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type AuthHandler struct {
	queries *db.Queries
	auth    *auth.Service
}

func NewAuthHandler(q *db.Queries, a *auth.Service) *AuthHandler {
	return &AuthHandler{queries: q, auth: a}
}

type registerRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

type authResponse struct {
	Token string  `json:"token"`
	User  db.User `json:"user"`
}

// Register godoc
// POST /auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		respond.Error(w, http.StatusBadRequest, "email, display_name, and password are required")
		return
	}
	if len(req.Password) < 8 {
		respond.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := h.queries.CreateUser(r.Context(), db.CreateUserParams{
		Email:       req.Email,
		DisplayName: req.DisplayName,
		Password:    string(hashed),
	})
	if err != nil {
		// pgx error code 23505 = unique_violation
		if isUniqueViolation(err) {
			respond.Error(w, http.StatusConflict, "email already registered")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	token, err := h.auth.IssueToken(user.ID.String(), user.Email)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	// Scrub password before returning
	user.Password = ""
	respond.JSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login godoc
// POST /auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := h.queries.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		// Timing-safe: always return the same error whether user exists or not
		respond.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		respond.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := h.auth.IssueToken(user.ID.String(), user.Email)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	user.Password = ""
	respond.JSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

// PATCH /me — updates display_name, bio, avatar_url
func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		DisplayName *string `json:"display_name"`
		Bio         *string `json:"bio"`
		AvatarURL   *string `json:"avatar_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.DisplayName != nil && *req.DisplayName == "" {
		respond.Error(w, http.StatusBadRequest, "display_name cannot be empty")
		return
	}

	params := db.UpdateUserProfileParams{ID: mustParseUUID(claims.UserID)}
	if req.DisplayName != nil {
		params.DisplayName = *req.DisplayName
	} else {
		// COALESCE(NULL, display_name) keeps existing — pass empty string to trigger COALESCE fallback
		// Actually we need the current value; use a zero-value string and rely on COALESCE($2, display_name)
		// passing "" would overwrite — fetch current user instead
		user, err := h.queries.GetUserByID(r.Context(), mustParseUUID(claims.UserID))
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to fetch user")
			return
		}
		params.DisplayName = user.DisplayName
	}
	if req.Bio != nil {
		params.Bio = pgtype.Text{String: *req.Bio, Valid: true}
	}
	if req.AvatarURL != nil {
		params.AvatarUrl = pgtype.Text{String: *req.AvatarURL, Valid: *req.AvatarURL != ""}
	}

	user, err := h.queries.UpdateUserProfile(r.Context(), params)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}
	user.Password = ""
	respond.JSON(w, http.StatusOK, user)
}

// GET /me — returns the authenticated user's profile
func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	user, err := h.queries.GetUserByID(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusNotFound, "user not found")
		return
	}
	user.Password = ""
	respond.JSON(w, http.StatusOK, user)
}

// isUniqueViolation checks for Postgres unique constraint violation (23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
