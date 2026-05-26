package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type ListsHandler struct {
	queries     *db.Queries
	pool        *pgxpool.Pool
	bggBaseURL  string
	bggAPIToken string
	httpClient  *http.Client
}

func NewListsHandler(q *db.Queries, pool *pgxpool.Pool, bggBaseURL, bggAPIToken string) *ListsHandler {
	return &ListsHandler{
		queries:     q,
		pool:        pool,
		bggBaseURL:  bggBaseURL,
		bggAPIToken: bggAPIToken,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

// POST /lists
func (h *ListsHandler) CreateList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		Title       string  `json:"title"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		respond.Error(w, http.StatusBadRequest, "title is required")
		return
	}

	var desc pgtype.Text
	if req.Description != nil {
		desc = pgtype.Text{String: *req.Description, Valid: true}
	}

	userID := mustParseUUID(claims.UserID)
	list, err := h.queries.CreateList(r.Context(), db.CreateListParams{
		UserID:      userID,
		Title:       req.Title,
		Description: desc,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create list")
		return
	}

	_ = h.queries.InsertActivity(r.Context(), db.InsertActivityParams{
		UserID:  userID,
		Type:    db.ActivityTypeListCreated,
		ListID:  list.ID,
		GroupID: pgtype.UUID{},
	})

	respond.JSON(w, http.StatusCreated, list)
}

// GET /me/lists
func (h *ListsHandler) GetMyLists(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	lists, err := h.queries.GetListsByUser(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch lists")
		return
	}
	respond.JSON(w, http.StatusOK, lists)
}

// GET /lists/:id
func (h *ListsHandler) GetList(w http.ResponseWriter, r *http.Request) {
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	list, err := h.queries.GetListByID(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "list not found")
		return
	}

	games, err := h.queries.GetListGames(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch list games")
		return
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"list":  list,
		"games": games,
	})
}

// PATCH /lists/:id
func (h *ListsHandler) UpdateList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var title pgtype.Text
	if req.Title != nil {
		title = pgtype.Text{String: *req.Title, Valid: true}
	}
	var desc pgtype.Text
	if req.Description != nil {
		desc = pgtype.Text{String: *req.Description, Valid: true}
	}

	list, err := h.queries.UpdateList(r.Context(), db.UpdateListParams{
		ID:          listID,
		UserID:      mustParseUUID(claims.UserID),
		Title:       title,
		Description: desc,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to update list")
		return
	}
	respond.JSON(w, http.StatusOK, list)
}

// DELETE /lists/:id
func (h *ListsHandler) DeleteList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.queries.DeleteList(r.Context(), db.DeleteListParams{
		ID:     listID,
		UserID: mustParseUUID(claims.UserID),
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete list")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /lists/:id/games  body: { bgg_id: number }
func (h *ListsHandler) AddGame(w http.ResponseWriter, r *http.Request) {
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req struct {
		BGGID int `json:"bgg_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BGGID == 0 {
		respond.Error(w, http.StatusBadRequest, "bgg_id is required")
		return
	}

	// Reuse GamesHandler BGG fetch logic via the shared helper
	gh := &GamesHandler{
		queries:     h.queries,
		bggBaseURL:  h.bggBaseURL,
		bggAPIToken: h.bggAPIToken,
		httpClient:  h.httpClient,
	}
	game, err := gh.fetchAndCacheGame(r, req.BGGID)
	if err != nil {
		game, err = h.queries.GetGameByBGGID(r.Context(), int32(req.BGGID))
		if err != nil {
			respond.Error(w, http.StatusBadGateway, "game not found")
			return
		}
	}

	count, err := h.queries.GetListGameCount(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to get list size")
		return
	}

	if err := h.queries.AddGameToList(r.Context(), db.AddGameToListParams{
		ListID:   listID,
		GameID:   game.ID,
		Position: int16(count + 1),
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to add game to list")
		return
	}

	games, err := h.queries.GetListGames(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch list games")
		return
	}
	respond.JSON(w, http.StatusOK, games)
}

// PUT /lists/:id/reorder  body: { game_ids: ["uuid", ...] }
func (h *ListsHandler) ReorderGames(w http.ResponseWriter, r *http.Request) {
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req struct {
		GameIDs []string `json:"game_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	gameIDs := make([]pgtype.UUID, 0, len(req.GameIDs))
	for _, idStr := range req.GameIDs {
		gameID, ok := parseUUID(w, idStr)
		if !ok {
			return
		}
		gameIDs = append(gameIDs, gameID)
	}

	// Delete-and-reinsert inside a transaction to avoid the UNIQUE(list_id, position)
	// constraint firing when two games temporarily share a position mid-loop.
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to reorder games")
		return
	}
	defer tx.Rollback(r.Context()) //nolint:errcheck

	if _, err := tx.Exec(r.Context(), "DELETE FROM list_games WHERE list_id = $1", listID); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to reorder games")
		return
	}

	qtx := h.queries.WithTx(tx)
	for i, gameID := range gameIDs {
		if err := qtx.AddGameToList(r.Context(), db.AddGameToListParams{
			ListID:   listID,
			GameID:   gameID,
			Position: int16(i + 1),
		}); err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to reorder games")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to reorder games")
		return
	}

	games, err := h.queries.GetListGames(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch list games")
		return
	}
	respond.JSON(w, http.StatusOK, games)
}

// DELETE /lists/:id/games/:gameID
func (h *ListsHandler) RemoveGame(w http.ResponseWriter, r *http.Request) {
	listID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	gameID, ok := parseUUID(w, chi.URLParam(r, "gameID"))
	if !ok {
		return
	}

	if err := h.queries.RemoveGameFromList(r.Context(), db.RemoveGameFromListParams{
		ListID: listID,
		GameID: gameID,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to remove game")
		return
	}

	games, err := h.queries.GetListGames(r.Context(), listID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch list games")
		return
	}
	respond.JSON(w, http.StatusOK, games)
}
