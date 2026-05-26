import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ArrowLeft, Trophy } from "lucide-react";
import { IconPencil, IconTrash } from "@/components/ui/icons";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input, Label, Card, CardContent, CardHeader, CardTitle, Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { gamesApi, groupsApi, sessionsApi, socialApi, type BGGSearchHit, type Session, type SessionResult } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type PlayerBase = { id: string; display_name: string; avatar_url: string | null };
type PlayerEntry = PlayerBase & { result: SessionResult; score: string };

const DURATION_PRESETS = [30, 60, 90, 120, 150, 180, 210, 240];

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const RESULTS: { value: SessionResult; label: string; emoji: string }[] = [
  { value: "win",  label: "Win",  emoji: "🏆" },
  { value: "loss", label: "Loss", emoji: "😔" },
  { value: "draw", label: "Draw", emoji: "🤝" },
  { value: "dnf",  label: "DNF",  emoji: "🚪" },
];

export function LogSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(searchParams.get("group"));

  const [step, setStep] = useState<"game" | "players" | "results">("game");
  const [searchQuery, setSearchQuery] = useState("");
  const [bggResults, setBggResults] = useState<BGGSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<BGGSearchHit | null>(null);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [playedAt, setPlayedAt] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [debouncedPlayerSearch, setDebouncedPlayerSearch] = useState("");
  const playerSearchTimer = useRef<ReturnType<typeof setTimeout>>();
  const populatedGroupRef = useRef<string | null>(null);

  useEffect(() => {
    clearTimeout(playerSearchTimer.current);
    playerSearchTimer.current = setTimeout(() => setDebouncedPlayerSearch(playerSearch.trim()), 350);
    return () => clearTimeout(playerSearchTimer.current);
  }, [playerSearch]);

  const { data: groupDetail } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => groupsApi.getGroup(selectedGroupId!).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (!selectedGroupId || !groupDetail?.members) return;
    if (populatedGroupRef.current === selectedGroupId) return;
    populatedGroupRef.current = selectedGroupId;
    setPlayers((prev) => {
      const next = [...prev];
      groupDetail.members.forEach((m) => {
        if (!next.find((p) => p.id === m.id)) {
          next.push({ id: m.id, display_name: m.display_name, avatar_url: m.avatar_url, result: "loss", score: "" });
        }
      });
      return next;
    });
  }, [selectedGroupId, groupDetail]);

  const { data: myGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.getMyGroups().then((r) => r.data),
  });

  const { data: myCollection } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

  const { data: following } = useQuery({
    queryKey: ["following"],
    queryFn: () => socialApi.getFollowing().then((r) => r.data),
  });

  const { data: playerSearchResults } = useQuery({
    queryKey: ["user-search", debouncedPlayerSearch],
    queryFn: () => socialApi.searchUsers(debouncedPlayerSearch).then((r) => r.data),
    enabled: debouncedPlayerSearch.length >= 2,
  });

  const logMutation = useMutation({
    mutationFn: () =>
      sessionsApi.create({
        bgg_id: selectedGame!.bgg_id,
        group_id: selectedGroupId ?? undefined,
        played_at: new Date(playedAt + "T12:00:00").toISOString(),
        duration_mins: durationMins ? parseInt(durationMins) : undefined,
        notes: notes || undefined,
        players: players.map((p) => ({
          user_id: p.id,
          result: p.result,
          score: p.score ? parseInt(p.score) : undefined,
        })),
      }),
    onSuccess: () => {
      navigate("/sessions");
    },
  });

  const handleBGGSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await gamesApi.search(searchQuery);
      setBggResults(res.data.slice(0, 8));
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectGame = (game: BGGSearchHit) => {
    setSelectedGame(game);
    setStep("players");
    const initial: PlayerEntry[] = [];
    if (currentUser) {
      initial.push({ id: currentUser.id, display_name: currentUser.display_name, avatar_url: currentUser.avatar_url, result: "loss", score: "" });
    }
    if (selectedGroupId && groupDetail?.members) {
      groupDetail.members.forEach((m) => {
        if (!initial.find((p) => p.id === m.id)) {
          initial.push({ id: m.id, display_name: m.display_name, avatar_url: m.avatar_url, result: "loss", score: "" });
        }
      });
    }
    setPlayers(initial);
  };

  const togglePlayer = (person: PlayerBase) => {
    setPlayers((prev) => {
      const exists = prev.find((p) => p.id === person.id);
      if (exists) return prev.filter((p) => p.id !== person.id);
      return [...prev, { ...person, result: "loss", score: "" }];
    });
  };

  const updatePlayerResult = (userId: string, result: SessionResult) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, result } : p))
    );
  };

  const updatePlayerScore = (userId: string, score: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, score } : p))
    );
  };


  return (
    <AppLayout>
      <div className="max-w-lg space-y-6">
        {/* Header */}
        <div>
          <Link
            to={selectedGroupId ? `/groups/${selectedGroupId}` : "/sessions"}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold">Log a session</h1>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2">
          {(["game", "players", "results"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                step === s ? "bg-primary text-primary-foreground" :
                (["game", "players", "results"].indexOf(step) > i) ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm capitalize ${step === s ? "font-medium" : "text-muted-foreground"}`}>
                {s}
              </span>
              {i < 2 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Game */}
        {step === "game" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What did you play?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick pick from collection */}
              {myCollection && myCollection.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">FROM YOUR COLLECTION</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {myCollection.filter(g => g.status === "owned").slice(0, 8).map((game) => (
                      <button
                        key={game.id}
                        onClick={() => selectGame({ bgg_id: game.bgg_id, title: game.title, year_published: 0 })}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent text-left"
                      >
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                          {game.image_url
                            ? <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-sm">🎲</div>
                          }
                        </div>
                        <span className="text-sm font-medium">{game.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or search BGG</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Search any game..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBGGSearch()}
                />
                <Button onClick={handleBGGSearch} disabled={isSearching} size="icon" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchError && (
                <p className="text-sm text-destructive">{searchError}</p>
              )}

              {bggResults.length > 0 && (
                <div className="space-y-1">
                  {bggResults.map((hit) => (
                    <button
                      key={hit.bgg_id}
                      onClick={() => selectGame(hit)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-accent text-left"
                    >
                      <div>
                        <p className="text-sm font-medium">{hit.title}</p>
                        {hit.year_published > 0 && (
                          <p className="text-xs text-muted-foreground">{hit.year_published}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Players */}
        {step === "players" && selectedGame && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Who played <span className="text-primary">{selectedGame.title}</span>?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Crew selector */}
              {myGroups && myGroups.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Log with crew (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {myGroups.map((g) => {
                      const active = selectedGroupId === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            if (active) {
                              setSelectedGroupId(null);
                              populatedGroupRef.current = null;
                            } else {
                              populatedGroupRef.current = null;
                              setSelectedGroupId(g.id);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors border"
                          style={
                            active
                              ? { background: "var(--rd-plum)", color: "var(--rd-bg)", borderColor: "var(--rd-plum)" }
                              : { borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }
                          }
                        >
                          {g.name}
                          {active && <span className="text-[10px] opacity-80">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected players */}
              {players.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p)}
                      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[12px] font-medium transition-colors hover:opacity-80"
                      style={{ background: "rgba(201,124,176,.18)", color: "var(--rd-plum)" }}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[8px]">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {p.display_name}
                      <span className="text-[10px] opacity-60">×</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--rd-meta)" }} />
                <Input
                  placeholder="Search players…"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Player list */}
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {debouncedPlayerSearch.length >= 2 ? (
                  playerSearchResults?.length === 0 ? (
                    <p className="py-2 text-center text-[12px]" style={{ color: "var(--rd-meta)" }}>No users found</p>
                  ) : (
                    playerSearchResults?.map((u) => {
                      const selected = players.some((p) => p.id === u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => { togglePlayer(u); setPlayerSearch(""); }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors ${selected ? "bg-primary/10" : "hover:bg-accent"}`}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={u.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-left text-[13px] font-medium">{u.display_name}</span>
                          {selected && <span className="text-[11px]" style={{ color: "var(--rd-plum)" }}>✓</span>}
                        </button>
                      );
                    })
                  )
                ) : (following?.length ?? 0) > 0 ? (
                  following!.map((u) => {
                    const selected = players.some((p) => p.id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => togglePlayer(u)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors ${selected ? "bg-primary/10" : "hover:bg-accent"}`}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-left text-[13px] font-medium">{u.display_name}</span>
                        {selected && <span className="text-[11px]" style={{ color: "var(--rd-plum)" }}>✓</span>}
                      </button>
                    );
                  })
                ) : (
                  <p className="py-2 text-center text-[12px]" style={{ color: "var(--rd-meta)" }}>
                    Follow people to add them here, or search by name
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-xs">Date played</Label>
                <Input
                  type="date"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                  max={new Date().toLocaleDateString("en-CA")}
                  className="h-9 text-sm"
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-xs">Duration</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDurationMins(durationMins === String(mins) ? "" : String(mins))}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors border"
                      style={
                        durationMins === String(mins)
                          ? { background: "var(--rd-plum)", color: "var(--rd-bg)", borderColor: "var(--rd-plum)" }
                          : { borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }
                      }
                    >
                      {formatDuration(mins)}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="or type minutes…"
                  value={DURATION_PRESETS.includes(Number(durationMins)) ? "" : durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  placeholder="Epic comeback on the last round..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                disabled={players.length === 0}
                onClick={() => setStep("results")}
              >
                Next: Set results
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Results */}
        {step === "results" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How did everyone do?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.map((player) => (
                <div key={player.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={player.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {player.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{player.display_name}</span>
                  </div>
                  <div className="flex gap-2">
                    {RESULTS.map(({ value, label, emoji }) => (
                      <button
                        key={value}
                        onClick={() => updatePlayerResult(player.id, value)}
                        className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                          player.result === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="Score (optional)"
                    value={player.score}
                    onChange={(e) => updatePlayerScore(player.id, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("players")}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={logMutation.isPending}
                  onClick={() => logMutation.mutate()}
                >
                  {logMutation.isPending ? "Saving..." : "Log session"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// ── Sessions list page ────────────────────────────────────────────────────────
export function SessionsPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.getMySessions().then((r) => r.data),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sessions ? `${sessions.length} sessions logged` : "Your play history"}
            </p>
          </div>
          <Link to="/sessions/log">
            <Button>
              <Trophy className="mr-2 h-4 w-4" />
              Log session
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : sessions?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-3 text-4xl">🎮</span>
            <p className="font-medium">No sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Log your first session to start tracking wins and losses
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions?.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const RESULT_META: Record<SessionResult, { label: string; color: string }> = {
  win:  { label: "Win",  color: "var(--rd-win)"   },
  loss: { label: "Loss", color: "var(--rd-loss)"  },
  draw: { label: "Draw", color: "var(--rd-brass)" },
  dnf:  { label: "DNF",  color: "var(--rd-meta)"  },
};

type EditedPlayer = { id: string; display_name: string; avatar_url: string | null; result: SessionResult; score: string };

export function SessionRow({
  session,
  editable = true,
  onSaveSuccess,
}: {
  session: Session;
  editable?: boolean;
  onSaveSuccess?: () => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editedPlayers, setEditedPlayers] = useState<EditedPlayer[]>([]);
  const [editDate, setEditDate] = useState("");

  const { data: players } = useQuery({
    queryKey: ["session-players", session.id],
    queryFn: () => sessionsApi.getPlayers(session.id).then((r) => r.data),
  });

  const myResult = players?.find((p) => p.id === currentUser?.id)?.result;
  const bgStyle =
    myResult === "win"
      ? { background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.2)" }
      : myResult === "loss"
      ? { background: "rgba(248,113,113,.07)", border: "1px solid rgba(248,113,113,.2)" }
      : { background: "var(--rd-surface)", border: "1px solid var(--rd-border)" };

  const deleteMutation = useMutation({
    mutationFn: () => sessionsApi.deleteSession(session.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onSaveSuccess?.();
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.all([
        sessionsApi.updatePlayers(session.id, editedPlayers.map((p) => ({
          user_id: p.id,
          result: p.result,
          score: p.score ? parseInt(p.score) : undefined,
        }))),
        sessionsApi.updateSession(session.id, {
          played_at: new Date(editDate + "T12:00:00").toISOString(),
        }),
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-players", session.id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setEditing(false);
      setConfirmDelete(false);
      onSaveSuccess?.();
    },
  });

  const enterEdit = () => {
    setEditedPlayers(
      (players ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        result: p.result,
        score: p.score != null ? String(p.score) : "",
      }))
    );
    setEditDate(new Date(session.played_at).toLocaleDateString("en-CA"));
    setConfirmDelete(false);
    setEditing(true);
  };

  const updateResult = (id: string, result: SessionResult) =>
    setEditedPlayers((prev) => prev.map((p) => p.id === id ? { ...p, result } : p));

  const updateScore = (id: string, score: string) =>
    setEditedPlayers((prev) => prev.map((p) => p.id === id ? { ...p, score } : p));

  const playedAt = new Date(session.played_at);
  const dateStr = playedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="rounded-xl p-4" style={bgStyle}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded" style={{ background: "var(--rd-surface-hi)" }}>
          {session.game_image
            ? <img src={session.game_image} alt={session.game_title} className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-lg">🎲</div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif font-semibold text-[14px] truncate" style={{ color: "var(--rd-cream)" }}>
            {session.game_title}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--rd-meta)" }}>
            {dateStr}{session.duration_mins != null && ` · ${session.duration_mins} min`}
          </p>
          {session.notes && (
            <p className="text-[11px] mt-1 italic line-clamp-1" style={{ color: "var(--rd-text-2)" }}>
              "{session.notes}"
            </p>
          )}
        </div>
        {/* Edit / action buttons */}
        {!editing ? (
          editable && <button
            onClick={enterEdit}
            className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-accent"
            style={{ color: "var(--rd-text-2)" }}
            title="Edit session"
          >
            <IconPencil size={13} />
          </button>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px]" style={{ color: "var(--rd-text-2)" }}>Delete session?</span>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--rd-loss)", color: "#fff" }}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] px-2 py-1 rounded-lg border transition-colors hover:bg-accent"
              style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg transition-colors hover:bg-accent"
              style={{ color: "var(--rd-loss)" }}
              title="Delete session"
            >
              <IconTrash size={13} />
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--rd-plum)", color: "var(--rd-bg)" }}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[11px] px-2.5 py-1 rounded-lg border transition-colors hover:bg-accent"
              style={{ borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Players — view mode */}
      {!editing && players && players.length > 0 && (
        <div className="rounded-lg px-3 py-1 divide-y" style={{ background: "var(--rd-surface-hi)", borderColor: "var(--rd-border)" }}>
          {players.map((p) => {
            const meta = RESULT_META[p.result];
            return (
              <div key={p.id} className="flex items-center gap-2 py-1">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Link to={`/users/${p.id}`} className="flex-1 text-[12px] font-medium hover:underline truncate" style={{ color: "var(--rd-text)" }}>
                  {p.display_name}
                </Link>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                {p.score != null && <span className="text-[11px] shrink-0" style={{ color: "var(--rd-meta)" }}>· {p.score}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Players — edit mode */}
      {editing && (
        <div className="rounded-lg px-3 py-2 space-y-3" style={{ background: "var(--rd-surface-hi)" }}>
          <div className="flex items-center gap-2">
            <label className="text-[11px] shrink-0" style={{ color: "var(--rd-text-2)" }}>Date played</label>
            <Input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              max={new Date().toLocaleDateString("en-CA")}
              className="h-7 text-[12px]"
            />
          </div>
        </div>
      )}
      {editing && editedPlayers.length > 0 && (
        <div className="rounded-lg px-3 py-2 space-y-3 mt-1.5" style={{ background: "var(--rd-surface-hi)" }}>
          {editedPlayers.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Link to={`/users/${p.id}`} className="text-[12px] font-medium hover:underline" style={{ color: "var(--rd-text)" }}>
                  {p.display_name}
                </Link>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["win", "loss", "draw", "dnf"] as SessionResult[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => updateResult(p.id, r)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors"
                    style={
                      p.result === r
                        ? { background: RESULT_META[r].color, color: "#fff", borderColor: RESULT_META[r].color }
                        : { borderColor: "var(--rd-border)", color: "var(--rd-text-2)" }
                    }
                  >
                    {RESULT_META[r].label}
                  </button>
                ))}
                <Input
                  type="number"
                  placeholder="Score"
                  value={p.score}
                  onChange={(e) => updateScore(p.id, e.target.value)}
                  className="h-7 w-20 text-[12px] ml-auto"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
