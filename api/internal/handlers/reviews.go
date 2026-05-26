package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type ReviewsHandler struct {
	queries *db.Queries
}

func NewReviewsHandler(q *db.Queries) *ReviewsHandler {
	return &ReviewsHandler{queries: q}
}

// POST /reviews
func (h *ReviewsHandler) UpsertReview(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		GameID string  `json:"game_id"`
		Rating float32 `json:"rating"`
		Body   *string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Rating < 0.5 || req.Rating > 5.0 {
		respond.Error(w, http.StatusBadRequest, "rating must be between 0.5 and 5.0")
		return
	}

	gameID, ok := parseUUID(w, req.GameID)
	if !ok {
		return
	}

	var body pgtype.Text
	if req.Body != nil && *req.Body != "" {
		body = pgtype.Text{String: *req.Body, Valid: true}
	}

	review, err := h.queries.UpsertReview(r.Context(), db.UpsertReviewParams{
		UserID: mustParseUUID(claims.UserID),
		GameID: gameID,
		Rating: req.Rating,
		Body:   body,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to save review")
		return
	}

	respond.JSON(w, http.StatusOK, review)
}

// GET /me/reviews
func (h *ReviewsHandler) GetMyReviews(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	reviews, err := h.queries.GetUserReviews(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch reviews")
		return
	}
	respond.JSON(w, http.StatusOK, reviews)
}

// GET /me/reviewable-games
func (h *ReviewsHandler) GetReviewableGames(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	games, err := h.queries.GetReviewableGames(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch games")
		return
	}
	respond.JSON(w, http.StatusOK, games)
}

// DELETE /reviews/:gameId
func (h *ReviewsHandler) DeleteReview(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	gameID, ok := parseUUID(w, chi.URLParam(r, "gameId"))
	if !ok {
		return
	}
	if err := h.queries.DeleteReview(r.Context(), db.DeleteReviewParams{
		UserID: mustParseUUID(claims.UserID),
		GameID: gameID,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete review")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
