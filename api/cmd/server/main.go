package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"

	dbfiles "github.com/lfry610/table-knight/db"
	"github.com/lfry610/table-knight/internal/auth"
	"github.com/lfry610/table-knight/internal/config"
	"github.com/lfry610/table-knight/internal/db"
	"github.com/lfry610/table-knight/internal/handlers"
	"github.com/lfry610/table-knight/internal/middleware"
	"github.com/lfry610/table-knight/internal/migrate"
	"github.com/lfry610/table-knight/internal/respond"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// ── Database ──────────────────────────────────────────────────────────────
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("database ping failed", "error", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	if err := migrate.Run(ctx, pool, dbfiles.Migrations); err != nil {
		slog.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	queries := db.New(pool)

	// ── Services ──────────────────────────────────────────────────────────────
	authSvc := auth.NewService(cfg.JWTSecret)

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(queries, authSvc)
	gamesHandler := handlers.NewGamesHandler(queries, cfg.BGGAPIBaseURL, cfg.BGGAPIToken)
	groupsHandler := handlers.NewGroupsHandler(queries)
	sessionsHandler := handlers.NewSessionsHandler(queries)
	roundTableHandler := handlers.NewRoundTableHandler(queries, gamesHandler)
	socialHandler := handlers.NewSocialHandler(queries)
	listsHandler := handlers.NewListsHandler(queries, pool, cfg.BGGAPIBaseURL, cfg.BGGAPIToken)
	reviewsHandler := handlers.NewReviewsHandler(queries)
	oauthHandler := handlers.NewOAuthHandler(queries, authSvc, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL, cfg.FrontendURL)

	// Seed the local game cache with the BGG top-1000 in the background
	go gamesHandler.SeedPopularGames(ctx)

	// ── Router ────────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins(),
		AllowedMethods: []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:         300,
	}))

	// Health check (used by ECS and ALB)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public routes — auth endpoints are rate limited per IP
	r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/register", authHandler.Register)
	r.With(httprate.LimitByIP(10, time.Minute)).Post("/auth/login", authHandler.Login)
	r.Get("/auth/google", oauthHandler.Redirect)
	r.Get("/auth/google/callback", oauthHandler.Callback)

	// Game search (public — no auth needed to browse)
	r.Get("/games/search", gamesHandler.SearchGames)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(authSvc))

		// Games
		r.Get("/games/{bggId}", gamesHandler.GetGameDetail)

		// Reviews
		r.Get("/me/reviews", reviewsHandler.GetMyReviews)
		r.Get("/me/reviewable-games", reviewsHandler.GetReviewableGames)
		r.Post("/reviews", reviewsHandler.UpsertReview)
		r.Delete("/reviews/{gameId}", reviewsHandler.DeleteReview)

		// Me
		r.Get("/me", authHandler.GetMe)
			r.Patch("/me", authHandler.UpdateMe)
		r.Get("/me/collection", gamesHandler.GetMyCollection)
		r.Post("/me/collection", gamesHandler.AddToCollection)
		r.Patch("/me/collection/{gameID}", gamesHandler.UpdateCollectionEntry)
		r.Delete("/me/collection/{gameID}", gamesHandler.RemoveFromCollection)
		r.Get("/me/groups", groupsHandler.GetMyGroups)
		r.Get("/me/sessions", sessionsHandler.GetMySessions)
		r.Get("/me/stats", sessionsHandler.GetMyStats)
		r.Get("/me/round-table", roundTableHandler.GetRoundTable)
		r.Put("/me/round-table", roundTableHandler.SetRoundTable)
		r.Get("/me/feed", socialHandler.GetFeed)
		r.Get("/me/following", socialHandler.GetFollowing)
			r.Get("/me/followers", socialHandler.GetFollowers)
		r.Get("/me/group-mates", socialHandler.GetGroupMates)

		// Users
		r.Get("/users/search", socialHandler.SearchUsers)
		r.Get("/users/{id}", socialHandler.GetUserProfile)
		r.Post("/users/{id}/follow", socialHandler.Follow)
		r.Delete("/users/{id}/follow", socialHandler.Unfollow)

		// Groups
		r.Post("/groups", groupsHandler.CreateGroup)
		r.Post("/groups/join", groupsHandler.JoinGroup)
		r.Get("/groups/{id}", groupsHandler.GetGroup)
		r.Get("/groups/{id}/collection", groupsHandler.GetGroupCollection)
		r.Get("/groups/{id}/sessions", sessionsHandler.GetGroupSessions)

		// Lists
		r.Post("/lists", listsHandler.CreateList)
		r.Get("/me/lists", listsHandler.GetMyLists)
		r.Get("/lists/{id}", listsHandler.GetList)
		r.Patch("/lists/{id}", listsHandler.UpdateList)
		r.Delete("/lists/{id}", listsHandler.DeleteList)
		r.Post("/lists/{id}/games", listsHandler.AddGame)
		r.Delete("/lists/{id}/games/{gameID}", listsHandler.RemoveGame)
		r.Put("/lists/{id}/reorder", listsHandler.ReorderGames)

		// Sessions
		r.Post("/sessions", sessionsHandler.CreateSession)
		r.Patch("/sessions/{id}", sessionsHandler.UpdateSession)
		r.Delete("/sessions/{id}", sessionsHandler.DeleteSession)
		r.Patch("/sessions/{id}/players", sessionsHandler.UpdateSessionPlayers)
		r.Get("/sessions/{id}/players", sessionsHandler.GetSessionPlayers)
	})

	// ── Server ────────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "port", cfg.Port, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
	}

	slog.Info("server stopped")
}
