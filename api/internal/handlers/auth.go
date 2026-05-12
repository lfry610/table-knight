package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/yourusername/table-night/internal/auth"
	"github.com/yourusername/table-night/internal/db"
	"github.com/yourusername/table-night/internal/respond"
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

// isUniqueViolation checks for Postgres unique constraint violation (23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
