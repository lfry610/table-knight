import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { gamesApi, groupsApi, sessionsApi, roundTableApi, reviewsApi, type Session, type CollectionGame } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  IconPlus, IconStar, IconShield, IconNotebook, IconTrophy, IconCalendar, IconD6,
} from "@/components/ui/icons";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatDuration(mins: number | null) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function Stars({ n, total = 5 }: { n: number; total?: number }) {
  return (
    <span className="inline-flex gap-px" style={{ color: "var(--rd-star)" }}>
      {Array.from({ length: total }).map((_, i) => (
        <IconStar key={i} size={11} solid={i < n} />
      ))}
    </span>
  );
}

function DiaryRow({ session, rating }: { session: Session; rating?: number }) {
  const dur = formatDuration(session.duration_mins);

  return (
    <div className="flex gap-3.5">
      {/* Poster thumbnail */}
      <div
        className="shrink-0 overflow-hidden rounded"
        style={{ width: 52, height: 69, background: "var(--rd-surface-hi)" }}
      >
        {session.game_image ? (
          <img
            src={session.game_image}
            alt={session.game_title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xl">🎲</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="font-serif font-semibold text-[16px] leading-tight"
            style={{ color: "var(--rd-text)" }}
          >
            {session.game_title}
          </span>
          {rating != null && <Stars n={Math.round(rating)} />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--rd-meta)" }}>
          <span>{formatDate(session.played_at)}</span>
          {dur && <><span>·</span><span>{dur}</span></>}
        </div>

        {session.notes && (
          <p
            className="mt-1.5 font-serif italic text-[13px] leading-snug line-clamp-2"
            style={{ color: "var(--rd-text-2)" }}
          >
            "{session.notes}"
          </p>
        )}
      </div>
    </div>
  );
}

function RoundTableSection({ collection }: { collection: CollectionGame[] | undefined }) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editSlots, setEditSlots] = useState<number[]>([]);

  const { data: roundTable } = useQuery({
    queryKey: ["round-table"],
    queryFn: () => roundTableApi.get().then((r) => r.data),
  });

  const setMutation = useMutation({
    mutationFn: (bggIds: number[]) => roundTableApi.set(bggIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["round-table"] });
      setIsEditing(false);
    },
  });

  const startEditing = () => {
    setEditSlots(roundTable?.map((g) => g.bgg_id) ?? []);
    setIsEditing(true);
  };

  const availableGames = collection?.filter((g) => !editSlots.includes(g.bgg_id)) ?? [];

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-center relative mb-4">
        <h2
          className="font-serif font-bold text-[20px] leading-none"
          style={{ color: "var(--rd-cream)" }}
        >
          Round Table
        </h2>
        {!isEditing && (
          <button
            onClick={startEditing}
            className="absolute right-0 text-[12px] font-medium transition-colors hover:text-foreground"
            style={{ color: "var(--rd-text-2)" }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Five poster slots */}
      {!isEditing && (
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((pos) => {
            const game = roundTable?.find((g) => g.position === pos);
            return (
              <div
                key={pos}
                className="relative w-full overflow-hidden rounded-lg"
                style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)" }}
              >
                {game?.image_url ? (
                  <Link to={`/games/${game.bgg_id}`} className="absolute inset-0">
                    <img
                      src={game.image_url}
                      alt={game.title}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ) : (
                  <button
                    onClick={startEditing}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-30 hover:opacity-60 transition-opacity"
                  >
                    <IconPlus size={16} style={{ color: "var(--rd-text-2)" }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit panel */}
      {isEditing && (
        <div
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
        >
          {/* Current slots */}
          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: "var(--rd-text-2)" }}>
              Seats ({editSlots.length}/5)
            </p>
            <div className="flex gap-2 flex-wrap min-h-[2rem]">
              {editSlots.length === 0 && (
                <p className="text-[12px] self-center" style={{ color: "var(--rd-meta)" }}>
                  Pick games from your collection below
                </p>
              )}
              {editSlots.map((bggId, i) => {
                const game = collection?.find((g) => g.bgg_id === bggId);
                return (
                  <div
                    key={bggId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium"
                    style={{ background: "var(--rd-surface-hi)", color: "var(--rd-text)" }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: "var(--rd-plum)" }}>
                      {i + 1}
                    </span>
                    <span className="max-w-[120px] truncate">{game?.title ?? `Game #${bggId}`}</span>
                    <button
                      onClick={() => setEditSlots(editSlots.filter((_, j) => j !== i))}
                      className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                      style={{ color: "var(--rd-loss)" }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collection picker */}
          {editSlots.length < 5 && (
            <div>
              <p className="text-[11px] font-medium mb-2" style={{ color: "var(--rd-text-2)" }}>
                Pick from your collection
              </p>
              <div className="max-h-52 overflow-y-auto space-y-0.5 -mx-1 px-1">
                {availableGames.length === 0 && (
                  <p className="text-[12px] py-2" style={{ color: "var(--rd-meta)" }}>
                    All collection games added
                  </p>
                )}
                {availableGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setEditSlots([...editSlots, game.bgg_id])}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-accent"
                  >
                    <div
                      className="shrink-0 overflow-hidden rounded"
                      style={{ width: 28, height: 37, background: "var(--rd-surface-hi)" }}
                    >
                      {game.image_url ? (
                        <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs">🎲</div>
                      )}
                    </div>
                    <span
                      className="text-[13px] font-medium flex-1 line-clamp-1"
                      style={{ color: "var(--rd-text)" }}
                    >
                      {game.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setMutation.mutate(editSlots)}
              disabled={setMutation.isPending}
              className="inline-flex h-8 px-4 items-center rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="inline-flex h-8 px-4 items-center rounded-lg text-[13px] font-medium border transition-colors hover:bg-accent"
              style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

function formatPlaytime(mins: number): string {
  if (mins === 0) return "0 h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

function BigStat({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon?: React.ComponentType<any> }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      {Icon && <Icon size={18} style={{ color: "var(--rd-plum)" }} />}
      <div>
        <p className="font-serif font-bold text-[28px] leading-none" style={{ color: "var(--rd-cream)" }}>
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-wide mt-1" style={{ color: "var(--rd-meta)" }}>
          {label}
        </p>
        {sub && <p className="text-[12px] mt-0.5" style={{ color: "var(--rd-text-2)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function StatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => sessionsApi.getMyStats().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl" style={{ background: "var(--rd-surface)" }} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const winRate = stats.total_results > 0
    ? Math.round((stats.wins / stats.total_results) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <BigStat
          icon={IconCalendar}
          label="Sessions this month"
          value={String(stats.sessions_this_month)}
          sub={`${stats.total_sessions} all time`}
        />
        <BigStat
          icon={IconD6}
          label="Unique games played"
          value={String(stats.unique_games)}
        />
        <BigStat
          icon={IconNotebook}
          label="Total playtime"
          value={formatPlaytime(stats.total_playtime_mins)}
        />
        {winRate !== null && (
          <BigStat
            icon={IconTrophy}
            label="Win rate"
            value={`${winRate}%`}
            sub={`${stats.wins} wins from ${stats.total_results} tracked`}
          />
        )}
      </div>

      {stats.most_played_game && (
        <div
          className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
        >
          {/* Box art */}
          <div
            className="shrink-0 overflow-hidden rounded-lg"
            style={{ width: 52, height: 69, background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
          >
            {stats.most_played_game_image ? (
              <img
                src={stats.most_played_game_image}
                alt={stats.most_played_game}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xl">🎲</div>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--rd-meta)" }}>
              Most played game
            </p>
            <p className="font-serif font-semibold text-[17px]" style={{ color: "var(--rd-cream)" }}>
              {stats.most_played_game}
            </p>
            <p className="text-[12px]" style={{ color: "var(--rd-text-2)" }}>
              {stats.most_played_game_count} {stats.most_played_game_count === 1 ? "session" : "sessions"} logged
            </p>
          </div>
        </div>
      )}

      {stats.total_sessions === 0 && (
        <p className="text-[13px] text-center py-8" style={{ color: "var(--rd-meta)" }}>
          Log some sessions to see your stats.
        </p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [tab, setTab] = useState<"diary" | "stats">("diary");
  const user = useAuthStore((s) => s.user);
  const firstName = user?.display_name.split(" ")[0] ?? "";

  const { data: collection } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.getMyGroups().then((r) => r.data),
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.getMySessions({ limit: 8 }).then((r) => r.data),
  });

  const { data: reviews } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewsApi.getMyReviews().then((r) => r.data),
  });

  const reviewByGameId = Object.fromEntries((reviews ?? []).map((r) => [r.game_id, r.rating]));
  const recentSessions = sessions?.slice(0, 5) ?? [];
  const shelfGames = collection?.filter((g) => g.status === "owned").slice(0, 8) ?? [];

  return (
    <AppLayout>
      {/* Header */}
      <header className="flex items-start justify-between mb-8">
        <div>
          <p
            className="text-[11px] font-medium uppercase tracking-widest mb-1.5"
            style={{ color: "var(--rd-text-2)" }}
          >
            {greeting()}
          </p>
          <h1
            className="font-serif font-bold text-[28px] leading-none tracking-tight"
            style={{ color: "var(--rd-cream)" }}
          >
            {firstName}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/sessions/log">
            <button
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
            >
              <IconPlus size={13} />
              Log a session
            </button>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div
        className="flex gap-6 mb-6"
        style={{ borderBottom: "1px solid var(--rd-border)" }}
      >
        {(["diary", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-2 text-[13px] font-medium capitalize transition-colors"
            style={
              tab === t
                ? { color: "var(--rd-text)", borderBottom: "2px solid var(--rd-plum)" }
                : { color: "var(--rd-text-2)", borderBottom: "2px solid transparent" }
            }
          >
            {t === "diary" ? "Diary" : "Stats"}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {tab === "stats" && <StatsTab />}

      {/* Diary tab */}
      {tab === "diary" && <>

      {/* Round Table */}
      <RoundTableSection collection={collection} />

      {/* Body: diary feed + right panel */}
      <div className="grid gap-10 md:grid-cols-[1.6fr_1fr]">

        {/* DIARY FEED */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2
              className="font-serif font-semibold text-[19px]"
              style={{ color: "var(--rd-text)" }}
            >
              Recent sessions
            </h2>
            {sessions && sessions.length > 0 && (
              <Link
                to="/sessions"
                className="text-[12px] transition-colors hover:text-foreground"
                style={{ color: "var(--rd-text-2)" }}
              >
                {sessions.length} total
              </Link>
            )}
          </div>

          {recentSessions.length === 0 ? (
            <div
              className="flex flex-col items-center py-14 text-center rounded-xl border border-dashed"
              style={{ borderColor: "var(--rd-border)" }}
            >
              <IconNotebook size={32} style={{ color: "var(--rd-text-2)", marginBottom: 12 }} />
              <p className="font-medium text-sm" style={{ color: "var(--rd-text-2)" }}>
                No sessions logged yet
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
                Log your first game night to start your diary
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {recentSessions.map((s) => (
                <DiaryRow key={s.id} session={s} rating={reviewByGameId[s.game_id]} />
              ))}
            </div>
          )}
        </section>

        {/* RIGHT PANEL */}
        <div className="flex flex-col gap-7">

          {/* Stats strip */}
          <div
            className="rounded-xl p-4 flex gap-6"
            style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
          >
            <Stat label="Sessions" value={sessions?.length ?? 0} />
            <div style={{ width: 1, background: "var(--rd-border)" }} />
            <Stat label="Games" value={collection?.length ?? 0} />
            <div style={{ width: 1, background: "var(--rd-border)" }} />
            <Stat label="Crews" value={groups?.length ?? 0} />
          </div>

          {/* On the shelf */}
          {shelfGames.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2
                  className="font-serif font-semibold text-[17px]"
                  style={{ color: "var(--rd-text)" }}
                >
                  On the shelf
                </h2>
                <Link
                  to="/collection"
                  className="text-[12px] transition-colors hover:text-foreground"
                  style={{ color: "var(--rd-text-2)" }}
                >
                  {shelfGames.length} games
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {shelfGames.map((g) => (
                  <div
                    key={g.id}
                    className="overflow-hidden rounded"
                    style={{ aspectRatio: "3/4", background: "var(--rd-surface-hi)" }}
                  >
                    {g.image_url ? (
                      <img src={g.image_url} alt={g.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-lg">🎲</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Groups */}
          {(groups?.length ?? 0) > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2
                  className="font-serif font-semibold text-[17px]"
                  style={{ color: "var(--rd-text)" }}
                >
                  Your crews
                </h2>
                <Link
                  to="/groups"
                  className="text-[12px] transition-colors hover:text-foreground"
                  style={{ color: "var(--rd-text-2)" }}
                >
                  View all
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {groups!.slice(0, 3).map((g) => (
                  <Link key={g.id} to={`/groups/${g.id}`}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:brightness-110"
                      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "rgba(201,124,176,.15)" }}
                      >
                        <IconShield size={14} style={{ color: "var(--rd-plum)" }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{g.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--rd-meta)" }}>
                          {g.invite_code}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {(groups?.length === 0) && (collection?.length === 0) && (
            <div
              className="rounded-xl border border-dashed p-6 text-center"
              style={{ borderColor: "var(--rd-border)" }}
            >
              <p className="font-serif font-semibold text-[15px] mb-1" style={{ color: "var(--rd-text)" }}>
                Welcome to Table Knight
              </p>
              <p className="text-[12px] mb-4" style={{ color: "var(--rd-text-2)" }}>
                Add games and create a crew to get started.
              </p>
              <div className="flex gap-2 justify-center">
                <Link to="/collection">
                  <button
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold"
                    style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
                  >
                    Add a game
                  </button>
                </Link>
                <Link to="/groups">
                  <button
                    className="inline-flex h-7 px-3 rounded-lg text-[12px] font-medium border items-center"
                    style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
                  >
                    Create a crew
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      </>}
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p
        className="text-[10px] uppercase tracking-widest font-medium mb-0.5"
        style={{ color: "var(--rd-text-2)" }}
      >
        {label}
      </p>
      <p
        className="font-serif font-bold text-[24px] leading-none"
        style={{ color: "var(--rd-cream)" }}
      >
        {value}
      </p>
    </div>
  );
}
