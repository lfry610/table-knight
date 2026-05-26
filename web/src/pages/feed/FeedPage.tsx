import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/primitives";
import { IconUsers, IconSearch } from "@/components/ui/icons";
import { socialApi, sessionsApi, type FeedItem, type SessionResult, type UserSearchResult, type GroupMate } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function actionText(item: FeedItem, isOwn: boolean): string {
  const you = isOwn ? "You" : item.display_name;
  const their = isOwn ? "your" : "their";
  const title = item.game_title ?? "a game";
  switch (item.type) {
    case "session_logged": return `${you} logged a session of ${title}`;
    case "game_added":     return `${you} added ${title} to ${their} collection`;
    case "game_for_trade": return `${you} listed ${title} for trade`;
    case "list_created":   return `${you} created a list: ${item.list_title ?? "a list"}`;
    case "group_joined":   return `${you} joined ${item.group_name ?? "a crew"}`;
  }
}

// ── Session feed card ─────────────────────────────────────────────────────────

const RESULT_META: Record<SessionResult, { label: string; color: string }> = {
  win:  { label: "Win",  color: "var(--rd-win)"   },
  loss: { label: "Loss", color: "var(--rd-loss)"  },
  draw: { label: "Draw", color: "var(--rd-brass)" },
  dnf:  { label: "DNF",  color: "var(--rd-meta)"  },
};

