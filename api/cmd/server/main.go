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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/table-night/internal/auth"
	"github.com/yourusername/table-night/internal/config"
	"github.com/yourusername/table-night/internal/db"
	"github.com/yourusername/table-night/internal/handlers"
	"github.com/yourusername/table-night/internal/middleware"
	"github.com/yourusername/table-night/internal/respond"
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

	queries := db.New(pool)

	// ── Services ──────────────────────────────────────────────────────────────
	authSvc := auth.NewService(cfg.JWTSecret)

	// ── Handlers ──────────────────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(queries, authSvc)
	gamesHandler := handlers.NewGamesHandler(queries, cfg.BGGAPIBaseURL)
	groupsHandler := handlers.NewGroupsHandler(queries)
	sessionsHandler := handlers.NewSessionsHandler(queries)

	// ── Router ────────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(30 * time.Second))
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			origin := cfg.AllowedOrigin
			if origin == "" && !cfg.IsProd() {
				origin = "*"
			}
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			}
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	// Health check (used by ECS and ALB)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Public routes
	r.Post("/auth/register", authHandler.Register)
	r.Post("/auth/login", authHandler.Login)

	// Game search (public — no auth needed to browse)
	r.Get("/games/search", gamesHandler.SearchGames)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(authSvc))

		// Me
		r.Get("/me/collection", gamesHandler.GetMyCollection)
		r.Post("/me/collection", gamesHandler.AddToCollection)
		r.Patch("/me/collection/{gameID}", gamesHandler.UpdateCollectionEntry)
		r.Get("/me/groups", groupsHandler.GetMyGroups)

		// Groups
		r.Post("/groups", groupsHandler.CreateGroup)
		r.Post("/groups/join", groupsHandler.JoinGroup)
		r.Get("/groups/{id}", groupsHandler.GetGroup)
		r.Get("/groups/{id}/collection", groupsHandler.GetGroupCollection)
		r.Get("/groups/{id}/sessions", sessionsHandler.GetGroupSessions)

		// Sessions
		r.Post("/sessions", sessionsHandler.CreateSession)
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
