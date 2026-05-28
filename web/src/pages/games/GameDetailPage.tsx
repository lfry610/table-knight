import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { IconStar } from "@/components/ui/icons";
import { gamesApi, type ReviewStat } from "@/lib/api";
import { SessionRow } from "@/pages/sessions/SessionsPage";

function complexityLabel(weight: number): string {
  if (weight < 1.5) return "Light";
  if (weight < 2.5) return "Light–Med";
  if (weight < 3.5) return "Medium";
  if (weight < 4.5) return "Med–Heavy";
  return "Heavy";
}

function HalfStarDisplay({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = rating >= n;
        const half = !filled && rating >= n - 0.5;
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <IconStar size={size} style={{ color: "var(--rd-border)", position: "absolute", inset: 0 }} />
            {(filled || half) && (
              <span style={{ position: "absolute", inset: 0, overflow: "hidden", width: filled ? "100%" : "50%" }}>
                <IconStar size={size} solid style={{ color: "var(--rd-star)" }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function RatingHistogram({ stats }: { stats: ReviewStat[] }) {
  if (stats.length === 0) return null;

  const totalCount = stats.reduce((s, r) => s + r.count, 0);
  const avgRating = stats.reduce((s, r) => s + r.rating * r.count, 0) / totalCount;
  const maxCount = Math.max(...stats.map((r) => r.count));

  // Build all half-star slots 5.0 → 0.5
  const slots = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5];
  const byRating = Object.fromEntries(stats.map((s) => [s.rating, s.count]));

  return (
    <section>
      <h2
        className="font-serif font-bold text-[15px] mb-3 tracking-tight"
        style={{ color: "var(--rd-cream)" }}
      >
        Ratings
        <span className="ml-2 font-sans text-[12px] font-normal" style={{ color: "var(--rd-meta)" }}>
          {totalCount} {totalCount === 1 ? "review" : "reviews"} · avg {avgRating.toFixed(1)}
        </span>
      </h2>
      <div
        className="rounded-xl p-4 space-y-1"
        style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
      >
        {slots.map((r) => {
          const count = byRating[r] ?? 0;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="text-[10px] w-6 text-right shrink-0" style={{ color: "var(--rd-meta)" }}>
                {r.toFixed(1)}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--rd-border)" }}>
                {count > 0 && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "var(--rd-star)" }}
                  />
                )}
              </div>
              <span className="text-[10px] w-4 shrink-0" style={{ color: count > 0 ? "var(--rd-meta)" : "transparent" }}>
                {count > 0 ? count : ""}
              </span>
            </div>
          );
        })}
        <div className="pt-2 flex items-center gap-1.5">
          <HalfStarDisplay rating={avgRating} size={13} />
          <span className="text-[12px]" style={{ color: "var(--rd-star)" }}>{avgRating.toFixed(1)}</span>
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl"
      style={{ background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
    >
      <span className="text-[15px] font-bold" style={{ color: "var(--rd-cream)" }}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--rd-meta)" }}>{label}</span>
    </div>
  );
}

export function GameDetailPage() {
  const { bggId } = useParams<{ bggId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["game-detail", bggId],
    queryFn: () => gamesApi.getGameDetail(Number(bggId)).then((r) => r.data),
    enabled: !!bggId,
  });

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
            style={{ color: "var(--rd-text-2)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {!isLoading && data?.user_review && (
            <div className="flex items-center gap-2">
              <HalfStarDisplay rating={data.user_review.rating} size={15} />
              <span className="text-[12px] font-medium" style={{ color: "var(--rd-star)" }}>
                {Number(data.user_review.rating).toFixed(1)}
              </span>
              <span className="text-[11px]" style={{ color: "var(--rd-meta)" }}>Your review</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-64 rounded-xl" style={{ background: "var(--rd-surface)" }} />
            <div className="h-8 w-48 rounded" style={{ background: "var(--rd-surface)" }} />
            <div className="h-24 rounded" style={{ background: "var(--rd-surface)" }} />
          </div>
        ) : isError || !data ? (
          <p style={{ color: "var(--rd-text-2)" }}>Game not found.</p>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex gap-6">
              {/* Cover */}
              <div
                className="relative shrink-0 overflow-hidden rounded-xl"
                style={{
                  width: 120,
                  paddingBottom: 0,
                  height: 160,
                  background: "var(--rd-surface-hi)",
                  border: "1px solid var(--rd-border)",
                }}
              >
                {data.game.image_url ? (
                  <img
                    src={data.game.image_url}
                    alt={data.game.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🎲</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <h1
                  className="font-serif font-bold text-[26px] leading-tight tracking-tight"
                  style={{ color: "var(--rd-cream)" }}
                >
                  {data.game.title}
                </h1>

                {data.game.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.game.categories.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: "rgba(201,124,176,.15)", color: "var(--rd-plum)" }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stat pills */}
                <div className="flex flex-wrap gap-2">
                  {data.game.bgg_rating != null && (
                    <StatPill
                      label="BGG Rating"
                      value={
                        <span className="flex items-center gap-1">
                          <IconStar size={12} solid style={{ color: "var(--rd-star)" }} />
                          {Number(data.game.bgg_rating).toFixed(1)}
                        </span> as any
                      }
                    />
                  )}
                  {data.game.weight != null && (
                    <StatPill label="Complexity" value={complexityLabel(Number(data.game.weight))} />
                  )}
                  <StatPill
                    label="Players"
                    value={
                      data.game.min_players === data.game.max_players
                        ? String(data.game.min_players)
                        : `${data.game.min_players}–${data.game.max_players}`
                    }
                  />
                  {data.game.playtime_mins != null && (
                    <StatPill label="Playtime" value={`${data.game.playtime_mins} min`} />
                  )}
                </div>
              </div>
            </div>

            {/* ── Description ── */}
            {data.game.description && (
              <section>
                <h2
                  className="font-serif font-bold text-[15px] mb-2 tracking-tight"
                  style={{ color: "var(--rd-cream)" }}
                >
                  About
                </h2>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rd-text-2)" }}
                  dangerouslySetInnerHTML={{
                    __html: data.game.description
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/&#10;/g, "<br/>"),
                  }}
                />
              </section>
            )}

            {/* ── Ratings histogram ── */}
            {data.review_stats && data.review_stats.length > 0 && (
              <RatingHistogram stats={data.review_stats} />
            )}

            {/* ── Your sessions ── */}
            <section>
              <h2
                className="font-serif font-bold text-[15px] mb-3 tracking-tight"
                style={{ color: "var(--rd-cream)" }}
              >
                Your Sessions
                {data.sessions.length > 0 && (
                  <span className="ml-2 font-sans text-[12px] font-normal" style={{ color: "var(--rd-meta)" }}>
                    {data.sessions.length} logged
                  </span>
                )}
              </h2>
              {data.sessions.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--rd-meta)" }}>
                  No sessions logged for this game yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.sessions.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