function SessionFeedCard({ item, isOwn }: { item: FeedItem; isOwn: boolean }) {
  const { data: players } = useQuery({
    queryKey: ["session-players", item.session_id],
    queryFn: () => sessionsApi.getPlayers(item.session_id!).then((r) => r.data),
    enabled: !!item.session_id,
  });

  const playedAt = new Date(item.created_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Game poster */}
        <Link to={`/games/${item.game_id}`} className="shrink-0">
          <div
            className="relative h-12 w-9 overflow-hidden rounded transition-opacity hover:opacity-80"
            style={{ background: "var(--rd-surface-hi)" }}
          >
            {item.game_image
              ? <img src={item.game_image} alt={item.game_title ?? ""} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-lg">🎲</div>}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Actor line */}
          <p className="text-[13px] leading-snug" style={{ color: "var(--rd-text-2)" }}>
            {!isOwn && (
              <>
                <Link
                  to={`/users/${item.actor_id}`}
                  className="font-semibold hover:underline"
                  style={{ color: "var(--rd-text)" }}
                >
                  {item.display_name}
                </Link>{" "}
              </>
            )}
            {isOwn ? "You logged a session of " : "logged a session of "}
            <Link
              to={`/games/${item.game_id}`}
              className="font-semibold hover:underline"
              style={{ color: "var(--rd-cream)" }}
            >
              {item.game_title ?? "a game"}
            </Link>
          </p>

          {/* Date + duration */}
          <p className="text-[11px] mt-0.5" style={{ color: "var(--rd-meta)" }}>
            {playedAt}
            {item.session_duration != null && ` · ${item.session_duration} min`}
          </p>

          {/* Notes */}
          {item.session_notes && (
            <p className="text-[11px] mt-1 italic line-clamp-1" style={{ color: "var(--rd-text-2)" }}>
              "{item.session_notes}"
            </p>
          )}
        </div>
      </div>

      {/* Players */}
      {players && players.length > 0 && (
        <div
          className="rounded-lg px-3 py-1 divide-y"
          style={{ background: "var(--rd-surface-hi)", borderColor: "var(--rd-border)" }}
        >
          {players.map((p) => {
            const meta = RESULT_META[p.result];
            return (
              <div key={p.id} className="flex items-center gap-2 py-1">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Link
                  to={`/users/${p.id}`}
                  className="flex-1 text-[12px] font-medium hover:underline truncate"
                  style={{ color: "var(--rd-text)" }}
                >
                  {p.display_name}
                </Link>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                {p.score != null && (
                  <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>
                    · {p.score}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-[11px]" style={{ color: "var(--rd-meta)" }}>
        {timeAgo(item.created_at)}
      </p>
    </div>
  );
}

// ── Feed item card ────────────────────────────────────────────────────────────

function FeedCard({ item, currentUserId }: { item: FeedItem; currentUserId: string }) {
  const isOwn = item.actor_id === currentUserId;

  if (item.type === "session_logged") {
    return <SessionFeedCard item={item} isOwn={isOwn} />;
  }

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      {/* Avatar */}
      <Link to={`/users/${item.actor_id}`} className="shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-80"
          style={{ background: "rgba(201,124,176,.2)", color: "var(--rd-plum)" }}
        >
          {initials(item.display_name)}
        </div>
      </Link>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug" style={{ color: "var(--rd-text-2)" }}>
          {!isOwn && (
            <>
              <Link
                to={`/users/${item.actor_id}`}
                className="font-semibold hover:underline"
                style={{ color: "var(--rd-text)" }}
              >
                {item.display_name}
              </Link>{" "}
            </>
          )}

          {item.type === "list_created" && item.list_id ? (
            <>
              {isOwn ? "You" : ""} created a list:{" "}
              <Link
                to={`/lists/${item.list_id}`}
                className="font-semibold hover:underline"
                style={{ color: "var(--rd-cream)" }}
              >
                {item.list_title ?? "a list"}
              </Link>
            </>
          ) : (
            actionText(item, isOwn)
          )}
        </p>

        {item.type === "list_created" && item.list_id && (
          <Link
            to={`/lists/${item.list_id}`}
            className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:brightness-110"
            style={{ background: "var(--rd-surface-hi)", color: "var(--rd-plum)", border: "1px solid var(--rd-border)" }}
          >
            View list →
          </Link>
        )}

        <p className="mt-1.5 text-[11px]" style={{ color: "var(--rd-meta)" }}>
          {timeAgo(item.created_at)}
        </p>
      </div>

      {/* Game poster (non-list items) */}
      {item.game_image && item.game_id && item.type !== "list_created" && (
        <Link
          to={`/games/${item.game_id}`}
          className="shrink-0 overflow-hidden rounded transition-opacity hover:opacity-80"
          style={{ width: 32, height: 43, background: "var(--rd-surface-hi)" }}
        >
          <img src={item.game_image} alt={item.game_title ?? ""} className="h-full w-full object-cover" />
        </Link>
      )}
    </div>
  );
}

// ── Follow button ─────────────────────────────────────────────────────────────

function FollowButton({ userId, isFollowing }: { userId: string; isFollowing: boolean }) {
  const qc = useQueryClient();

  const follow = useMutation({
    mutationFn: () => socialApi.follow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["user-search"] });
      qc.invalidateQueries({ queryKey: ["group-mates"] });
    },
  });

  const unfollow = useMutation({
    mutationFn: () => socialApi.unfollow(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["user-search"] });
      qc.invalidateQueries({ queryKey: ["group-mates"] });
    },
  });

  const pending = follow.isPending || unfollow.isPending;

  if (isFollowing) {
    return (
      <button
        onClick={() => unfollow.mutate()}
        disabled={pending}
        className="text-[12px] font-medium px-3 py-1 rounded-lg border transition-colors hover:bg-accent disabled:opacity-50"
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
      className="text-[12px] font-semibold px-3 py-1 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
    >
      Follow
    </button>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────

function UserRow({ user, isFollowing, onNavigate }: { user: UserSearchResult | GroupMate; isFollowing: boolean; onNavigate: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: "rgba(201,124,176,.15)", color: "var(--rd-plum)" }}
      >
        {initials(user.display_name)}
      </div>
      <button
        onClick={onNavigate}
        className="flex-1 text-left text-[13px] font-medium hover:underline"
        style={{ color: "var(--rd-text)" }}
      >
        {user.display_name}
      </button>
      <FollowButton userId={user.id} isFollowing={isFollowing} />
    </div>
  );
}

// ── Discover panel ────────────────────────────────────────────────────────────

function DiscoverPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const { data: searchResults } = useQuery({
    queryKey: ["user-search", debouncedQuery],
    queryFn: () => socialApi.searchUsers(debouncedQuery).then((r) => r.data),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: groupMates } = useQuery({
    queryKey: ["group-mates"],
    queryFn: () => socialApi.getGroupMates().then((r) => r.data),
  });

  const showSearch = debouncedQuery.length >= 2 && searchResults;
  const showGroupMates = !showSearch && (groupMates?.length ?? 0) > 0;

  return (
    <div
      className="rounded-xl p-4 space-y-3 mb-6"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold" style={{ color: "var(--rd-text)" }}>Find people</p>
        <button
          onClick={onClose}
          className="text-[12px] transition-colors hover:text-foreground"
          style={{ color: "var(--rd-text-2)" }}
        >
          Done
        </button>
      </div>

      <div className="relative">
        <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--rd-meta)" }} />
        <Input
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
          autoFocus
        />
      </div>

      {showSearch && (
        <div className="divide-y" style={{ borderColor: "var(--rd-border)" }}>
          {searchResults.length === 0 ? (
            <p className="py-2 text-[12px]" style={{ color: "var(--rd-meta)" }}>No users found</p>
          ) : (
            searchResults.map((u) => (
              <UserRow key={u.id} user={u} isFollowing={u.is_following} onNavigate={() => { onClose(); navigate(`/users/${u.id}`); }} />
            ))
          )}
        </div>
      )}

      {showGroupMates && (
        <>
          <p className="text-[11px] font-medium" style={{ color: "var(--rd-text-2)" }}>
            From your crews
          </p>
          <div className="divide-y" style={{ borderColor: "var(--rd-border)" }}>
            {groupMates!.map((u) => (
              <UserRow key={u.id} user={u} isFollowing={false} onNavigate={() => { onClose(); navigate(`/users/${u.id}`); }} />
            ))}
          </div>
        </>
      )}

      {!showSearch && !showGroupMates && (
        <p className="text-[12px]" style={{ color: "var(--rd-meta)" }}>
          {debouncedQuery.length > 0 && debouncedQuery.length < 2
            ? "Keep typing…"
            : "No crew mates to suggest — try searching by name"}
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FeedPage() {
  const [showDiscover, setShowDiscover] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => socialApi.getFeed({ limit: 50 }).then((r) => r.data),
  });

  const { data: following } = useQuery({
    queryKey: ["following"],
    queryFn: () => socialApi.getFollowing().then((r) => r.data),
  });

  const isEmpty = !isLoading && (feed?.length ?? 0) === 0;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="font-serif font-bold text-[26px] leading-tight tracking-tight"
            style={{ color: "var(--rd-cream)" }}
          >
            Feed
          </h1>
          {(following?.length ?? 0) > 0 && (
            <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
              Following {following!.length} {following!.length === 1 ? "person" : "people"}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowDiscover((v) => !v)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
        >
          <IconUsers size={13} />
          Find people
        </button>
      </div>

      {/* Discover panel */}
      {showDiscover && <DiscoverPanel onClose={() => setShowDiscover(false)} />}

      {/* Feed */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--rd-surface)" }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div
          className="flex flex-col items-center py-20 text-center rounded-xl border border-dashed"
          style={{ borderColor: "var(--rd-border)" }}
        >
          <IconUsers size={36} style={{ color: "var(--rd-text-2)", marginBottom: 12 }} />
          <p className="font-serif font-semibold text-[16px] mb-1" style={{ color: "var(--rd-text)" }}>
            Nothing here yet
          </p>
          <p className="text-[12px] mb-5" style={{ color: "var(--rd-text-2)" }}>
            Follow people to see their sessions, new games, and trades
          </p>
          {!showDiscover && (
            <button
              onClick={() => setShowDiscover(true)}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
            >
              <IconUsers size={13} />
              Find people
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {feed!.map((item) => (
            <FeedCard key={item.activity_id} item={item} currentUserId={currentUser?.id ?? ""} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
