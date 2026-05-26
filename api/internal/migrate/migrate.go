package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Run applies any unapplied migrations in order and records them in schema_migrations.
// Each file is executed outside a transaction so DDL like ALTER TYPE ADD VALUE works.
func Run(ctx context.Context, pool *pgxpool.Pool, migrationsFS fs.FS) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename   TEXT        PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	rows, err := pool.Query(ctx, "SELECT filename FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scan migration name: %w", err)
		}
		applied[name] = true
	}
	rows.Close()

	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	// Bootstrap: if schema_migrations is empty but the DB already has tables
	// (pre-existing install before the migration runner was added), mark all
	// migrations as applied without running them.
	if len(applied) == 0 {
		var exists bool
		pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'users'
			)
		`).Scan(&exists)

		if exists {
			slog.Info("existing database detected — recording migrations without running them")
			for _, entry := range entries {
				name := entry.Name()
				if !strings.HasSuffix(name, ".sql") {
					continue
				}
				if _, err := pool.Exec(ctx, "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", name); err != nil {
					return fmt.Errorf("record existing migration %s: %w", name, err)
				}
				applied[name] = true
			}
		}
	}

	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".sql") || applied[name] {
			continue
		}

		sql, err := fs.ReadFile(migrationsFS, "migrations/"+name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}

		slog.Info("applying migration", "file", name)
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := pool.Exec(ctx, "INSERT INTO schema_migrations (filename) VALUES ($1)", name); err != nil {
			return fmt.Errorf("record %s: %w", name, err)
		}
		slog.Info("migration applied", "file", name)
	}

	return nil
}
