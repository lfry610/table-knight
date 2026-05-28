import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/primitives";
import { IconPlus, IconSearch, IconNotebook, IconX } from "@/components/ui/icons";
import { listsApi, gamesApi, type GameList, type ListGame, type BGGSearchHit } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

// ── List index ────────────────────────────────────────────────────────────────

function ListCard({ list, onClick }: { list: GameList; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-colors hover:brightness-110"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-serif font-semibold text-[16px] leading-tight" style={{ color: "var(--rd-cream)" }}>
          {list.title}
        </p>
        <span className="shrink-0 text-[11px] mt-0.5" style={{ color: "var(--rd-meta)" }}>
          {list.game_count} {list.game_count === 1 ? "game" : "games"}
        </span>
      </div>
      {list.description && (
        <p className="text-[12px] line-clamp-2" style={{ color: "var(--rd-text-2)" }}>
          {list.description}
        </p>
      )}
    </button>
  );
}

function NewListForm({ onDone }: { onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const create = useMutation({
    mutationFn: () => listsApi.createList({ title: title.trim(), description: desc.trim() || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-lists"] });
      setCreatedId(res.data.id);
    },
  });

  const { data: listData } = useQuery({
    queryKey: ["list", createdId],
    queryFn: () => listsApi.getList(createdId!).then((r) => r.data),
    enabled: !!createdId,
  });

  const games = listData?.games ?? [];
  const existingBggIds = new Set(games.map((g) => g.bgg_id));

  if (createdId) {
    return (
      <div
        className="rounded-xl p-4 space-y-4 mb-6"
        style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
      >
        <div>
          <p className="font-serif font-semibold text-[15px]" style={{ color: "var(--rd-cream)" }}>{title}</p>
          <p className="text-[12px]" style={{ color: "var(--rd-meta)" }}>
            {games.length} {games.length === 1 ? "game" : "games"} — add more below
          </p>
        </div>

        <AddGameSearch listId={createdId} existingIds={existingBggIds} />

        {games.length > 0 && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}
          >
            {games.map((game, i) => (
              <div key={game.id} className="flex flex-col gap-1">
                <div
                  className="relative w-full overflow-hidden rounded-lg transition-shadow duration-200 hover:shadow-[0_0_0_2px_#c97cb0,0_0_12px_rgba(201,124,176,0.3)]"
                  style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
                >
                  <div className="absolute inset-0">
                    {game.image_url ? (
                      <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-[11px] font-bold" style={{ color: "var(--rd-text-2)" }}>
                        {game.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-0.5 px-0.5">
                  <span className="shrink-0 font-serif font-bold text-[10px] mt-px" style={{ color: "var(--rd-plum)" }}>{i + 1}</span>
                  <p className="text-[9px] leading-tight line-clamp-2 font-medium" style={{ color: "var(--rd-text-2)" }}>{game.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => onDone(createdId)}
            className="inline-flex h-8 px-4 items-center rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
          >
            {games.length === 0 ? "View list →" : `Done — view list (${games.length})`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3 mb-6"
      style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
    >
      <p className="text-[13px] font-semibold" style={{ color: "var(--rd-text)" }}>New list</p>
      <Input
        ref={inputRef}
        placeholder="List title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && title.trim() && create.mutate()}
      />
      <Input
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      {create.isError && (
        <p className="text-[12px]" style={{ color: "var(--rd-loss)" }}>Something went wrong. Please try again.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={!title.trim() || create.isPending}
          className="inline-flex h-8 px-4 items-center rounded-lg text-[13px] font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
        >
          {create.isPending ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

export function ListsPage() {
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);

  const { data: lists, isLoading } = useQuery({
    queryKey: ["my-lists"],
    queryFn: () => listsApi.getMyLists().then((r) => r.data),
  });

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="font-serif font-bold text-[26px] leading-tight tracking-tight"
            style={{ color: "var(--rd-cream)" }}
          >
            Lists
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
            {lists?.length ?? 0} {lists?.length === 1 ? "list" : "lists"}
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
        >
          <IconPlus size={13} />
          New list
        </button>
      </div>

      {showNew && (
        <NewListForm
          onDone={(id) => {
            setShowNew(false);
            navigate(`/lists/${id}`);
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--rd-surface)" }} />
          ))}
        </div>
      ) : lists?.length === 0 ? (
        <div
          className="flex flex-col items-center py-20 text-center rounded-xl border border-dashed"
          style={{ borderColor: "var(--rd-border)" }}
        >
          <IconNotebook size={36} style={{ color: "var(--rd-text-2)", marginBottom: 12 }} />
          <p className="font-serif font-semibold text-[16px] mb-1" style={{ color: "var(--rd-text)" }}>
            No lists yet
          </p>
          <p className="text-[12px] mb-5" style={{ color: "var(--rd-text-2)" }}>
            Create your first list — top 10s, to-plays, hidden gems…
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
          >
            <IconPlus size={13} />
            New list
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lists!.map((l) => (
            <ListCard key={l.id} list={l} onClick={() => navigate(`/lists/${l.id}`)} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

// ── List detail ───────────────────────────────────────────────────────────────

function GamePosterCard({
  game,
  index,
  isOwner,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
}: {
  game: ListGame;
  index: number;
  isOwner: boolean;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  isDragTarget: boolean;
}) {
  return (
    <div
      draggable={isOwner}
      onDragStart={isOwner ? () => onDragStart(index) : undefined}
      onDragOver={isOwner ? (e) => { e.preventDefault(); onDragOver(index); } : undefined}
      onDrop={isOwner ? (e) => { e.preventDefault(); onDrop(index); } : undefined}
      className={`flex flex-col gap-1 select-none ${isOwner ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ opacity: isDragTarget ? 0.5 : 1, transition: "opacity 0.15s" }}
    >
      <div className="relative group">
        <div
          className="relative w-full overflow-hidden rounded-lg transition-shadow duration-200 hover:shadow-[0_0_0_2px_#c97cb0,0_0_12px_rgba(201,124,176,0.3)]"
          style={{ paddingBottom: "133.333%", background: "var(--rd-surface-hi)", border: "1px solid var(--rd-border)" }}
        >
          <div className="absolute inset-0">
            {game.image_url ? (
              <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full flex items-center justify-center text-[13px] font-bold"
                style={{ color: "var(--rd-text-2)" }}
              >
                {game.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button
                onClick={() => onRemove(game.id)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: "rgba(0,0,0,.75)" }}
              >
                <IconX size={9} style={{ color: "#fff" }} />
              </button>
              <div
                className="absolute bottom-0 left-0 right-0 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,.4)", fontSize: 9, color: "#fff", letterSpacing: "0.05em" }}
              >
                drag to reorder
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-start gap-1 px-0.5">
        <span
          className="shrink-0 font-serif font-bold text-[11px] mt-px"
          style={{ color: "var(--rd-plum)" }}
        >
          {index + 1}
        </span>
        <p className="text-[10px] leading-tight line-clamp-2 font-medium" style={{ color: "var(--rd-text-2)" }}>
          {game.title}
        </p>
      </div>
    </div>
  );
}

function AddGameSearch({ listId, existingIds }: { listId: string; existingIds: Set<number> }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BGGSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await gamesApi.search(query.trim());
        setResults(res.data.filter((h) => !existingIds.has(h.bgg_id)).slice(0, 10));
        setShowResults(true);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [query, existingIds]);

  const add = useMutation({
    mutationFn: (bggId: number) => listsApi.addGame(listId, bggId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list", listId] });
      qc.invalidateQueries({ queryKey: ["my-lists"] });
      setQuery("");
      setResults([]);
      setShowResults(false);
    },
  });

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
      >
        <IconSearch size={14} style={{ color: "var(--rd-meta)", flexShrink: 0 }} />
        <input
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          style={{ color: "var(--rd-cream)" }}
          placeholder="Search to add a game…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {(isSearching || add.isPending) && (
          <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>
            {add.isPending ? "adding…" : "searching…"}
          </span>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div
          className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden shadow-lg max-h-60 overflow-y-auto"
          style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-border)" }}
        >
          {results.map((hit) => (
            <button
              key={hit.bgg_id}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent"
              onMouseDown={() => add.mutate(hit.bgg_id)}
              disabled={add.isPending}
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
  );
}

export function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [localGames, setLocalGames] = useState<ListGame[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["list", id],
    queryFn: () => listsApi.getList(id!).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.games) setLocalGames(data.games);
  }, [data?.games]);

  const updateList = useMutation({
    mutationFn: (updates: { title?: string; description?: string }) =>
      listsApi.updateList(id!, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list", id] });
      qc.invalidateQueries({ queryKey: ["my-lists"] });
      setEditingTitle(false);
    },
  });

  const deleteList = useMutation({
    mutationFn: () => listsApi.deleteList(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-lists"] });
      navigate("/lists");
    },
  });

  const removeGame = useMutation({
    mutationFn: (gameId: string) => listsApi.removeGame(id!, gameId),
    onSuccess: (res) => {
      setLocalGames(res.data);
      qc.invalidateQueries({ queryKey: ["list", id] });
      qc.invalidateQueries({ queryKey: ["my-lists"] });
    },
  });

  const reorder = useMutation({
    mutationFn: (games: ListGame[]) =>
      listsApi.reorderGames(id!, games.map((g) => g.id)),
    onSuccess: (res) => {
      setLocalGames(res.data);
      qc.invalidateQueries({ queryKey: ["list", id] });
    },
  });

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (index: number) => {
    setDragTarget(index);
  };

  const handleDrop = (targetIndex: number) => {
    const fromIndex = dragIndexRef.current;
    setDragTarget(null);
    dragIndexRef.current = null;
    if (fromIndex === null || fromIndex === targetIndex) return;
    const reordered = [...localGames];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, item);
    setLocalGames(reordered);
    reorder.mutate(reordered);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-48 rounded animate-pulse" style={{ background: "var(--rd-surface)" }} />
          <div className="h-4 w-24 rounded animate-pulse" style={{ background: "var(--rd-surface)" }} />
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  const { list } = data;
  const isOwner = list.user_id === currentUser?.id;
  const existingBggIds = new Set(localGames.map((g) => g.bgg_id));

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/lists")}
          className="text-[12px] mb-3 transition-colors hover:text-foreground"
          style={{ color: "var(--rd-text-2)" }}
        >
          ← All lists
        </button>

        {isOwner && editingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              className="text-[22px] font-serif font-bold"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && titleDraft.trim()) updateList.mutate({ title: titleDraft.trim() });
                if (e.key === "Escape") setEditingTitle(false);
              }}
              autoFocus
            />
            <button
              onClick={() => titleDraft.trim() && updateList.mutate({ title: titleDraft.trim() })}
              disabled={!titleDraft.trim()}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
            >
              Save
            </button>
            <button
              onClick={() => setEditingTitle(false)}
              className="text-[12px] px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              {isOwner ? (
                <button
                  onClick={() => { setTitleDraft(list.title); setEditingTitle(true); }}
                  className="font-serif font-bold text-[26px] leading-tight tracking-tight text-left hover:opacity-80 transition-opacity"
                  style={{ color: "var(--rd-cream)" }}
                >
                  {list.title}
                </button>
              ) : (
                <h1 className="font-serif font-bold text-[26px] leading-tight tracking-tight" style={{ color: "var(--rd-cream)" }}>
                  {list.title}
                </h1>
              )}
              {list.description && (
                <p className="text-[13px] mt-1" style={{ color: "var(--rd-text-2)" }}>
                  {list.description}
                </p>
              )}
              <p className="text-[12px] mt-1" style={{ color: "var(--rd-meta)" }}>
                {localGames.length} {localGames.length === 1 ? "game" : "games"}
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => deleteList.mutate()}
                disabled={deleteList.isPending}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-accent disabled:opacity-50 shrink-0"
                style={{ borderColor: "var(--rd-border)", color: "var(--rd-loss)" }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search — owner only */}
      {isOwner && (
        <div className="mb-6">
          <AddGameSearch listId={id!} existingIds={existingBggIds} />
        </div>
      )}

      {/* Poster grid */}
      {localGames.length === 0 ? (
        <div
          className="flex flex-col items-center py-16 text-center rounded-xl border border-dashed"
          style={{ borderColor: "var(--rd-border)" }}
        >
          <p className="font-medium text-sm mb-1" style={{ color: "var(--rd-text-2)" }}>
            No games yet
          </p>
          <p className="text-[12px]" style={{ color: "var(--rd-meta)" }}>
            {isOwner ? "Search above to add your first game" : "This list is empty"}
          </p>
        </div>
      ) : (
        <>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}
            onDragEnd={() => { setDragTarget(null); dragIndexRef.current = null; }}
          >
            {localGames.map((game, i) => (
              <GamePosterCard
                key={game.id}
                game={game}
                index={i}
                isOwner={isOwner}
                onRemove={(gid) => removeGame.mutate(gid)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragTarget={dragTarget === i}
              />
            ))}
          </div>
          {reorder.isError && (
            <p className="text-center text-[12px] mt-3" style={{ color: "var(--rd-loss)" }}>
              Failed to save order. Please try again.
            </p>
          )}
        </>
      )}
    </AppLayout>
  );
}
