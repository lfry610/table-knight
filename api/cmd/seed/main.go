// Seed script: creates 10 test accounts with collections, round tables, and groups.
// Usage: go run ./cmd/seed
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/lfry610/table-knight/internal/config"
	"github.com/lfry610/table-knight/internal/db"
)

type userSeed struct {
	name        string
	email       string
	ownedBGG    []int32
	wantBGG     []int32
	wishlistBGG []int32
	roundTable  []int32 // subset of ownedBGG, in order
}

var users = []userSeed{
	{
		name:       "Alex Morgan",
		email:      "alex@test.com",
		ownedBGG:   []int32{266192, 342942, 224517, 174430, 237182, 169786},
		roundTable: []int32{266192, 342942, 224517, 237182, 174430},
	},
	{
		name:       "Jamie Chen",
		email:      "jamie@test.com",
		ownedBGG:   []int32{13, 822, 178900, 9209, 30549, 148228},
		wantBGG:    []int32{266192, 230802},
		roundTable: []int32{13, 822, 178900, 9209, 30549},
	},
	{
		name:       "Sam Rivera",
		email:      "sam@test.com",
		ownedBGG:   []int32{167791, 169786, 199792, 220308, 316554, 177736},
		roundTable: []int32{167791, 220308, 316554, 199792, 177736},
	},
	{
		name:        "Taylor Brooks",
		email:       "taylor@test.com",
		ownedBGG:    []int32{266192, 68448, 230802, 124361, 237182},
		wantBGG:     []int32{12333, 174430},
		roundTable:  []int32{266192, 230802, 237182, 68448, 124361},
	},
	{
		name:        "Morgan Lee",
		email:       "morgan@test.com",
		ownedBGG:    []int32{174430, 359871, 177736, 397598, 224517},
		wishlistBGG: []int32{342942, 167791},
		roundTable:  []int32{174430, 359871, 177736, 224517, 397598},
	},
	{
		name:       "Casey Kim",
		email:      "casey@test.com",
		ownedBGG:   []int32{178900, 13, 30549, 36218, 68448, 9209},
		wantBGG:    []int32{266192},
		roundTable: []int32{178900, 13, 30549, 36218, 68448},
	},
	{
		name:       "Jordan Walsh",
		email:      "jordan@test.com",
		ownedBGG:   []int32{224517, 167791, 169786, 12333, 124361, 199792},
		roundTable: []int32{224517, 169786, 12333, 124361, 199792},
	},
	{
		name:        "Avery Patel",
		email:       "avery@test.com",
		ownedBGG:    []int32{237182, 199792, 230802, 148228, 342942},
		wishlistBGG: []int32{177736, 220308},
		roundTable:  []int32{237182, 199792, 230802, 148228, 342942},
	},
	{
		name:       "Riley Thompson",
		email:      "riley@test.com",
		ownedBGG:   []int32{266192, 342942, 316554, 220308, 359871},
		wantBGG:    []int32{174430},
		roundTable: []int32{266192, 342942, 316554, 220308, 359871},
	},
	{
		name:       "Quinn Davis",
		email:      "quinn@test.com",
		ownedBGG:   []int32{68448, 822, 36218, 178900, 9209, 30549},
		roundTable: []int32{68448, 822, 36218, 178900, 9209},
	},
}

// Groups: name → list of member emails (first is admin)
var groups = []struct {
	name    string
	members []string
}{
	{"The Strategists", []string{"alex@test.com", "sam@test.com", "jordan@test.com", "riley@test.com"}},
	{"Game Night Crew", []string{"jamie@test.com", "taylor@test.com", "casey@test.com", "avery@test.com", "quinn@test.com"}},
	{"Euro Gamers", []string{"morgan@test.com", "sam@test.com", "taylor@test.com", "jordan@test.com"}},
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("db connect", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	q := db.New(pool)

	// ── Build bgg_id → game.id map ───────────────────────────────────────────
	allGames, err := q.ListAllGames(ctx)
	if err != nil {
		slog.Error("list games", "err", err)
		os.Exit(1)
	}
	gameByBGG := map[int32]pgtype.UUID{}
	for _, g := range allGames {
		gameByBGG[g.BggID] = g.ID
	}

	// ── Create users ─────────────────────────────────────────────────────────
	userIDs := map[string]pgtype.UUID{} // email → id

	for _, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("bcrypt", "err", err)
			os.Exit(1)
		}

		user, err := q.CreateUser(ctx, db.CreateUserParams{
			Email:       u.email,
			DisplayName: u.name,
			Password:    string(hash),
		})
		if err != nil {
			slog.Warn("create user skipped (already exists?)", "email", u.email, "err", err)
			// Try to look up existing user
			existing, lookupErr := q.GetUserByEmail(ctx, u.email)
			if lookupErr != nil {
				slog.Error("cannot find existing user", "email", u.email)
				os.Exit(1)
			}
			userIDs[u.email] = existing.ID
			slog.Info("using existing user", "email", u.email)
			continue
		}
		userIDs[u.email] = user.ID
		slog.Info("created user", "name", u.name)

		// Collection
		addGames := func(bggIDs []int32, status db.GameStatus) {
			for _, bggID := range bggIDs {
				gid, ok := gameByBGG[bggID]
				if !ok {
					slog.Warn("game not in DB", "bgg_id", bggID)
					continue
				}
				if _, err := q.AddGameToCollection(ctx, db.AddGameToCollectionParams{
					UserID: user.ID,
					GameID: gid,
					Status: status,
				}); err != nil {
					slog.Warn("add collection", "err", err)
				}
			}
		}
		addGames(u.ownedBGG, db.GameStatusOwned)
		addGames(u.wantBGG, db.GameStatusWantToPlay)
		addGames(u.wishlistBGG, db.GameStatusWishlist)

		// Round table
		if err := q.ClearRoundTable(ctx, user.ID); err != nil {
			slog.Warn("clear round table", "err", err)
		}
		for pos, bggID := range u.roundTable {
			gid, ok := gameByBGG[bggID]
			if !ok {
				continue
			}
			if err := q.SetRoundTableSlot(ctx, db.SetRoundTableSlotParams{
				UserID:   user.ID,
				GameID:   gid,
				Position: int16(pos + 1),
			}); err != nil {
				slog.Warn("set round table slot", "err", err)
			}
		}
	}

	// ── Create groups ─────────────────────────────────────────────────────────
	for _, g := range groups {
		if len(g.members) == 0 {
			continue
		}
		adminEmail := g.members[0]
		adminID, ok := userIDs[adminEmail]
		if !ok {
			slog.Warn("admin not found", "email", adminEmail)
			continue
		}

		group, err := q.CreateGroup(ctx, db.CreateGroupParams{
			Name:      g.name,
			CreatedBy: adminID,
		})
		if err != nil {
			slog.Warn("create group", "name", g.name, "err", err)
			continue
		}
		slog.Info("created group", "name", g.name)

		for i, email := range g.members {
			uid, ok := userIDs[email]
			if !ok {
				continue
			}
			role := db.MemberRoleMember
			if i == 0 {
				role = db.MemberRoleAdmin
			}
			if _, err := q.AddGroupMember(ctx, db.AddGroupMemberParams{
				GroupID: group.ID,
				UserID:  uid,
				Role:    role,
			}); err != nil {
				slog.Warn("add group member", "err", err)
			}
		}
	}

	slog.Info("seed complete")
}
