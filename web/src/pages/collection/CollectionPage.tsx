import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Star, Clock, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input, Card, CardContent, Badge } from "@/components/ui/primitives";
import { gamesApi, type CollectionGame, type BGGSearchHit, type GameStatus } from "@/lib/api";

const STATUS_LABELS: Record<GameStatus, string> = {
  owned: "Owned",
  want_to_play: "Want to play",
  for_trade: "For trade",
  wishlist: "Wishlist",
};

const STATUS_COLORS: Record<GameStatus, "default" | "secondary" | "destructive" | "outline"> = {
  owned: "default",
  want_to_play: "secondary",
  for_trade: "destructive",
  wishlist: "outline",
};

export function CollectionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [bggResults, setBggResults] = useState<BGGSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filterStatus, setFilterStatus] = useState<GameStatus | "all">("all");
  const [searchError, setSearchError] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: collection, isLoading } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

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

  const handleBGGSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await gamesApi.search(searchQuery);
      setBggResults(res.data.slice(0, 10));
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const filteredCollection = collection?.filter((g) =>
    filterStatus === "all" ? true : g.status === filterStatus
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Collection</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {collection?.length ?? 0} games
            </p>
          </div>
          <Button onClick={() => setShowSearch(!showSearch)}>
            <Plus className="mr-2 h-4 w-4" />
            Add game
          </Button>
        </div>

        {/* BGG Search */}
        {showSearch && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Search BoardGameGeek</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Wingspan, Catan, Gloomhaven..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBGGSearch()}
                />
                <Button onClick={handleBGGSearch} disabled={isSearching} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchError && (
                <p className="text-sm text-destructive">{searchError}</p>
              )}

              {bggResults.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {bggResults.map((hit) => (
                    <div
                      key={hit.bgg_id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{hit.title}</p>
                        {hit.year_published > 0 && (
                          <p className="text-xs text-muted-foreground">{hit.year_published}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addMutation.isPending}
                        onClick={() => addMutation.mutate({ bgg_id: hit.bgg_id, status: "owned" })}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "owned", "want_to_play", "for_trade", "wishlist"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Collection grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredCollection?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-3 text-4xl">📦</span>
            <p className="font-medium">No games here yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterStatus === "all" ? "Add your first game above" : `No games with status "${STATUS_LABELS[filterStatus]}"`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCollection?.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function GameCard({ game }: { game: CollectionGame }) {
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (rating: number) =>
      gamesApi.updateCollectionEntry(game.id, { user_rating: rating }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
  });

  return (
    <Card className="overflow-hidden">
      {/* Game image */}
      <div className="relative aspect-square bg-muted">
        {game.image_url ? (
          <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🎲</div>
        )}
        <div className="absolute top-2 right-2">
          <Badge variant={STATUS_COLORS[game.status]} className="text-xs">
            {STATUS_LABELS[game.status]}
          </Badge>
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="font-medium text-sm leading-tight line-clamp-2">{game.title}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {game.min_players}–{game.max_players}
          </span>
          {game.playtime_mins && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {game.playtime_mins}m
            </span>
          )}
        </div>

        {/* Star rating */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => updateMutation.mutate(star)}
              className="transition-colors"
              title={`Rate ${star}`}
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  star <= (game.user_rating ?? 0)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
