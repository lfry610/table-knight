import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/primitives";
import { IconPlus, IconStar, IconPencil, IconTrash } from "@/components/ui/icons";
import { gamesApi, reviewsApi, type CollectionGame, type BGGSearchHit, type GameStatus } from "@/lib/api";

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

function HalfStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = rating >= n;
        const half = !filled && rating >= n - 0.5;
        return (
          <span key={n} className="relative inline-block" style={{ width: 11, height: 11 }}>
            <IconStar size={11} style={{ color: "var(--rd-border)", position: "absolute", inset: 0 }} />
            {(filled || half) && (
              <span style={{ position: "absolute", inset: 0, overflow: "hidden", width: filled ? "100%" : "50%" }}>
                <IconStar size={11} solid style={{ color: "var(--rd-star)" }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function complexityLabel(weight: number): string {
  if (weight < 1.5) return "Light";
  if (weight < 2.5) return "Light–Med";
  if (weight < 3.5) return "Medium";
  if (weight < 4.5) return "Med–Heavy";
  return "Heavy";
}

export function CollectionPage() {
  const [searchQuery, setSearchQuery]   = useState("");
  const [bggResults, setBggResults]     = useState<BGGSearchHit[]>([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  const [filterStatus, setFilterStatus] = useState<GameStatus | "all">("all");
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [addStatus, setAddStatus]       = useState<GameStatus>("owned");

  const qc = useQueryClient();

  const { data: collection, isLoading, isError } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

  const { data: reviews } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => reviewsApi.getMyReviews().then((r) => r.data),
  });

  const reviewByGameId = Object.fromEntries((reviews ?? []).map((r) => [r.game_id, r.rating]));

  const addMutation = useMutation({
    mutationFn: (data: { bgg_id: number; status: GameStatus }) =>
      gamesApi.addToCollection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection"] });
      setShowSearch(false);
      setSearchQuery("");
      setBggResults([]);
    },
  });

  const searchRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setBggResults([]);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(async () => {
      searchRef.current?.abort();
      searchRef.current = new AbortController();
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await gamesApi.search(trimmed);
        setBggResults(res.data.slice(0, 10));
      } catch {
        setSearchError("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredCollection = collection?.filter((g) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "played") return g.played;
    return g.status === filterStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-serif font-bold text-[26px] leading-tight tracking-tight"
              style={{ color: "var(--rd-cream)" }}
            >
              Collection
            </h1>
            <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
              {collection?.length ?? 0} games
            </p>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
          >
            <IconPlus size={13} />
            Add game
          </button>
        </div>

        {/* BGG Search panel */}
        {showSearch && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
          >
            <p className="text-[13px] font-medium">Search BoardGameGeek</p>
            <div className="relative">
              <Input
                placeholder="Wingspan, Catan, Gloomhaven..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {isSearching && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
                  style={{ color: "var(--rd-text-2)" }}
                >
                  …
                </span>
              )}
            </div>

            {searchError && (
              <p className="text-[12px]" style={{ color: "var(--rd-loss)" }}>{searchError}</p>
            )}

            {bggResults.length > 0 && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px]" style={{ color: "var(--rd-text-2)" }}>Add as:</p>
                  <div className="flex gap-1 flex-wrap">
                    {(["owned", "played", "want_to_play", "wishlist", "for_trade"] as GameStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setAddStatus(s)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                        style={
                          addStatus === s
                            ? { background: "var(--rd-plum)", color: "var(--rd-bg)" }
                            : { background: "var(--rd-surface-hi)", color: "var(--rd-text-2)" }
                        }
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: STATUS_DOT[s] }}
                        />
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  {bggResults.map((hit) => (
                    <div
                      key={hit.bgg_id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent cursor-pointer"
                    >
                      <div>
                        <p className="text-[13px] font-medium">{hit.title}</p>
                        {hit.year_published > 0 && (
                          <p className="text-[11px]" style={{ color: "var(--rd-meta)" }}>
                            {hit.year_published}
                          </p>
                        )}
                      </div>
                      <button
                        disabled={addMutation.isPending}
                        onClick={() => addMutation.mutate({ bgg_id: hit.bgg_id, status: addStatus })}
                        className="text-[12px] font-medium px-2.5 py-1 rounded-lg border transition-colors hover:bg-accent disabled:opacity-50"
                        style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div
          className="flex gap-5"
          style={{ borderBottom: "1px solid var(--rd-border)" }}
        >
          {(["all", "owned", "played", "want_to_play", "for_trade", "wishlist"] as const).map((s) => {
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="pb-2 text-[13px] font-medium transition-colors"
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

        {/* Game grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-muted animate-pulse" style={{ aspectRatio: "3/4" }} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="font-medium text-sm" style={{ color: "var(--rd-loss)" }}>Failed to load collection</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>Check the console for details</p>
          </div>
        ) : filteredCollection?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="font-medium text-sm" style={{ color: "var(--rd-text-2)" }}>No games here yet</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
              {filterStatus === "all" ? "Add your first game above" : `No games with status "${STATUS_LABELS[filterStatus as GameStatus]}"`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {filteredCollection?.map((game) => (
              <PosterCard key={game.id} game={game} reviewRating={reviewByGameId[game.id]} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PosterCard({ game, reviewRating }: { game: CollectionGame; reviewRating?: number }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm-remove">("idle");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["collection"] });

  const rateMutation = useMutation({
    mutationFn: (rating: number) =>
      gamesApi.updateCollectionEntry(game.id, { user_rating: rating }),
    onMutate: (newRating) => {
      const prev = qc.getQueryData<CollectionGame[]>(["collection"]);
      qc.setQueryData<CollectionGame[]>(["collection"], (old) =>
        old?.map((g) => g.id === game.id ? { ...g, user_rating: newRating } : g)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["collection"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["collection"] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: GameStatus) =>
      gamesApi.updateCollectionEntry(game.id, { status }),
    onSuccess: () => { invalidate(); setMode("idle"); },
  });

  const removeMutation = useMutation({
    mutationFn: () => gamesApi.removeFromCollection(game.id),
    onSuccess: invalidate,
  });

  return (
    <div className="group flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)" }}
      >
        <Link to={`/games/${game.bgg_id}`} className="absolute inset-0">
          {game.image_url ? (
            <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl">🎲</div>
          )}
        </Link>

        {/* Status badge */}
        {mode === "idle" && (
          <div
            className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "rgba(0,0,0,.7)", color: STATUS_DOT[game.status] }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[game.status] }} />
            {STATUS_LABELS[game.status]}
          </div>
        )}

        {/* Hover action buttons */}
        {mode === "idle" && (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setMode("edit")}
              className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
              style={{ background: "rgba(0,0,0,.65)", color: "#fff" }}
              title="Edit status"
            >
              <IconPencil size={11} />
            </button>
            <button
              onClick={() => setMode("confirm-remove")}
              className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
              style={{ background: "rgba(0,0,0,.65)", color: "var(--rd-loss)" }}
              title="Remove"
            >
              <IconTrash size={11} />
            </button>
          </div>
        )}

        {/* Edit status overlay */}
        {mode === "edit" && (
          <div
            className="absolute inset-0 flex flex-col justify-center gap-1.5 px-2.5 py-3"
            style={{ background: "rgba(0,0,0,.85)" }}
          >
            <p className="text-[10px] font-semibold text-center mb-1" style={{ color: "var(--rd-text-2)" }}>
              Change status
            </p>
            {(["owned", "want_to_play", "for_trade", "wishlist"] as GameStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                style={
                  game.status === s
                    ? { background: "rgba(201,124,176,.25)", color: "var(--rd-plum)" }
                    : { background: "rgba(255,255,255,.07)", color: "#fff" }
                }
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[s] }} />
                {STATUS_LABELS[s]}
              </button>
            ))}
            <button
              onClick={() => setMode("idle")}
              className="mt-1 text-[10px] text-center w-full"
              style={{ color: "var(--rd-meta)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Remove confirmation overlay */}
        {mode === "confirm-remove" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(0,0,0,.85)" }}
          >
            <p className="text-[11px] font-semibold text-center px-2" style={{ color: "#fff" }}>
              Remove from collection?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                style={{ background: "var(--rd-loss)", color: "#fff" }}
              >
                Remove
              </button>
              <button
                onClick={() => setMode("idle")}
                className="px-3 py-1 rounded-lg text-[11px] border"
                style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="font-serif font-semibold text-[12px] leading-tight line-clamp-2" style={{ color: "var(--rd-text)" }}>
        {game.title}
      </p>

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

      {reviewRating != null ? (
        <HalfStars rating={reviewRating} />
      ) : (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => rateMutation.mutate(star)} title={`Rate ${star}`}>
              <IconStar
                size={11}
                solid={star <= (game.user_rating ?? 0)}
                style={{ color: star <= (game.user_rating ?? 0) ? "var(--rd-star)" : "var(--rd-meta)" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
