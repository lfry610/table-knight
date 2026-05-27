package handlers

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lfry610/table-knight/internal/db"
)

const (
	seedThreshold  = 500 // skip if DB already has this many games
	seedPages      = 10  // BGG browse pages (100 games each = top 1000)
	seedBatchSize  = 20  // BGG thing endpoint accepts up to ~20 IDs at once
	seedBrowseBase = "https://boardgamegeek.com/browse/boardgame?sort=rank&page="
)

var bggIDRe = regexp.MustCompile(`href="/boardgame/(\d+)/`)

// SeedPopularGames pre-populates the local game cache with the BGG top-1000
// ranked games. It runs as a background goroutine on startup. If the DB
// already has enough games it exits immediately.
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
	slog.Info("seeder: starting BGG top-1000 seed", "existing", count)

	ids, err := scrapeTopGameIDs(ctx, seedPages)
	if err != nil {
		slog.Error("seeder: failed to scrape BGG browse pages", "error", err)
		return
	}
	slog.Info("seeder: scraped game IDs", "count", len(ids))

	seeded := 0
	for i := 0; i < len(ids); i += seedBatchSize {
		end := i + seedBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		batch := ids[i:end]

		if err := h.seedBatch(ctx, batch); err != nil {
			slog.Warn("seeder: batch failed", "start", i, "error", err)
			continue
		}
		seeded += len(batch)

		// Polite delay between batches — BGG rate-limits aggressively
		select {
		case <-ctx.Done():
			slog.Info("seeder: context cancelled, stopping", "seeded", seeded)
			return
		case <-time.After(2 * time.Second):
		}
	}

	slog.Info("seeder: complete", "seeded", seeded)
}

// scrapeTopGameIDs fetches BGG browse HTML pages and extracts board game IDs.
func scrapeTopGameIDs(ctx context.Context, pages int) ([]int, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	seen := make(map[int]bool)
	var ids []int

	for page := 1; page <= pages; page++ {
		u := seedBrowseBase + strconv.Itoa(page)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return ids, err
		}
		req.Header.Set("User-Agent", "table-knight/1.0 (seeder)")

		resp, err := client.Do(req)
		if err != nil {
			slog.Warn("seeder: browse page fetch failed", "page", page, "error", err)
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			slog.Warn("seeder: browse page read failed", "page", page, "error", err)
			continue
		}

		matches := bggIDRe.FindAllSubmatch(body, -1)
		for _, m := range matches {
			id, err := strconv.Atoi(string(m[1]))
			if err != nil || seen[id] {
				continue
			}
			seen[id] = true
			ids = append(ids, id)
		}

		slog.Info("seeder: scraped browse page", "page", page, "total_ids", len(ids))

		select {
		case <-ctx.Done():
			return ids, nil
		case <-time.After(1 * time.Second):
		}
	}

	return ids, nil
}

// seedBatch fetches details for a batch of BGG IDs and upserts them into the DB.
func (h *GamesHandler) seedBatch(ctx context.Context, ids []int) error {
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = strconv.Itoa(id)
	}
	fetchURL := fmt.Sprintf("%s/thing?id=%s&stats=1", h.bggBaseURL, strings.Join(strs, ","))

	resp, err := h.bggGetCtx(ctx, fetchURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("BGG returned %d", resp.StatusCode)
	}

	var result struct {
		Items []bggItem `xml:"item"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	for _, item := range result.Items {
		title := ""
		for _, n := range item.Name {
			if n.Type == "primary" {
				title = n.Value
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
		}
	}

	return nil
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
