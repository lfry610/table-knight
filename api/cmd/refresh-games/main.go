// One-off script: re-fetches all games from BGG and upserts fresh image URLs + stats.
// Usage: go run ./cmd/refresh-games
package main

import (
	"context"
	"encoding/xml"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/lfry610/table-knight/internal/config"
	"github.com/lfry610/table-knight/internal/db"
)

type bggItem struct {
	ID        int       `xml:"id,attr"`
	Name      []bggName `xml:"name"`
	Image     string    `xml:"image"`
	Stats     bggStats  `xml:"statistics>ratings"`
}
type bggName  struct { Type  string `xml:"type,attr"`;  Value string `xml:"value,attr"` }
type bggStats struct {
	Average       bggFloat `xml:"average"`
	AverageWeight bggFloat `xml:"averageweight"`
}
type bggFloat struct{ Value float64 `xml:"value,attr"` }

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err); os.Exit(1)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("db connect", "err", err); os.Exit(1)
	}
	defer pool.Close()

	queries := db.New(pool)

	games, err := queries.ListAllGames(ctx)
	if err != nil {
		slog.Error("list games", "err", err); os.Exit(1)
	}
	slog.Info("refreshing games", "count", len(games))

	client := &http.Client{Timeout: 10 * time.Second}

	for _, g := range games {
		url := fmt.Sprintf("%s/thing?id=%d&stats=1", cfg.BGGAPIBaseURL, g.BggID)
		req, _ := http.NewRequest(http.MethodGet, url, nil)
		req.Header.Set("User-Agent", "table-knight-refresh/1.0")
		if cfg.BGGAPIToken != "" {
			req.Header.Set("Authorization", "Bearer "+cfg.BGGAPIToken)
		}

		resp, err := client.Do(req)
		if err != nil {
			slog.Warn("BGG request failed", "bgg_id", g.BggID, "err", err)
			continue
		}

		var result struct {
			Items []bggItem `xml:"item"`
		}
		decodeErr := xml.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if decodeErr != nil || len(result.Items) == 0 {
			slog.Warn("BGG decode failed", "bgg_id", g.BggID, "err", decodeErr)
			continue
		}

		item := result.Items[0]

		var weight pgtype.Numeric
		if item.Stats.AverageWeight.Value > 0 {
			weight.Scan(fmt.Sprintf("%.4f", item.Stats.AverageWeight.Value))
		}
		var rating pgtype.Numeric
		if item.Stats.Average.Value > 0 {
			rating.Scan(fmt.Sprintf("%.4f", item.Stats.Average.Value))
		}

		title := g.Title
		for _, n := range item.Name {
			if n.Type == "primary" { title = n.Value; break }
		}

		_, err = queries.UpsertGame(ctx, db.UpsertGameParams{
			BggID:        g.BggID,
			Title:        title,
			MinPlayers:   g.MinPlayers,
			MaxPlayers:   g.MaxPlayers,
			PlaytimeMins: g.PlaytimeMins,
			ImageUrl:     pgtype.Text{String: item.Image, Valid: item.Image != ""},
			Categories:   g.Categories,
			Weight:       weight,
			BggRating:    rating,
		})
		if err != nil {
			slog.Warn("upsert failed", "bgg_id", g.BggID, "err", err)
			continue
		}

		slog.Info("refreshed", "title", title, "image_ok", item.Image != "", "rating", item.Stats.Average.Value)
		time.Sleep(500 * time.Millisecond) // be polite to BGG
	}

	slog.Info("done")
}
