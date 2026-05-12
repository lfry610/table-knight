import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, ArrowLeft, Trophy, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input, Label, Card, CardContent, CardHeader, CardTitle, Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import { gamesApi, groupsApi, sessionsApi, type BGGSearchHit, type SessionResult, type GroupMember } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type PlayerEntry = GroupMember & { result: SessionResult; score: string };

const RESULTS: { value: SessionResult; label: string; emoji: string }[] = [
  { value: "win",  label: "Win",  emoji: "🏆" },
  { value: "loss", label: "Loss", emoji: "😔" },
  { value: "draw", label: "Draw", emoji: "🤝" },
  { value: "dnf",  label: "DNF",  emoji: "🚪" },
];

export function LogSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get("group");
  const currentUser = useAuthStore((s) => s.user);

  const [step, setStep] = useState<"game" | "players" | "results">("game");
  const [searchQuery, setSearchQuery] = useState("");
  const [bggResults, setBggResults] = useState<BGGSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<BGGSearchHit | null>(null);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data: groupDetail } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => groupsApi.getGroup(groupId!).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: myCollection } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

  const logMutation = useMutation({
    mutationFn: () =>
      sessionsApi.create({
        bgg_id: selectedGame!.bgg_id,
        group_id: groupId ?? undefined,
        duration_mins: durationMins ? parseInt(durationMins) : undefined,
        notes: notes || undefined,
        players: players.map((p) => ({
          user_id: p.id,
          result: p.result,
          score: p.score ? parseInt(p.score) : undefined,
        })),
      }),
    onSuccess: () => {
      navigate(groupId ? `/groups/${groupId}` : "/sessions");
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

    // Pre-populate with group members if in a group context
    if (groupDetail?.members && currentUser) {
      const initialPlayers = groupDetail.members.map((m) => ({
        ...m,
        result: "loss" as SessionResult,
        score: "",
      }));
      setPlayers(initialPlayers);
    }
  };

  const togglePlayer = (member: GroupMember) => {
    setPlayers((prev) => {
      const exists = prev.find((p) => p.id === member.id);
      if (exists) return prev.filter((p) => p.id !== member.id);
      return [...prev, { ...member, result: "loss", score: "" }];
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

  const allMembers = groupDetail?.members ?? (currentUser ? [{
    id: currentUser.id,
    display_name: currentUser.display_name,
    avatar_url: currentUser.avatar_url,
    role: "admin" as const,
    joined_at: currentUser.created_at,
  }] : []);

  return (
    <AppLayout>
      <div className="max-w-lg space-y-6">
        {/* Header */}
        <div>
          <Link
            to={groupId ? `/groups/${groupId}` : "/sessions"}
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
            <CardContent className="space-y-2">
              {allMembers.map((member) => {
                const isSelected = players.some((p) => p.id === member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => togglePlayer(member)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {member.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.display_name}</span>
                    {isSelected && (
                      <div className="ml-auto h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                );
              })}

              <div className="pt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Duration (mins)</Label>
                    <Input
                      type="number"
                      placeholder="90"
                      value={durationMins}
                      onChange={(e) => setDurationMins(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    placeholder="Epic comeback on the last round..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full mt-2"
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
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">Your play history</p>
          </div>
          <Link to="/sessions/log">
            <Button>
              <Trophy className="mr-2 h-4 w-4" />
              Log session
            </Button>
          </Link>
        </div>
        <div className="flex flex-col items-center py-16 text-center">
          <span className="mb-3 text-4xl">🎮</span>
          <p className="font-medium">No sessions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Log your first session to start tracking wins and losses
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
