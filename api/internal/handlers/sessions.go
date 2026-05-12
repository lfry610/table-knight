package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/yourusername/table-night/internal/db"
	"github.com/yourusername/table-night/internal/middleware"
	"github.com/yourusername/table-night/internal/respond"
)

type SessionsHandler struct {
	queries *db.Queries
}

func NewSessionsHandler(q *db.Queries) *SessionsHandler {
	return &SessionsHandler{queries: q}
}

type createSessionRequest struct {
	GroupID      *string         `json:"group_id"`
	BGGID        int             `json:"bgg_id"`
	PlayedAt     *time.Time      `json:"played_at"`
	DurationMins *int32          `json:"duration_mins"`
	Notes        *string         `json:"notes"`
	Players      []playerResult  `json:"players"`
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

	var groupID db.NullUUID
	if req.GroupID != nil {
		groupID = db.NullUUID{UUID: mustParseUUID(*req.GroupID), Valid: true}
	}

	var duration db.NullInt4
	if req.DurationMins != nil {
		duration = db.NullInt4{Int32: *req.DurationMins, Valid: true}
	}

	var notes db.NullString
	if req.Notes != nil {
		notes = db.NullString{String: *req.Notes, Valid: true}
	}

	session, err := h.queries.CreateSession(r.Context(), db.CreateSessionParams{
		GroupID:      groupID,
		GameID:       game.ID,
		PlayedAt:     playedAt,
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
		var score db.NullInt4
		if p.Score != nil {
			score = db.NullInt4{Int32: *p.Score, Valid: true}
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
