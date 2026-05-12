import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Plus, Copy, Check, Users, Library, ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input, Label, Card, CardContent, CardHeader, CardTitle, Avatar, AvatarFallback, AvatarImage, Badge, Separator } from "@/components/ui/primitives";
import { groupsApi, type Group } from "@/lib/api";

// ── Groups list page ──────────────────────────────────────────────────────────
export function GroupsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const qc = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.getMyGroups().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => groupsApi.createGroup({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setShowCreate(false);
      setCreateName("");
    },
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => groupsApi.joinGroup(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setShowJoin(false);
      setInviteCode("");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Groups</h1>
            <p className="text-sm text-muted-foreground mt-1">Your game night crews</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowJoin(!showJoin)}>
              Join group
            </Button>
            <Button onClick={() => setShowCreate(!showCreate)}>
              <Plus className="mr-2 h-4 w-4" />
              Create group
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">New group</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Friday night crew..."
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createMutation.mutate(createName)}
                />
                <Button
                  onClick={() => createMutation.mutate(createName)}
                  disabled={createMutation.isPending || !createName.trim()}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join form */}
        {showJoin && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Join with invite code</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 8-character code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toLowerCase())}
                  maxLength={8}
                />
                <Button
                  onClick={() => joinMutation.mutate(inviteCode)}
                  disabled={joinMutation.isPending || inviteCode.length < 6}
                >
                  Join
                </Button>
              </div>
              {joinMutation.isError && (
                <p className="text-sm text-destructive">Invalid invite code</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Groups list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : groups?.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-3 text-4xl">👥</span>
            <p className="font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create one or join with an invite code</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups?.map((group) => <GroupRow key={group.id} group={group} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function GroupRow({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false);

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link to={`/groups/${group.id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl shrink-0">
            🎲
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{group.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {new Date(group.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{group.invite_code}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={copyCode}
              title="Copy invite code"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Group detail page ─────────────────────────────────────────────────────────
export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"members" | "collection" | "sessions">("members");

  const { data, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.getGroup(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: collection } = useQuery({
    queryKey: ["group-collection", id],
    queryFn: () => groupsApi.getGroupCollection(id!).then((r) => r.data),
    enabled: !!id && activeTab === "collection",
  });

  const { data: sessions } = useQuery({
    queryKey: ["group-sessions", id],
    queryFn: () => groupsApi.getGroupSessions(id!).then((r) => r.data),
    enabled: !!id && activeTab === "sessions",
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  const { group, members } = data ?? {};

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back + header */}
        <div>
          <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            All groups
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{group?.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Invite code:</span>
              <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{group?.invite_code}</code>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["members", "collection", "sessions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {activeTab === "members" && (
          <div className="space-y-2">
            {members?.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  {member.role === "admin" && (
                    <Badge variant="secondary" className="text-xs">Admin</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Collection tab */}
        {activeTab === "collection" && (
          <div>
            {!collection ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : collection.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <span className="mb-3 text-4xl">📦</span>
                <p className="font-medium">No games in group collection</p>
                <p className="text-sm text-muted-foreground">Members haven't added any owned games yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {collection.map((game) => (
                  <Card key={game.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted">
                      {game.image_url ? (
                        <img src={game.image_url} alt={game.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🎲</div>
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium line-clamp-2">{game.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{sessions?.length ?? 0} sessions logged</p>
              <Link to={`/sessions/log?group=${id}`}>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Log session
                </Button>
              </Link>
            </div>
            {sessions?.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <span className="mb-3 text-4xl">🎮</span>
                <p className="font-medium">No sessions yet</p>
                <p className="text-sm text-muted-foreground">Log your first game night</p>
              </div>
            ) : (
              sessions?.map((session) => (
                <Card key={session.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {session.game_image ? (
                        <img src={session.game_image} alt={session.game_title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xl">🎲</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{session.game_title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(session.played_at).toLocaleDateString()}
                        {session.duration_mins && ` · ${session.duration_mins} min`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
