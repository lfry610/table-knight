package handlers

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/yourusername/table-night/internal/db"
	"github.com/yourusername/table-night/internal/middleware"
	"github.com/yourusername/table-night/internal/respond"
)

type GamesHandler struct {
	queries    *db.Queries
	bggBaseURL string
	httpClient *http.Client
}

func NewGamesHandler(q *db.Queries, bggBaseURL string) *GamesHandler {
	return &GamesHandler{
		queries:    q,
		bggBaseURL: bggBaseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// ── BGG search proxy ──────────────────────────────────────────────────────────

// BGG XML response structs (minimal — only fields we care about)
type bggSearchResp struct {
	Items []bggItem `xml:"item"`
}

type bggItem struct {
	ID        int           `xml:"id,attr"`
	Name      []bggName     `xml:"name"`
	YearPub   bggYear       `xml:"yearpublished"`
	MinPlayer bggIntValue   `xml:"minplayers"`
	MaxPlayer bggIntValue   `xml:"maxplayers"`
	PlayTime  bggIntValue   `xml:"playingtime"`
	Image     string        `xml:"image"`
	Stats     bggStats      `xml:"statistics>ratings"`
}

type bggName struct {
	Type  string `xml:"type,attr"`
	Value string `xml:"value,attr"`
}

type bggYear     struct{ Value int `xml:"value,attr"` }
type bggIntValue struct{ Value int `xml:"value,attr"` }
type bggStats    struct{ Average bggFloat `xml:"average"` }
type bggFloat    struct{ Value float64 `xml:"value,attr"` }

// SearchGames godoc
// GET /games/search?q=catan
func (h *GamesHandler) SearchGames(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		respond.Error(w, http.StatusBadRequest, "q query parameter is required")
		return
	}

	searchURL := fmt.Sprintf("%s/search?query=%s&type=boardgame", h.bggBaseURL, url.QueryEscape(q))
	resp, err := h.httpClient.Get(searchURL)
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "failed to reach BGG API")
		return
	}
	defer resp.Body.Close()

	var searchResult bggSearchResp
	if err := xml.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to parse BGG response")
		return
	}

	type searchHit struct {
		BGGID   int    `json:"bgg_id"`
		Title   string `json:"title"`
		YearPub int    `json:"year_published"`
	}

	hits := make([]searchHit, 0, len(searchResult.Items))
	for _, item := range searchResult.Items {
		title := ""
		for _, n := range item.Name {
			if n.Type == "primary" {
				title = n.Value
				break
			}
		}
		hits = append(hits, searchHit{
			BGGID:   item.ID,
			Title:   title,
			YearPub: item.YearPub.Value,
		})
	}

	respond.JSON(w, http.StatusOK, hits)
}

// ── Collection ────────────────────────────────────────────────────────────────

// GetMyCollection godoc
// GET /me/collection
func (h *GamesHandler) GetMyCollection(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	games, err := h.queries.GetUserCollection(r.Context(), mustParseUUID(claims.UserID))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch collection")
		return
	}
	respond.JSON(w, http.StatusOK, games)
}

type addToCollectionRequest struct {
	BGGID  int    `json:"bgg_id"`
	Status string `json:"status"`
}

// AddToCollection godoc
// POST /me/collection
func (h *GamesHandler) AddToCollection(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req addToCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Fetch and cache game from BGG if not already stored
	game, err := h.queries.GetGameByBGGID(r.Context(), int32(req.BGGID))
	if err != nil {
		// Not cached — fetch from BGG and upsert
		game, err = h.fetchAndCacheGame(r, req.BGGID)
		if err != nil {
			respond.Error(w, http.StatusBadGateway, "failed to fetch game from BGG")
			return
		}
	}

	status := db.GameStatus(req.Status)
	if status == "" {
		status = db.GameStatusOwned
	}

	entry, err := h.queries.AddGameToCollection(r.Context(), db.AddGameToCollectionParams{
		UserID: mustParseUUID(claims.UserID),
		GameID: game.ID,
		Status: status,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to add game to collection")
		return
	}

	respond.JSON(w, http.StatusCreated, entry)
}

// UpdateCollectionEntry godoc
// PATCH /me/collection/:gameID
func (h *GamesHandler) UpdateCollectionEntry(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	gameID, ok := parseUUID(w, chi.URLParam(r, "gameID"))
	if !ok {
		return
	}

	var req struct {
		Status     *string `json:"status"`
		UserRating *int32  `json:"user_rating"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var status db.NullGameStatus
	if req.Status != nil {
		status = db.NullGameStatus{GameStatus: db.GameStatus(*req.Status), Valid: true}
	}

	var rating db.NullInt4
	if req.UserRating != nil {
		rating = db.NullInt4{Int32: *req.UserRating, Valid: true}
	}

	entry, err := h.queries.UpdateCollectionEntry(r.Context(), db.UpdateCollectionEntryParams{
		UserID:     mustParseUUID(claims.UserID),
		GameID:     gameID,
		Status:     status,
		UserRating: rating,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to update collection")
		return
	}

	respond.JSON(w, http.StatusOK, entry)
}

// fetchAndCacheGame fetches a single game's details from BGG and upserts it.
func (h *GamesHandler) fetchAndCacheGame(r *http.Request, bggID int) (db.Game, error) {
	fetchURL := fmt.Sprintf("%s/thing?id=%d&stats=1", h.bggBaseURL, bggID)
	resp, err := h.httpClient.Get(fetchURL)
	if err != nil {
		return db.Game{}, err
	}
	defer resp.Body.Close()

	var result struct {
		Items []bggItem `xml:"item"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Items) == 0 {
		return db.Game{}, fmt.Errorf("invalid BGG response")
	}

	item := result.Items[0]
	title := ""
	for _, n := range item.Name {
		if n.Type == "primary" {
			title = n.Value
			break
		}
	}

	return h.queries.UpsertGame(r.Context(), db.UpsertGameParams{
		BggID:        int32(item.ID),
		Title:        title,
		MinPlayers:   int32(item.MinPlayer.Value),
		MaxPlayers:   int32(item.MaxPlayer.Value),
		PlaytimeMins: db.NullInt4{Int32: int32(item.PlayTime.Value), Valid: item.PlayTime.Value > 0},
		ImageUrl:     db.NullString{String: item.Image, Valid: item.Image != ""},
	})
}

// mustParseUUID parses a trusted UUID string (e.g. from JWT claims). Panics on invalid input.
func mustParseUUID(s string) pgtype.UUID {
	var id pgtype.UUID
	if err := id.Scan(s); err != nil {
		panic(fmt.Sprintf("invalid UUID %q: %v", s, err))
	}
	return id
}

// parseUUID parses a UUID from a user-provided string. Writes a 400 and returns false on failure.
func parseUUID(w http.ResponseWriter, s string) (pgtype.UUID, bool) {
	var id pgtype.UUID
	if err := id.Scan(s); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid ID")
		return pgtype.UUID{}, false
	}
	return id, true
}
