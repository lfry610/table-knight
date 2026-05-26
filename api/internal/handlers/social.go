package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type SocialHandler struct {
	queries *db.Queries
}

func NewSocialHandler(q *db.Queries) *SocialHandler {
	return &SocialHandler{queries: q}
}

// POST /users/:id/follow
func (h *SocialHandler) Follow(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	targetID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.queries.FollowUser(r.Context(), db.FollowUserParams{
		FollowerID:  mustParseUUID(claims.UserID),
		FollowingID: targetID,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to follow user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /users/:id/follow
func (h *SocialHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	targetID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := h.queries.UnfollowUser(r.Context(), db.UnfollowUserParams{
		FollowerID:  mustParseUUID(claims.UserID),
		FollowingID: targetID,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to unfollow user")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /me/feed?limit=30&offset=0
func (h *SocialHandler) GetFeed(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	limit := int32(30)
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

	items, err := h.queries.GetFeed(r.Context(), db.GetFeedParams{
		UserID: mustParseUUID(claims.UserID),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch feed")
		return
	}
	respond.JSON(w, http.StatusOK, items)
}

// GET /users/search?q=name
func (h *SocialHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	q := r.URL.Query().Get("q")
	if q == "" {
		respond.Error(w, http.StatusBadRequest, "q is required")
		return
	}

	results, err := h.queries.SearchUsers(r.Context(), db.SearchUsersParams{
		Me:    mustParseUUID(claims.UserID),
		Query: pgtype.Text{String: q, Valid: true},
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "search failed")
		return
	}
	respond.JSON(w, http.StatusOK, results)
}

// GET /me/following
func (h *SocialHandler) GetFollowing(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	following, err := h.queries.GetFollowing(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch following")
		return
	}
	respond.JSON(w, http.StatusOK, following)
}

// GET /me/group-mates
func (h *SocialHandler) GetGroupMates(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	mates, err := h.queries.GetGroupMates(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch group mates")
		return
	}
	respond.JSON(w, http.StatusOK, mates)
}

// GET /users/:id — aggregated public profile
func (h *SocialHandler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	viewerID := mustParseUUID(claims.UserID)

	targetID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	ctx := r.Context()

	user, err := h.queries.GetUserByID(ctx, targetID)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "user not found")
		return
	}
	user.Password = ""
	user.GoogleID = pgtype.Text{}

	roundTable, err := h.queries.GetRoundTable(ctx, targetID)
	if err != nil {
		roundTable = nil
	}

	lists, err := h.queries.GetListsByUser(ctx, targetID)
	if err != nil {
		lists = nil
	}

	collection, err := h.queries.GetUserCollection(ctx, targetID)
	if err != nil {
		collection = nil
	}

	isOwn := viewerID == targetID
	isFollowing := false
	if !isOwn {
		isFollowing, _ = h.queries.IsFollowing(ctx, db.IsFollowingParams{
			FollowerID:  viewerID,
			FollowingID: targetID,
		})
	}

	followerCount, _ := h.queries.GetFollowerCount(ctx, targetID)
	followingCount, _ := h.queries.GetFollowingCount(ctx, targetID)

	recentSessions, err := h.queries.GetUserSessions(ctx, db.GetUserSessionsParams{
		LoggedBy: targetID,
		Limit:    5,
		Offset:   0,
	})
	if err != nil {
		recentSessions = nil
	}

	var ownedCount, playedCount int
	for _, g := range collection {
		if g.Status == db.GameStatusOwned {
			ownedCount++
		}
		if g.Played {
			playedCount++
		}
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"user":            user,
		"round_table":     roundTable,
		"lists":           lists,
		"collection":      collection,
		"is_following":    isFollowing,
		"is_own_profile":  isOwn,
		"follower_count":  followerCount,
		"following_count": followingCount,
		"owned_count":     ownedCount,
		"played_count":    playedCount,
		"recent_sessions": recentSessions,
	})
}
