import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { IconStar, IconPlus } from "@/components/ui/icons";
import { socialApi, authApi, gamesApi, roundTableApi, type CollectionGame, type RoundTableGame, type GameStatus, type Session, type BGGSearchHit } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { SessionRow } from "@/pages/sessions/SessionsPage";
import { IconPencil } from "@/components/ui/icons";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GameStatus, string> = {
  owned:        "Owned",
  played:       "Played",
  want_to_play: "Want to play",
  for_trade:    "For trade",
  wishlist:     "Wishlist",
};

const STATUS_DOT: Record<GameStatus, string> = {
  owned:        "var(--rd-win)",
  played:       "#7eb8d4",
  want_to_play: "var(--rd-brass)",
  for_trade:    "var(--rd-loss)",
  wishlist:     "var(--rd-plum)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
      <span className="font-bold text-[17px] leading-none" style={{ color: "var(--rd-cream)" }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--rd-meta)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Follow button ─────────────────────────────────────────────────────────────

function FollowButton({ userId, isFollowing }: { userId: string; isFollowing: boolean }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["profile", userId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["following"] });
  };

  const follow = useMutation({ mutationFn: () => socialApi.follow(userId), onSuccess: invalidate });
  const unfollow = useMutation({ mutationFn: () => socialApi.unfollow(userId), onSuccess: invalidate });
  const pending = follow.isPending || unfollow.isPending;

  if (isFollowing) {
    return (
      <button
        onClick={() => unfollow.mutate()}
        disabled={pending}
        className="text-[12px] font-medium px-4 py-1.5 rounded-lg border transition-colors hover:bg-accent disabled:opacity-50"
        style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
      >
        Following
      </button>
    );
  }
  return (
    <button
      onClick={() => follow.mutate()}
      disabled={pending}
      className="text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
    >
      + Follow
    </button>
  );
}

// ── Round Table ───────────────────────────────────────────────────────────────

