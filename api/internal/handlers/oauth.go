package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/lfry610/table-knight/internal/auth"
	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/respond"
)

type OAuthHandler struct {
	queries     *db.Queries
	auth        *auth.Service
	oauthCfg    *oauth2.Config
	frontendURL string
}

func NewOAuthHandler(q *db.Queries, a *auth.Service, clientID, clientSecret, redirectURL, frontendURL string) *OAuthHandler {
	return &OAuthHandler{
		queries: q,
		auth:    a,
		oauthCfg: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		},
		frontendURL: frontendURL,
	}
}

// GET /auth/google — redirect to Google consent screen
func (h *OAuthHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	state := randomHex(16)
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   300,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, h.oauthCfg.AuthCodeURL(state), http.StatusTemporaryRedirect)
}

type googleUserInfo struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// GET /auth/google/callback — exchange code, upsert user, issue JWT, redirect to frontend
func (h *OAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		respond.Error(w, http.StatusBadRequest, "invalid state")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", MaxAge: -1, Path: "/"})

	token, err := h.oauthCfg.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "failed to exchange code")
		return
	}

	client := h.oauthCfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to get user info from Google")
		return
	}
	defer resp.Body.Close()

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to decode user info")
		return
	}

	user, err := h.findOrCreateUser(r.Context(), &info)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to sign in")
		return
	}

	jwt, err := h.auth.IssueToken(user.ID.String(), user.Email)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	http.Redirect(w, r, h.frontendURL+"/auth/callback?token="+jwt, http.StatusTemporaryRedirect)
}

func (h *OAuthHandler) findOrCreateUser(ctx context.Context, info *googleUserInfo) (db.User, error) {
	googleID := pgtype.Text{String: info.Sub, Valid: true}
	avatarURL := pgtype.Text{String: info.Picture, Valid: info.Picture != ""}

	// 1. Found by google_id — returning user
	user, err := h.queries.GetUserByGoogleID(ctx, googleID)
	if err == nil {
		return user, nil
	}

	// 2. Found by email — link google_id (existing email/password user signs in with Google)
	if _, err := h.queries.GetUserByEmail(ctx, info.Email); err == nil {
		return h.queries.LinkGoogleID(ctx, db.LinkGoogleIDParams{
			GoogleID:  googleID,
			Email:     info.Email,
			AvatarUrl: avatarURL,
		})
	}

	// 3. New user — create with a random unusable password (Google users authenticate via OAuth)
	return h.queries.CreateGoogleUser(ctx, db.CreateGoogleUserParams{
		Email:       info.Email,
		DisplayName: info.Name,
		AvatarUrl:   avatarURL,
		GoogleID:    googleID,
		Password:    randomHex(32),
	})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
