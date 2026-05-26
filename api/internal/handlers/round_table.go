package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type RoundTableHandler struct {
	queries *db.Queries
	games   *GamesHandler
}

func NewRoundTableHandler(q *db.Queries, g *GamesHandler) *RoundTableHandler {
	return &RoundTableHandler{queries: q, games: g}
}

// GET /me/round-table
func (h *RoundTableHandler) GetRoundTable(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	slots, err := h.queries.GetRoundTable(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch round table")
		return
	}
	respond.JSON(w, http.StatusOK, slots)
}

// PUT /me/round-table — accepts { bgg_ids: [int, ...] } (max 5)
func (h *RoundTableHandler) SetRoundTable(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		BggIDs []int `json:"bgg_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.BggIDs) > 5 {
		respond.Error(w, http.StatusBadRequest, "round table holds at most 5 games")
		return
	}

	userID := mustParseUUID(claims.UserID)
	ctx := r.Context()

	if err := h.queries.ClearRoundTable(ctx, userID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to update round table")
		return
	}

	for i, bggID := range req.BggIDs {
		game, err := h.games.fetchAndCacheGame(r, bggID)
		if err != nil {
			game, err = h.queries.GetGameByBGGID(ctx, int32(bggID))
			if err != nil {
				respond.Error(w, http.StatusBadGateway, "failed to resolve game")
				return
			}
		}
		if err := h.queries.SetRoundTableSlot(ctx, db.SetRoundTableSlotParams{
			UserID:   userID,
			GameID:   game.ID,
			Position: int16(i + 1),
		}); err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to set round table slot")
			return
		}
	}

	slots, err := h.queries.GetRoundTable(ctx, userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch round table")
		return
	}
	respond.JSON(w, http.StatusOK, slots)
}
