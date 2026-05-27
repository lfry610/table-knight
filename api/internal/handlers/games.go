package handlers

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/respond"
)

type GamesHandler struct {
	queries     *db.Queries
	bggBaseURL  string
	bggAPIToken string
	httpClient  *http.Client
}

func NewGamesHandler(q *db.Queries, bggBaseURL, bggAPIToken string) *GamesHandler {
	return &GamesHandler{
		queries:     q,
		bggBaseURL:  bggBaseURL,
		bggAPIToken: bggAPIToken,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
	}
}

// ── BGG search proxy ──────────────────────────────────────────────────────────

// BGG XML response structs (minimal — only fields we care about)
type bggSearchResp struct {
	Items []bggItem `xml:"item"`
}

type bggItem struct {
	ID          int         `xml:"id,attr"`
	Name        []bggName   `xml:"name"`
	YearPub     bggYear     `xml:"yearpublished"`
	MinPlayer   bggIntValue `xml:"minplayers"`
	MaxPlayer   bggIntValue `xml:"maxplayers"`
	PlayTime    bggIntValue `xml:"playingtime"`
	Image       string      `xml:"image"`
	Description string      `xml:"description"`
	Links       []bggLink   `xml:"link"`
	Stats       bggStats    `xml:"statistics>ratings"`
}

type bggName struct {
	Type  string `xml:"type,attr"`
	Value string `xml:"value,attr"`
}

type bggLink struct {
	Type  string `xml:"type,attr"`
	Value string `xml:"value,attr"`
}

type bggYear struct {
	Value int `xml:"value,attr"`
}
type bggIntValue struct {
	Value int `xml:"value,attr"`
}
type bggStats struct {
	Average       bggFloat `xml:"average"`
	AverageWeight bggFloat `xml:"averageweight"`
}
type bggFloat struct {
	Value float64 `xml:"value,attr"`
}

// SearchGames godoc
// GET /games/search?q=catan
func (h *GamesHandler) SearchGames(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		respond.Error(w, http.StatusBadRequest, "q query parameter is required")
		return
	}

	// Fire exact and fuzzy searches concurrently.
	type bggResult struct {
		hits []searchHit
		err  error
	}
	exactCh := make(chan bggResult, 1)
	fuzzyCh := make(chan bggResult, 1)

	fetch := func(u string, ch chan<- bggResult) {
		resp, err := h.bggGet(u)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			ch <- bggResult{err: err}
			return
		}
		defer resp.Body.Close()
		var sr bggSearchResp
		if err := xml.NewDecoder(resp.Body).Decode(&sr); err != nil {
			ch <- bggResult{err: err}
			return
		}
		hits := make([]searchHit, 0, len(sr.Items))
		for _, item := range sr.Items {
			for _, n := range item.Name {
				if n.Type == "primary" && n.Value != "" {
					hits = append(hits, searchHit{BGGID: item.ID, Title: n.Value, YearPub: item.YearPub.Value})
					break
				}
			}
		}
		ch <- bggResult{hits: hits}
	}

	// Also search local cache concurrently — BGG's search omits some games
	// (e.g. short titles like "Ra") so cached games supplement the results.
	type localResult struct {
		hits []searchHit
		err  error
	}
	localCh := make(chan localResult, 1)

	var wg sync.WaitGroup
	wg.Add(3)
	go func() { defer wg.Done(); fetch(fmt.Sprintf("%s/search?query=%s&type=boardgame&exact=1", h.bggBaseURL, url.QueryEscape(q)), exactCh) }()
	go func() { defer wg.Done(); fetch(fmt.Sprintf("%s/search?query=%s&type=boardgame", h.bggBaseURL, url.QueryEscape(q)), fuzzyCh) }()
	go func() {
		defer wg.Done()
		games, err := h.queries.SearchLocalGames(r.Context(), pgtype.Text{String: q, Valid: true})
		if err != nil {
			localCh <- localResult{err: err}
			return
		}
		hits := make([]searchHit, 0, len(games))
		for _, g := range games {
			hits = append(hits, searchHit{BGGID: int(g.BggID), Title: g.Title})
		}
		localCh <- localResult{hits: hits}
	}()
	wg.Wait()

	exactRes := <-exactCh
	fuzzyRes := <-fuzzyCh
	localRes := <-localCh

	if exactRes.err == nil || fuzzyRes.err == nil || localRes.err == nil {
		seen := make(map[int]bool)
		merged := make([]searchHit, 0)

		// Local cache first — these are games the platform knows about; rank them
		localRanked := localRes.hits
		rankHits(localRanked, q)
		for _, h := range localRanked {
			if !seen[h.BGGID] {
				seen[h.BGGID] = true
				merged = append(merged, h)
			}
		}

		// Then BGG exact matches
		for _, h := range exactRes.hits {
			if !seen[h.BGGID] {
				seen[h.BGGID] = true
				merged = append(merged, h)
			}
		}

		// Then BGG fuzzy results ranked
		fuzzyRanked := fuzzyRes.hits
		rankHits(fuzzyRanked, q)
		for _, h := range fuzzyRanked {
			if !seen[h.BGGID] {
				seen[h.BGGID] = true
				merged = append(merged, h)
			}
		}
		respond.JSON(w, http.StatusOK, merged)
		return
	}

	// All sources unavailable
	slog.Warn("BGG search unavailable, falling back to local search", "query", q)
	games, err := h.queries.SearchLocalGames(r.Context(), pgtype.Text{String: q, Valid: true})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "search unavailable")
		return
	}
	hits := make([]searchHit, 0, len(games))
	for _, g := range games {
		hits = append(hits, searchHit{BGGID: int(g.BggID), Title: g.Title})
	}
	respond.JSON(w, http.StatusOK, hits)
}