function RoundTableSection({ slots, isOwner, profileId }: { slots: RoundTableGame[]; isOwner: boolean; profileId: string }) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editSlots, setEditSlots] = useState<number[]>([]);
  const [gameLabels, setGameLabels] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults } = useQuery({
    queryKey: ["bgg-search-rt-profile", searchQuery],
    queryFn: () => gamesApi.search(searchQuery).then((r) => r.data),
    enabled: searchQuery.trim().length >= 2,
  });

  const setMutation = useMutation({
    mutationFn: (bggIds: number[]) => roundTableApi.set(bggIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", profileId] });
      setIsEditing(false);
    },
  });

  const startEditing = () => {
    setEditSlots(slots.map((g) => g.bgg_id));
    const labels: Record<number, string> = {};
    slots.forEach((g) => { labels[g.bgg_id] = g.title; });
    setGameLabels(labels);
    setSearchQuery("");
    setIsEditing(true);
  };

  const addGame = (hit: BGGSearchHit) => {
    if (editSlots.includes(hit.bgg_id) || editSlots.length >= 5) return;
    setEditSlots((s) => [...s, hit.bgg_id]);
    setGameLabels((prev) => ({ ...prev, [hit.bgg_id]: hit.title }));
    setSearchQuery("");
  };

  const availableResults = (searchResults ?? []).filter((h) => !editSlots.includes(h.bgg_id));
  const filled: (RoundTableGame | null)[] = Array.from({ length: 5 }, (_, i) =>
    slots.find((s) => s.position === i + 1) ?? null
  );

  return (
    <section className="mb-8">
      <div className="flex items-center justify-center relative mb-3">
        <h2
          className="font-serif font-bold text-[15px] tracking-tight"
          style={{ color: "var(--rd-cream)" }}
        >
          Round Table
        </h2>
        {isOwner && !isEditing && (
          <button
            onClick={startEditing}
            className="absolute right-0 text-[12px] font-medium transition-colors hover:text-foreground"
            style={{ color: "var(--rd-text-2)" }}
          >
            Edit
          </button>
        )}
      </div>

      {!isEditing && (
        <div className="grid grid-cols-5 gap-2">
          {filled.map((game, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div
                className="relative w-full overflow-hidden rounded-lg transition-shadow duration-200 hover:shadow-[0_0_0_2px_#c97cb0,0_0_12px_rgba(201,124,176,0.3)]"
                style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
              >
                {game?.image_url ? (
                  <Link to={`/games/${game.bgg_id}`} className="absolute inset-0">
                    <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
                  </Link>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isOwner ? (
                      <button onClick={startEditing} className="opacity-30 hover:opacity-60 transition-opacity">
                        <IconPlus size={14} style={{ color: "var(--rd-text-2)" }} />
                      </button>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--rd-meta)" }}>—</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}>
          <div>
            <p className="text-[11px] font-medium mb-2" style={{ color: "var(--rd-text-2)" }}>
              Seats ({editSlots.length}/5)
            </p>
            <div className="flex gap-2 flex-wrap min-h-[2rem]">
              {editSlots.length === 0 && (
                <p className="text-[12px] self-center" style={{ color: "var(--rd-meta)" }}>Search for games below</p>
              )}
              {editSlots.map((bggId, i) => (
                <div
                  key={bggId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium"
                  style={{ background: "var(--rd-surface-hi)", color: "var(--rd-text)" }}
                >
                  <span className="text-[10px] font-bold" style={{ color: "var(--rd-plum)" }}>{i + 1}</span>
                  <span className="max-w-[120px] truncate">{gameLabels[bggId] ?? `Game #${bggId}`}</span>
                  <button
                    onClick={() => setEditSlots(editSlots.filter((_, j) => j !== i))}
                    className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: "var(--rd-loss)" }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          {editSlots.length < 5 && (
            <div>
              <p className="text-[11px] font-medium mb-2" style={{ color: "var(--rd-text-2)" }}>Search for a game</p>
              <input
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none mb-2"
                style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)", color: "var(--rd-cream)" }}
                placeholder="Search BoardGameGeek…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {availableResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-0.5 -mx-1 px-1">
                  {availableResults.slice(0, 8).map((hit) => (
                    <button
                      key={hit.bgg_id}
                      onClick={() => addGame(hit)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-accent"
                    >
                      <span className="text-[13px] font-medium flex-1 line-clamp-1" style={{ color: "var(--rd-text)" }}>
                        {hit.title}
                      </span>
                      {hit.year_published > 0 && (
                        <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>{hit.year_published}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

// ── Recent Sessions ───────────────────────────────────────────────────────────

function RecentSessionsSection({
  sessions,
  editable,
  onSaveSuccess,
}: {
  sessions: Session[];
  editable: boolean;
  onSaveSuccess: () => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <section className="mb-8">
      <h2
        className="font-serif font-bold text-[15px] mb-3 tracking-tight"
        style={{ color: "var(--rd-cream)" }}
      >
        Recent Sessions
      </h2>
      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            editable={editable}
            onSaveSuccess={onSaveSuccess}
          />
        ))}
      </div>
    </section>
  );
}

// ── Collection ────────────────────────────────────────────────────────────────

function complexityLabel(weight: number): string {
  if (weight < 1.5) return "Light";
  if (weight < 2.5) return "Light–Med";
  if (weight < 3.5) return "Medium";
  if (weight < 4.5) return "Med–Heavy";
  return "Heavy";
}

function CollectionPosterCard({ game }: { game: CollectionGame }) {
  return (
    <div className="flex flex-col gap-2">
      <Link to={`/games/${game.bgg_id}`} className="block">
      <div
        className="relative w-full overflow-hidden rounded-lg transition-shadow duration-200 hover:shadow-[0_0_0_2px_#c97cb0,0_0_12px_rgba(201,124,176,0.3)]"
        style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)" }}
      >
        {game.image_url ? (
          <img
            src={game.image_url}
            alt={game.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🎲</div>
        )}
        {/* Status badge */}
        <div
          className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,.7)", color: STATUS_DOT[game.status] }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: STATUS_DOT[game.status] }}
          />
          {STATUS_LABELS[game.status]}
        </div>
      </div>
      </Link>

      {/* Title */}
      <p className="font-serif font-semibold text-[12px] leading-tight line-clamp-2" style={{ color: "var(--rd-text)" }}>
        {game.title}
      </p>

      {/* BGG rating + complexity */}
      {(game.bgg_rating != null || game.weight != null) && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--rd-meta)" }}>
          {game.bgg_rating != null && (
            <span className="flex items-center gap-0.5">
              <IconStar size={9} solid style={{ color: "var(--rd-star)" }} />
              {Number(game.bgg_rating).toFixed(1)}
            </span>
          )}
          {game.bgg_rating != null && game.weight != null && <span>·</span>}
          {game.weight != null && <span>{complexityLabel(Number(game.weight))}</span>}
        </div>
      )}

      {/* User rating (read-only stars) */}
      {game.user_rating != null && (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <IconStar
              key={star}
              size={11}
              solid={star <= game.user_rating!}
              style={{ color: star <= game.user_rating! ? "var(--rd-star)" : "var(--rd-meta)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionSection({ games }: { games: CollectionGame[] }) {
  const [filter, setFilter] = useState<GameStatus | "all">("all");

  if (games.length === 0) return null;

  const filtered = games.filter((g) => {
    if (filter === "all") return true;
    if (filter === "played") return g.played;
    return g.status === filter;
  });
  const preview = filtered.slice(0, 15);

  return (
    <section className="mb-8">
      <h2
        className="font-serif font-bold text-[15px] mb-3 tracking-tight"
        style={{ color: "var(--rd-cream)" }}
      >
        Collection
        <span className="ml-2 font-sans text-[12px] font-normal" style={{ color: "var(--rd-meta)" }}>
          {games.length} game{games.length !== 1 ? "s" : ""}
        </span>
      </h2>

      {/* Filter tabs */}
      <div className="flex gap-5 mb-4" style={{ borderBottom: "1px solid var(--rd-border)" }}>
        {(["all", "owned", "played", "want_to_play", "for_trade", "wishlist"] as const).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="pb-2 text-[13px] font-medium transition-colors whitespace-nowrap"
              style={
                active
                  ? { color: "var(--rd-text)", borderBottom: "2px solid var(--rd-plum)" }
                  : { color: "var(--rd-text-2)", borderBottom: "2px solid transparent" }
              }
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[12px] py-4" style={{ color: "var(--rd-meta)" }}>No games here</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {preview.map((game) => (
              <CollectionPosterCard key={game.id} game={game} />
            ))}
          </div>
          {filtered.length > 15 && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--rd-meta)" }}>
              +{filtered.length - 15} more
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Lists ─────────────────────────────────────────────────────────────────────

function ListsSection({ lists, onNavigate }: { lists: any[]; onNavigate: (id: string) => void }) {
  if (lists.length === 0) return null;
  return (
    <section className="mb-8">
      <h2
        className="font-serif font-bold text-[15px] mb-3 tracking-tight"
        style={{ color: "var(--rd-cream)" }}
      >
        Lists
      </h2>
      <div className="flex flex-col gap-2">
        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onNavigate(list.id)}
            className="flex items-center justify-between p-3 rounded-xl text-left transition-colors hover:bg-accent"
            style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
          >
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--rd-text)" }}>{list.title}</p>
              {list.description && (
                <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--rd-text-2)" }}>
                  {list.description}
                </p>
              )}
            </div>
            <span className="text-[11px] ml-4 shrink-0" style={{ color: "var(--rd-meta)" }}>
              {list.game_count ?? 0} games
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  current,
  onClose,
}: {
  current: { display_name: string; bio: string | null; avatar_url: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [displayName, setDisplayName] = useState(current.display_name);
  const [bio, setBio] = useState(current.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(current.avatar_url ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        display_name: displayName.trim() || undefined,
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      }).then((r) => r.data),
    onSuccess: (user) => {
      updateUser(user);
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
      >
        <h2 className="font-serif font-bold text-[18px]" style={{ color: "var(--rd-cream)" }}>
          Edit Profile
        </h2>

        {/* Avatar preview + URL */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full overflow-hidden text-[18px] font-bold"
            style={{ background: "rgba(201,124,176,.2)", color: "var(--rd-plum)" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} className="h-full w-full object-cover" alt="" />
            ) : (
              initials(displayName || current.display_name)
            )}
          </div>
          <input
            className="flex-1 rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)", color: "var(--rd-cream)" }}
            placeholder="Avatar image URL (optional)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </div>

        {/* Display name */}
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--rd-meta)" }}>
            Display Name
          </label>
          <input
            autoFocus
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)", color: "var(--rd-cream)" }}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {/* Bio */}
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--rd-meta)" }}>
            Bio
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)", color: "var(--rd-cream)" }}
            rows={3}
            placeholder="A little about yourself…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        {mutation.isError && (
          <p className="text-[12px]" style={{ color: "var(--rd-loss)" }}>Failed to save. Please try again.</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium"
            style={{ color: "var(--rd-meta)" }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutation.isPending || !displayName.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--rd-plum)", color: "var(--rd-cream)" }}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", id],
    queryFn: () => socialApi.getProfile(id!).then((r) => r.data),
    enabled: !!id,
  });

  return (
    <AppLayout>
      {isLoading ? (
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-20 rounded-xl" style={{ background: "var(--rd-surface)" }} />
          <div className="h-40 rounded-xl" style={{ background: "var(--rd-surface)" }} />
        </div>
      ) : isError || !data ? (
        <p className="text-sm" style={{ color: "var(--rd-text-2)" }}>User not found.</p>
      ) : (
        <>
          {/* ── Header ── */}
          <div className="mb-8">
            {/* Avatar + name row — centered on mobile, left-aligned on desktop */}
            <div className="flex items-center justify-center gap-3 md:items-start md:justify-start md:gap-4">
              <div className="relative shrink-0">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-bold overflow-hidden"
                  style={{ background: "rgba(201,124,176,.2)", color: "var(--rd-plum)" }}
                >
                  {data.user.avatar_url ? (
                    <img src={data.user.avatar_url} className="h-full w-full object-cover" alt={data.user.display_name} />
                  ) : (
                    initials(data.user.display_name)
                  )}
                </div>
                {data.is_own_profile && (
                  <button
                    onClick={() => setEditOpen(true)}
                    title="Edit profile"
                    className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                    style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
                  >
                    <IconPencil size={10} style={{ color: "var(--rd-text-2)" }} />
                  </button>
                )}
              </div>

              {/* Name + bio + follow */}
              <div className="min-w-0 md:flex-1">
                <p
                  className="font-semibold text-[16px] leading-tight truncate md:font-serif md:font-bold md:text-[22px] md:tracking-tight"
                  style={{ color: "var(--rd-cream)" }}
                >
                  {data.user.display_name}
                </p>
                {data.user.bio && (
                  <p className="text-[12px] mt-0.5 leading-snug line-clamp-2" style={{ color: "var(--rd-text-2)" }}>
                    {data.user.bio}
                  </p>
                )}
                {!data.is_own_profile && (
                  <div className="mt-2">
                    <FollowButton userId={data.user.id} isFollowing={data.is_following} />
                  </div>
                )}
              </div>

              {/* Stats — desktop only, inline right */}
              <div className="hidden md:flex gap-5 shrink-0">
                <Stat label="Owned"     value={data.owned_count} />
                <Stat label="Played"    value={data.played_count} />
                <Stat label="Followers" value={data.follower_count} />
                <Stat label="Following" value={data.following_count} />
              </div>
            </div>

            {/* Stats — mobile only, full-width bar below */}
            <div className="flex justify-around mt-4 md:hidden">
              <Stat label="Owned"     value={data.owned_count} />
              <Stat label="Played"    value={data.played_count} />
              <Stat label="Followers" value={data.follower_count} />
              <Stat label="Following" value={data.following_count} />
            </div>
          </div>

          <RoundTableSection slots={data.round_table} isOwner={data.is_own_profile} profileId={id!} />
          <RecentSessionsSection
            sessions={data.recent_sessions ?? []}
            editable={data.is_own_profile}
            onSaveSuccess={() => qc.invalidateQueries({ queryKey: ["profile", id] })}
          />
          <CollectionSection games={data.collection} />
          <ListsSection lists={data.lists} onNavigate={(listId) => navigate(`/lists/${listId}`)} />

          {editOpen && (
            <EditProfileModal
              current={data.user}
              onClose={() => setEditOpen(false)}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
