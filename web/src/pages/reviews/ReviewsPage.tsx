import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { IconQuill, IconSearch, IconStar } from "@/components/ui/icons";
import { reviewsApi, type Review, type ReviewableGame } from "@/lib/api";

// ── Half-star display ──────────────────────────────────────────────────────────

function HalfStars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = rating >= n;
        const half = !filled && rating >= n - 0.5;
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            {/* empty base */}
            <IconStar size={size} style={{ color: "var(--rd-border)", position: "absolute", inset: 0 }} />
            {/* filled overlay — full or half */}
            {(filled || half) && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  width: filled ? "100%" : "50%",
                }}
              >
                <IconStar size={size} solid style={{ color: "var(--rd-star)" }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// ── Half-star interactive input ───────────────────────────────────────────────

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  function getVal(n: number, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? n - 0.5 : n;
  }

  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = display >= n;
        const half = !filled && display >= n - 0.5;
        return (
          <button
            key={n}
            type="button"
            className="relative"
            style={{ width: 24, height: 24 }}
            onMouseMove={(e) => setHover(getVal(n, e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => onChange(getVal(n, e))}
          >
            <IconStar size={24} style={{ color: "var(--rd-border)", position: "absolute", inset: 0 }} />
            {(filled || half) && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  width: filled ? "100%" : "50%",
                }}
              >
                <IconStar size={24} solid style={{ color: "var(--rd-star)" }} />
              </span>
            )}
          </button>
        );
      })}
    </span>
  );
}

// ── Log Review Modal ──────────────────────────────────────────────────────────

function LogReviewModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedGame, setSelectedGame] = useState<ReviewableGame | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");

  const { data: reviewableGames = [] } = useQuery({
    queryKey: ["reviewable-games"],
    queryFn: () => reviewsApi.getReviewableGames().then((r) => r.data),
  });

  const filtered = query.trim()
    ? reviewableGames.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))
    : reviewableGames;

  const mutation = useMutation({
    mutationFn: () =>
      reviewsApi.upsert({ game_id: selectedGame!.id, rating, body: body || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
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
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
      >
        <h2 className="font-serif font-bold text-[18px]" style={{ color: "var(--rd-cream)" }}>
          Log a Review
        </h2>

        {/* Game picker */}
        {!selectedGame ? (
          <div className="space-y-2">
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--rd-meta)" }} />
              <input
                autoFocus
                className="w-full rounded-lg pl-8 pr-3 py-2 text-[13px] outline-none"
                style={{
                  background: "var(--rd-surface-hi)",
                  border: "1px solid var(--rd-border)",
                  color: "var(--rd-cream)",
                }}
                placeholder="Search your games…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div
              className="max-h-56 overflow-y-auto rounded-lg divide-y"
              style={{ border: "1px solid var(--rd-border)", borderColor: "var(--rd-border)" }}
            >
              {filtered.length === 0 ? (
                <p className="p-3 text-[12px]" style={{ color: "var(--rd-meta)" }}>
                  No games found. Only owned or played games can be reviewed.
                </p>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                    onClick={() => setSelectedGame(g)}
                  >
                    <div
                      className="shrink-0 w-8 rounded overflow-hidden"
                      style={{ height: 40, background: "var(--rd-surface-hi)" }}
                    >
                      {g.image_url ? (
                        <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-base">🎲</span>
                      )}
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--rd-cream)" }}>{g.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected game header */}
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 w-10 rounded overflow-hidden"
                style={{ height: 52, background: "var(--rd-surface-hi)" }}
              >
                {selectedGame.image_url ? (
                  <img src={selectedGame.image_url} alt={selectedGame.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-lg">🎲</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate" style={{ color: "var(--rd-cream)" }}>
                  {selectedGame.title}
                </p>
                <button
                  type="button"
                  className="text-[11px] hover:opacity-80"
                  style={{ color: "var(--rd-meta)" }}
                  onClick={() => { setSelectedGame(null); setRating(0); setBody(""); }}
                >
                  Change game
                </button>
              </div>
            </div>

            {/* Rating */}
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--rd-meta)" }}>
                Rating
              </label>
              <div className="flex items-center gap-3">
                <StarInput value={rating} onChange={setRating} />
                {rating > 0 && (
                  <span className="text-[13px]" style={{ color: "var(--rd-star)" }}>
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide font-medium" style={{ color: "var(--rd-meta)" }}>
                Review (optional)
              </label>
              <textarea
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
                style={{
                  background: "var(--rd-surface-hi)",
                  border: "1px solid var(--rd-border)",
                  color: "var(--rd-cream)",
                }}
                rows={4}
                placeholder="Share your thoughts…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
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
                disabled={rating === 0 || mutation.isPending}
                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--rd-plum)", color: "var(--rd-cream)" }}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Saving…" : "Save Review"}
              </button>
            </div>
            {mutation.isError && (
              <p className="text-[12px]" style={{ color: "var(--rd-loss)" }}>
                Failed to save review. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Review Card (Letterboxd-style poster) ─────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.updated_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Link to={`/games/${review.game_bgg_id}`} className="group block space-y-1.5">
      {/* Poster */}
      <div
        className="relative overflow-hidden rounded-lg w-full"
        style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
      >
        <div className="absolute inset-0">
          {review.game_image ? (
            <img src={review.game_image} alt={review.game_title ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🎲</div>
          )}
          {/* hover overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,.7) 40%, transparent)" }}
          >
            {review.body && (
              <p className="text-[10px] leading-snug line-clamp-3" style={{ color: "var(--rd-cream)" }}>
                {review.body}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stars + date */}
      <div className="space-y-0.5">
        <HalfStars rating={review.rating} size={11} />
        <p className="text-[10px]" style={{ color: "var(--rd-meta)" }}>{date}</p>
      </div>
    </Link>
  );
}

// ── Reviews Page ──────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const [showModal, setShowModal] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewsApi.getMyReviews().then((r) => r.data),
  });

  const totalRatings = reviews.length;
  const avgRating = totalRatings > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / totalRatings).toFixed(1)
    : null;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="font-serif font-bold text-[26px] tracking-tight" style={{ color: "var(--rd-cream)" }}>
              Reviews
            </h1>
            {avgRating && (
              <p className="text-[13px]" style={{ color: "var(--rd-meta)" }}>
                {totalRatings} {totalRatings === 1 ? "review" : "reviews"} · avg {avgRating}
              </p>
            )}
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--rd-plum)", color: "var(--rd-cream)" }}
            onClick={() => setShowModal(true)}
          >
            <IconQuill size={14} />
            Log a Review
          </button>
        </div>

        {isLoading ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div
                  className="w-full rounded-lg"
                  style={{ paddingBottom: "133.333%", background: "var(--rd-surface)" }}
                />
                <div className="h-3 w-16 rounded" style={{ background: "var(--rd-surface)" }} />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl gap-3"
            style={{ border: "1px dashed var(--rd-border)" }}
          >
            <IconQuill size={32} style={{ color: "var(--rd-meta)" }} />
            <p className="text-[14px]" style={{ color: "var(--rd-meta)" }}>
              No reviews yet. Start by logging a review.
            </p>
            <button
              className="px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ background: "var(--rd-plum)", color: "var(--rd-cream)" }}
              onClick={() => setShowModal(true)}
            >
              Log a Review
            </button>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
          >
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}
      </div>

      {showModal && <LogReviewModal onClose={() => setShowModal(false)} />}
    </AppLayout>
  );
}