type searchHit struct {
	BGGID   int    `json:"bgg_id"`
	Title   string `json:"title"`
	YearPub int    `json:"year_published"`
}

// rankHits sorts results: exact title match first, then everything else by
// year descending so popular classics beat newer partial matches.
func rankHits(hits []searchHit, q string) {
	q = strings.ToLower(q)
	sort.SliceStable(hits, func(i, j int) bool {
		ei := strings.ToLower(hits[i].Title) == q
		ej := strings.ToLower(hits[j].Title) == q
		if ei != ej {
			return ei
		}
		return hits[i].YearPub > hits[j].YearPub
	})
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

// RemoveFromCollection godoc
// DELETE /me/collection/:gameID
func (h *GamesHandler) RemoveFromCollection(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	gameID, ok := parseUUID(w, chi.URLParam(r, "gameID"))
	if !ok {
		return
	}
	if err := h.queries.RemoveFromCollection(r.Context(), db.RemoveFromCollectionParams{
		UserID: mustParseUUID(claims.UserID),
		GameID: gameID,
	}); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to remove game")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

	// Always re-fetch from BGG to ensure image URLs and stats are fresh
	game, err := h.fetchAndCacheGame(r, req.BGGID)
	if err != nil {
		// BGG unavailable — fall back to cached version if it exists
		game, err = h.queries.GetGameByBGGID(r.Context(), int32(req.BGGID))
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
		Played: status == db.GameStatusPlayed,
	})
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to add game to collection")
		return
	}

	// Best-effort activity write
	_ = h.queries.InsertActivity(r.Context(), db.InsertActivityParams{
		UserID:  mustParseUUID(claims.UserID),
		Type:    db.ActivityTypeGameAdded,
		GameID:  game.ID,
		ListID:  pgtype.UUID{},
		GroupID: pgtype.UUID{},
	})

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

	var rating pgtype.Int4
	if req.UserRating != nil {
		rating = pgtype.Int4{Int32: *req.UserRating, Valid: true}
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

	// Best-effort activity write when status changes to for_trade
	if req.Status != nil && *req.Status == string(db.GameStatusForTrade) {
		_ = h.queries.InsertActivity(r.Context(), db.InsertActivityParams{
			UserID:  mustParseUUID(claims.UserID),
			Type:    db.ActivityTypeGameForTrade,
			GameID:  gameID,
			ListID:  pgtype.UUID{},
			GroupID: pgtype.UUID{},
		})
	}

	respond.JSON(w, http.StatusOK, entry)
}

// bggGet makes an authenticated GET request to the BGG API using the API token.
func (h *GamesHandler) bggGet(targetURL string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "table-knight/1.0")
	if h.bggAPIToken != "" {
		req.Header.Set("Authorization", "Bearer "+h.bggAPIToken)
	}
	return h.httpClient.Do(req)
}

// fetchAndCacheGame fetches a single game's details from BGG and upserts it.
func (h *GamesHandler) fetchAndCacheGame(r *http.Request, bggID int) (db.Game, error) {
	fetchURL := fmt.Sprintf("%s/thing?id=%d&stats=1", h.bggBaseURL, bggID)
	resp, err := h.bggGet(fetchURL)
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

	categories := make([]string, 0)
	for _, l := range item.Links {
		if l.Type == "boardgamecategory" {
			categories = append(categories, l.Value)
		}
	}

	var weight pgtype.Numeric
	if item.Stats.AverageWeight.Value > 0 {
		weight.Scan(fmt.Sprintf("%.4f", item.Stats.AverageWeight.Value))
	}

	var rating pgtype.Numeric
	if item.Stats.Average.Value > 0 {
		rating.Scan(fmt.Sprintf("%.4f", item.Stats.Average.Value))
	}

	return h.queries.UpsertGame(r.Context(), db.UpsertGameParams{
		BggID:        int32(item.ID),
		Title:        title,
		MinPlayers:   int32(item.MinPlayer.Value),
		MaxPlayers:   int32(item.MaxPlayer.Value),
		PlaytimeMins: pgtype.Int4{Int32: int32(item.PlayTime.Value), Valid: item.PlayTime.Value > 0},
		ImageUrl:     pgtype.Text{String: item.Image, Valid: item.Image != ""},
		Categories:   categories,
		Weight:       weight,
		BggRating:    rating,
		Description:  pgtype.Text{String: item.Description, Valid: item.Description != ""},
	})
}

// GetGameDetail godoc
// GET /games/:bggId
func (h *GamesHandler) GetGameDetail(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	bggID, err := strconv.Atoi(chi.URLParam(r, "bggId"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid bgg_id")
		return
	}

	game, err := h.fetchAndCacheGame(r, bggID)
	if err != nil {
		game, err = h.queries.GetGameByBGGID(r.Context(), int32(bggID))
		if err != nil {
			respond.Error(w, http.StatusNotFound, "game not found")
			return
		}
	}

	sessions, err := h.queries.GetUserSessionsForGame(r.Context(), db.GetUserSessionsForGameParams{
		BggID:  int32(bggID),
		UserID: mustParseUUID(claims.UserID),
	})
	if err != nil {
		sessions = nil
	}

	reviewStats, err := h.queries.GetGameReviewStats(r.Context(), game.ID)
	if err != nil {
		reviewStats = nil
	}

	userReview, err := h.queries.GetUserReview(r.Context(), db.GetUserReviewParams{
		UserID: mustParseUUID(claims.UserID),
		GameID: game.ID,
	})
	var userReviewPtr any
	if err == nil {
		userReviewPtr = userReview
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"game":        game,
		"sessions":    sessions,
		"review_stats": reviewStats,
		"user_review": userReviewPtr,
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
