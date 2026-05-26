package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type SessionsHandler struct {
	queries *db.Queries
}

func NewSessionsHandler(q *db.Queries) *SessionsHandler {
	return &SessionsHandler{queries: q}
}

type createSessionRequest struct {
	GroupID      *string        `json:"group_id"`
	BGGID        int            `json:"bgg_id"`
	PlayedAt     *time.Time     `json:"played_at"`
	DurationMins *int32         `json:"duration_mins"`
	Notes        *string        `json:"notes"`
	Players      []playerResult `json:"players"`
}

type playerResult struct {
	UserID string `json:"user_id"`
	Result string `json:"result"` // win | loss | draw | dnf
	Score  *int32 `json:"score"`
}

// CreateSession godoc
// POST /sessions
func (h *SessionsHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req createSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.BGGID == 0 {
		respond.Error(w, http.StatusBadRequest, "bgg_id is required")
		return
	}
	if len(req.Players) == 0 {
		respond.Error(w, http.StatusBadRequest, "at least one player is required")
		return
	}

	game, err := h.queries.GetGameByBGGID(r.Context(), int32(req.BGGID))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "game not found — add it to your collection first")
		return
	}

	playedAt := time.Now()
	if req.PlayedAt != nil {
		playedAt = *req.PlayedAt
	}

	var groupID pgtype.UUID
	if req.GroupID != nil {
		groupID = mustParseUUID(*req.GroupID)
	}

	var duration pgtype.Int4
	if req.DurationMins != nil {
		duration = pgtype.Int4{Int32: *req.DurationMins, Valid: true}
	}

	var notes pgtype.Text
	if req.Notes != nil {
		notes = pgtype.Text{String: *req.Notes, Valid: true}
	}

	var playedAtTS pgtype.Timestamptz
	if err := playedAtTS.Scan(playedAt); err != nil {
		respond.Error(w, http.StatusInternalServerError, "invalid played_at timestamp")
		return
	}

	session, err := h.queries.CreateSession(r.Context(), db.CreateSessionParams{
		GroupID:      groupID,
		GameID:       game.ID,
		PlayedAt:     playedAtTS,
		DurationMins: duration,
		Notes:        notes,
		LoggedBy:     mustParseUUID(claims.UserID),
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Log each player result
	for _, p := range req.Players {
		var score pgtype.Int4
		if p.Score != nil {
			score = pgtype.Int4{Int32: *p.Score, Valid: true}
		}
		if _, err := h.queries.AddSessionPlayer(r.Context(), db.AddSessionPlayerParams{
			SessionID: session.ID,
			UserID:    mustParseUUID(p.UserID),
			Result:    db.SessionResult(p.Result),
			Score:     score,
		}); err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to save player results")
			return
		}
	}

	// Add game to each player's collection as "played" if not already present
	allPlayerIDs := make([]pgtype.UUID, 0, len(req.Players)+1)
	allPlayerIDs = append(allPlayerIDs, mustParseUUID(claims.UserID))
	for _, p := range req.Players {
		pid := mustParseUUID(p.UserID)
		if pid != mustParseUUID(claims.UserID) {
			allPlayerIDs = append(allPlayerIDs, pid)
		}
	}
	for _, pid := range allPlayerIDs {
		_ = h.queries.AddToCollectionIfAbsent(r.Context(), db.AddToCollectionIfAbsentParams{
			UserID: pid,
			GameID: game.ID,
		})
	}

	// Best-effort activity write — don't fail the request if this errors
	_ = h.queries.InsertActivity(r.Context(), db.InsertActivityParams{
		UserID:    mustParseUUID(claims.UserID),
		Type:      db.ActivityTypeSessionLogged,
		GameID:    session.GameID,
		SessionID: session.ID,
		ListID:    pgtype.UUID{},
		GroupID:   pgtype.UUID{},
	})

	respond.JSON(w, http.StatusCreated, session)
}

// GetGroupSessions godoc
// GET /groups/:id/sessions?limit=20&offset=0
func (h *SessionsHandler) GetGroupSessions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	isMember, err := h.queries.IsGroupMember(r.Context(), db.IsGroupMemberParams{
		GroupID: groupID,
		UserID:  mustParseUUID(claims.UserID),
	})
	if err != nil || !isMember {
		respond.Error(w, http.StatusForbidden, "not a member of this group")
		return
	}

	limit := int32(20)
	offset := int32(0)
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = int32(v)
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			offset = int32(v)
		}
	}

	sessions, err := h.queries.GetGroupSessions(r.Context(), db.GetGroupSessionsParams{
		GroupID: groupID,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch sessions")
		return
	}

	respond.JSON(w, http.StatusOK, sessions)
}

// UpdateSession godoc
// PATCH /sessions/:id
func (h *SessionsHandler) UpdateSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	sessionID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var req struct {
		PlayedAt time.Time `json:"played_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	var playedAtTS pgtype.Timestamptz
	if err := playedAtTS.Scan(req.PlayedAt); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid played_at")
		return
	}
	if err := h.queries.UpdateSession(r.Context(), db.UpdateSessionParams{
		ID:       sessionID,
		PlayedAt: playedAtTS,
		LoggedBy: mustParseUUID(claims.UserID),
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to update session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteSession godoc
// DELETE /sessions/:id
func (h *SessionsHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	sessionID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.queries.DeleteSession(r.Context(), db.DeleteSessionParams{
		ID:       sessionID,
		LoggedBy: mustParseUUID(claims.UserID),
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateSessionPlayers godoc
// PATCH /sessions/:id/players
func (h *SessionsHandler) UpdateSessionPlayers(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var players []struct {
		UserID string `json:"user_id"`
		Result string `json:"result"`
		Score  *int32 `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&players); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	for _, p := range players {
		var score pgtype.Int4
		if p.Score != nil {
			score = pgtype.Int4{Int32: *p.Score, Valid: true}
		}
		if err := h.queries.UpdateSessionPlayer(r.Context(), db.UpdateSessionPlayerParams{
			SessionID: sessionID,
			UserID:    mustParseUUID(p.UserID),
			Result:    db.SessionResult(p.Result),
			Score:     score,
		}); err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to update player")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetSessionPlayers godoc
// GET /sessions/:id/players
func (h *SessionsHandler) GetSessionPlayers(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	players, err := h.queries.GetSessionPlayers(r.Context(), sessionID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch players")
		return
	}
	respond.JSON(w, http.StatusOK, players)
}

// GetMyStats godoc
// GET /me/stats
func (h *SessionsHandler) GetMyStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	stats, err := h.queries.GetUserStats(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch stats")
		return
	}
	respond.JSON(w, http.StatusOK, stats)
}

// GetMySessions godoc
// GET /me/sessions?limit=20&offset=0
func (h *SessionsHandler) GetMySessions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	limit := int32(20)
	offset := int32(0)
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = int32(v)
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			offset = int32(v)
		}
	}

	sessions, err := h.queries.GetUserSessions(r.Context(), db.GetUserSessionsParams{
		LoggedBy: mustParseUUID(claims.UserID),
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch sessions")
		return
	}

	respond.JSON(w, http.StatusOK, sessions)
}
