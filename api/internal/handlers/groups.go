package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type GroupsHandler struct {
	queries *db.Queries
}

func NewGroupsHandler(q *db.Queries) *GroupsHandler {
	return &GroupsHandler{queries: q}
}

// CreateGroup godoc
// POST /groups
func (h *GroupsHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	group, err := h.queries.CreateGroup(r.Context(), db.CreateGroupParams{
		Name:      req.Name,
		CreatedBy: mustParseUUID(claims.UserID),
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create group")
		return
	}

	// Creator becomes admin automatically
	if _, err := h.queries.AddGroupMember(r.Context(), db.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  mustParseUUID(claims.UserID),
		Role:    db.MemberRoleAdmin,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to add creator to group")
		return
	}

	respond.JSON(w, http.StatusCreated, group)
}

// JoinGroup godoc
// POST /groups/join   body: { "invite_code": "abc12345" }
func (h *GroupsHandler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req struct {
		InviteCode string `json:"invite_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.InviteCode == "" {
		respond.Error(w, http.StatusBadRequest, "invite_code is required")
		return
	}

	group, err := h.queries.GetGroupByInviteCode(r.Context(), req.InviteCode)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "invite code not found")
		return
	}

	_, err = h.queries.AddGroupMember(r.Context(), db.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  mustParseUUID(claims.UserID),
		Role:    db.MemberRoleMember,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to join group")
		return
	}

	_ = h.queries.InsertActivity(r.Context(), db.InsertActivityParams{
		UserID:  mustParseUUID(claims.UserID),
		Type:    db.ActivityTypeGroupJoined,
		GroupID: group.ID,
	})

	respond.JSON(w, http.StatusOK, group)
}

// GetGroup godoc
// GET /groups/:id
func (h *GroupsHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	groupID, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	// Verify membership before returning group details
	isMember, err := h.queries.IsGroupMember(r.Context(), db.IsGroupMemberParams{
		GroupID: groupID,
		UserID:  mustParseUUID(claims.UserID),
	})
	if err != nil || !isMember {
		respond.Error(w, http.StatusForbidden, "not a member of this group")
		return
	}

	group, err := h.queries.GetGroupByID(r.Context(), groupID)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "group not found")
		return
	}

	members, err := h.queries.GetGroupMembers(r.Context(), group.ID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch members")
		return
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"group":   group,
		"members": members,
	})
}

// GetGroupCollection godoc
// GET /groups/:id/collection
func (h *GroupsHandler) GetGroupCollection(w http.ResponseWriter, r *http.Request) {
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

	games, err := h.queries.GetGroupCollection(r.Context(), groupID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch group collection")
		return
	}

	respond.JSON(w, http.StatusOK, games)
}

// GetMyGroups godoc
// GET /me/groups
func (h *GroupsHandler) GetMyGroups(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	groups, err := h.queries.GetUserGroups(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch groups")
		return
	}

	respond.JSON(w, http.StatusOK, groups)
}
