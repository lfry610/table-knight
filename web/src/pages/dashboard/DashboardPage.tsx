import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Library, Users, CalendarDays, Plus } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { gamesApi, groupsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: collection } = useQuery({
    queryKey: ["collection"],
    queryFn: () => gamesApi.getMyCollection().then((r) => r.data),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.getMyGroups().then((r) => r.data),
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            {greeting()}, {user?.display_name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Here's what's going on with your game nights.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Library}
            label="Games in collection"
            value={collection?.length ?? 0}
            href="/collection"
          />
          <StatCard
            icon={Users}
            label="Groups"
            value={groups?.length ?? 0}
            href="/groups"
          />
          <StatCard
            icon={CalendarDays}
            label="Sessions logged"
            value={0}
            href="/sessions"
          />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              to="/collection?add=true"
              icon={Library}
              title="Add a game"
              description="Search BGG and add to your collection"
            />
            <QuickAction
              to="/groups?create=true"
              icon={Users}
              title="Create a group"
              description="Start a new crew for game nights"
            />
            <QuickAction
              to="/sessions/log"
              icon={CalendarDays}
              title="Log a session"
              description="Record who played and who won"
            />
          </div>
        </div>

        {/* Your groups */}
        {groups && groups.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your groups</h2>
              <Link to="/groups">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.slice(0, 4).map((group) => (
                <Link key={group.id} to={`/groups/${group.id}`}>
                  <Card className="cursor-pointer transition-colors hover:bg-accent/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                        🎲
                      </div>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Code: {group.invite_code}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for new users */}
        {groups?.length === 0 && collection?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <span className="mb-4 text-5xl">🎲</span>
              <h3 className="mb-2 font-semibold">Welcome to Table Night!</h3>
              <p className="mb-6 text-sm text-muted-foreground max-w-sm">
                Start by adding games to your collection and creating a group with your friends.
              </p>
              <div className="flex gap-3">
                <Link to="/collection?add=true">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add a game
                  </Button>
                </Link>
                <Link to="/groups?create=true">
                  <Button variant="outline" size="sm">Create a group</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, href }: {
  icon: React.ElementType;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({ to, icon: Icon, title, description }: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link to={to}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
