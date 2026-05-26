import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { gamesApi, roundTableApi, type BGGSearchHit } from "@/lib/api";
import { LogoMark, IconX, IconSearch } from "@/components/ui/icons";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BGGSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BGGSearchHit[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setSearching(true);
    gamesApi.search(debouncedQuery)
      .then((r) => setResults(r.data.filter((h) => !selected.some((s) => s.bgg_id === h.bgg_id))))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  const saveMutation = useMutation({
    mutationFn: () => roundTableApi.set(selected.map((g) => g.bgg_id)),
    onSuccess: () => navigate("/dashboard"),
  });

  const addGame = (hit: BGGSearchHit) => {
    if (selected.length >= 5 || selected.some((s) => s.bgg_id === hit.bgg_id)) return;
    setSelected((prev) => [...prev, hit]);
    setQuery("");
    setResults([]);
    setShowResults(false);
    // Fetch image in background
    gamesApi.getGameDetail(hit.bgg_id)
      .then((r) => {
        const url = r.data.game.image_url;
        if (url) setImageMap((prev) => ({ ...prev, [hit.bgg_id]: url }));
      })
      .catch(() => {/* silently ignore — placeholder stays */});
  };

  const removeGame = (bggId: number) => {
    setSelected((prev) => prev.filter((s) => s.bgg_id !== bggId));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <LogoMark size={40} />
          <span className="font-serif text-[24px] font-bold tracking-tight" style={{ color: "var(--rd-cream)" }}>
            Table Knight
          </span>
        </div>

        {/* Heading + flavour text */}
        <div className="text-center mb-8">
          <h1
            className="font-serif font-bold text-[28px] leading-tight tracking-tight mb-3"
            style={{ color: "var(--rd-cream)" }}
          >
            Assemble Your Round Table
          </h1>
          <p className="text-[14px] leading-relaxed max-w-sm mx-auto" style={{ color: "var(--rd-text-2)" }}>
            Every knight needs their five. These are the games you'd ride into battle with — your most trusted companions at the table. Choose wisely.
          </p>
        </div>

        {/* Five poster slots */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => {
            const game = selected[i];
            return (
              <div key={i} className="flex flex-col gap-1">
                <div
                  className="relative w-full overflow-hidden rounded-lg"
                  style={{
                    paddingBottom: "133.333%",
                    background: "var(--rd-surface-hi)",
                    border: `1px solid ${game ? "var(--rd-plum)" : "var(--rd-border)"}`,
                    opacity: game ? 1 : 0.5,
                  }}
                >
                  {game ? (
                    <>
                      {imageMap[game.bgg_id] ? (
                        <img
                          src={imageMap[game.bgg_id]}
                          alt={game.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-[11px] font-bold animate-pulse"
                          style={{ background: "var(--rd-surface-hi)", color: "var(--rd-plum)" }}
                        >
                          {game.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <button
                        onClick={() => removeGame(game.bgg_id)}
                        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full z-10"
                        style={{ background: "rgba(0,0,0,.7)" }}
                      >
                        <IconX size={8} style={{ color: "#fff" }} />
                      </button>
                    </>
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-[18px] font-serif font-bold"
                      style={{ color: "var(--rd-border)" }}
                    >
                      {i + 1}
                    </div>
                  )}
                </div>
                {game && (
                  <p
                    className="text-[9px] leading-tight text-center line-clamp-2 font-medium px-0.5"
                    style={{ color: "var(--rd-text-2)" }}
                  >
                    {game.title}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Search */}
        {selected.length < 5 && (
          <div className="relative mb-6">
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
            >
              <IconSearch size={15} style={{ color: "var(--rd-meta)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                style={{ color: "var(--rd-cream)" }}
                placeholder="Search for a game…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
              />
              {searching && (
                <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>searching…</span>
              )}
            </div>

            {showResults && results.length > 0 && (
              <div
                className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden shadow-lg max-h-60 overflow-y-auto"
                style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
              >
                {results.slice(0, 10).map((hit) => (
                  <button
                    key={hit.bgg_id}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                    onClick={() => addGame(hit)}
                  >
                    <span className="text-[13px] font-medium line-clamp-1" style={{ color: "var(--rd-text)" }}>
                      {hit.title}
                    </span>
                    {hit.year_published > 0 && (
                      <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>
                        {hit.year_published}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {selected.map((g, i) => (
              <span
                key={g.bgg_id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium"
                style={{ background: "rgba(201,124,176,.18)", color: "var(--rd-plum)" }}
              >
                <span className="text-[10px] font-bold opacity-70">{i + 1}</span>
                <span className="max-w-[120px] truncate">{g.title}</span>
                <button onClick={() => removeGame(g.bgg_id)} className="opacity-60 hover:opacity-100">
                  <IconX size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={selected.length === 0 || saveMutation.isPending}
            className="w-full py-2.5 rounded-xl text-[14px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--rd-plum)", color: "var(--rd-cream)" }}
          >
            {saveMutation.isPending ? "Assembling…" : selected.length === 0 ? "Pick at least one game" : `Ride into battle with ${selected.length} game${selected.length > 1 ? "s" : ""}`}
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[12px] transition-colors hover:text-foreground"
            style={{ color: "var(--rd-meta)" }}
          >
            Skip for now — I'll build my table later
          </button>
        </div>

        {saveMutation.isError && (
          <p className="text-center text-[12px] mt-3" style={{ color: "var(--rd-loss)" }}>
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
