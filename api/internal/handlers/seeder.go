package handlers

import (
	"context"
	"encoding/xml"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
)

const (
	seedThreshold = 500
	seedBatchSize = 20
)

// classicGameIDs is a curated list of all-time top BGG games that BGG's own
// search API omits or ranks poorly (e.g. short titles like "Ra" ID 12).
var classicGameIDs = []int{
	// All-time BGG top ranked
	174430, // Gloomhaven
	224517, // Brass: Birmingham
	167791, // Terraforming Mars
	161936, // Pandemic Legacy: Season 1
	162886, // Spirit Island
	266192, // Wingspan
	169786, // Scythe
	182028, // Through the Ages: A New Story of Civilization
	120677, // Terra Mystica
	233078, // Twilight Imperium 4th Ed
	115746, // War of the Ring 2nd Ed
	230802, // Azul
	237182, // Root
	193738, // Great Western Trail
	316554, // Dune: Imperium
	12333,  // Twilight Struggle
	96848,  // Mage Knight Board Game
	175914, // Food Chain Magnate
	187645, // Imperial Assault
	199792, // Everdell
	220308, // Gaia Project
	124361, // Concordia
	128621, // Viticulture Essential Edition
	102794, // Caverna: The Cave Farmers
	35677,  // Le Havre
	31260,  // Agricola
	9209,   // Ticket to Ride
	822,    // Carcassonne
	30549,  // Pandemic
	13,     // Catan
	3076,   // Puerto Rico
	68448,  // 7 Wonders
	36218,  // Dominion
	2651,   // Power Grid
	72125,  // Eclipse
	37111,  // Battlestar Galactica
	121921, // Robinson Crusoe
	257499, // Arkham Horror 3rd Ed
	167355, // Nemesis
	201808, // Clank!
	173346, // 7 Wonders Duel
	163412, // Patchwork
	178900, // Codenames
	148949, // Istanbul
	104006, // Village
	105910, // Nations
	173233, // Oh My Goods!
	131357, // Coup
	129622, // Love Letter
	14996,  // Sherlock Holmes Consulting Detective
	185343, // Anachrony
	12,     // Ra
	183394, // Viticulture World
	251247, // Pandemic Legacy Season 0
	290236, // Gloomhaven: Jaws of the Lion
	254640, // Brass: Lancashire
	146021, // Eldritch Horror
	68448,  // 7 Wonders (dup guard handled in seen map)
	126163, // Tzolk'in: The Mayan Calendar
	55690,  // A Few Acres of Snow
	28143,  // Race for the Galaxy
	50381,  // Dominant Species
	39856,  // Dixit
	2655,   // Hive
	822,    // Carcassonne
	25613,  // Brass (original)
	22345,  // Agricola (original)
	9217,   // Innovation
	31260,  // Agricola
	70323,  // King of Tokyo
	40834,  // Dominion: Intrigue
	220877, // Clank! In! Space!
	244522, // Underwater Cities
	262543, // Maracaibo
	291453, // Barrage
	300531, // On Mars
	256916, // Pax Pamir 2nd Ed
	238419, // Architects of the West Kingdom
	223953, // Kitchen Rush
	266524, // Paleo
	295947, // The Crew: Quest for Planet Nine
	258779, // Sleeping Gods
	276025, // Obsession
	262712, // Cascadia
	317985, // Heat: Pedal to the Metal
	363369, // Ark Nova
	334986, // Frosthaven
	369821, // Dune: Imperium Uprising
}

// bggHotItem is the XML struct for BGG /hot endpoint.
type bggHotItem struct {
	ID   int `xml:"id,attr"`
	Rank int `xml:"rank,attr"`
}
type bggHotResp struct {
	Items []bggHotItem `xml:"item"`
}

// SeedPopularGames pre-populates the local game cache with popular games.
// It runs as a background goroutine on startup and skips if already seeded.
func (h *GamesHandler) SeedPopularGames(ctx context.Context) {
	count, err := h.queries.CountGames(ctx)
	if err != nil {
		slog.Error("seeder: failed to count games", "error", err)
		return
	}
	if count >= seedThreshold {
		slog.Info("seeder: skipping — DB already seeded", "count", count)
		return
	}
	slog.Info("seeder: starting game cache seed", "existing", count)

	ids := h.collectSeedIDs(ctx)
	slog.Info("seeder: collected game IDs to seed", "count", len(ids))

	seeded := 0
	for i := 0; i < len(ids); i += seedBatchSize {
		end := i + seedBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		n, err := h.seedBatch(ctx, ids[i:end])
		if err != nil {
			slog.Warn("seeder: batch failed", "start", i, "error", err)
		}
		seeded += n

		select {
		case <-ctx.Done():
			slog.Info("seeder: context cancelled", "seeded", seeded)
			return
		case <-time.After(2 * time.Second):
		}
	}

	slog.Info("seeder: complete", "seeded", seeded)
}

// collectSeedIDs merges IDs from the BGG /hot endpoint with the curated classics list.
func (h *GamesHandler) collectSeedIDs(ctx context.Context) []int {
	seen := make(map[int]bool)
	var ids []int

	add := func(id int) {
		if id > 0 && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}

	// Classics list first — guarantees Ra (ID 12) and other short-title games
	for _, id := range classicGameIDs {
		add(id)
	}

	// BGG /hot endpoint — current popular games
	hotURL := fmt.Sprintf("%s/hot?type=boardgame", h.bggBaseURL)
	resp, err := h.bggGetCtx(ctx, hotURL)
	if err == nil && resp.StatusCode == http.StatusOK {
		var hot bggHotResp
		if err := xml.NewDecoder(resp.Body).Decode(&hot); err == nil {
			for _, item := range hot.Items {
				add(item.ID)
			}
		}
		resp.Body.Close()
	} else {
		if resp != nil {
			resp.Body.Close()
		}
		slog.Warn("seeder: /hot endpoint unavailable, using classics list only", "error", err)
	}

	return ids
}

// seedBatch fetches details for a batch of BGG IDs and upserts them.
// Returns the number of games successfully upserted.
func (h *GamesHandler) seedBatch(ctx context.Context, ids []int) (int, error) {
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = strconv.Itoa(id)
	}
	fetchURL := fmt.Sprintf("%s/thing?id=%s&stats=1", h.bggBaseURL, strings.Join(strs, ","))

	resp, err := h.bggGetCtx(ctx, fetchURL)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("BGG returned %d", resp.StatusCode)
	}

	var result struct {
		Items []bggItem `xml:"item"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	n := 0
	for _, item := range result.Items {
		title := ""
		for _, name := range item.Name {
			if name.Type == "primary" {
				title = name.Value
				break
			}
		}
		if title == "" {
			continue
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

		if _, err := h.queries.UpsertGame(ctx, db.UpsertGameParams{
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
		}); err != nil {
			slog.Warn("seeder: upsert failed", "bgg_id", item.ID, "error", err)
		} else {
			n++
		}
	}

	return n, nil
}

// bggGetCtx is like bggGet but accepts a context for cancellation support.
func (h *GamesHandler) bggGetCtx(ctx context.Context, targetURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "table-knight/1.0")
	if h.bggAPIToken != "" {
		req.Header.Set("Authorization", "Bearer "+h.bggAPIToken)
	}
	return h.httpClient.Do(req)
}
