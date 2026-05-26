import { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/primitives";
import {
  LogoMark, IconNotebook, IconShelf, IconShield, IconCalendar, IconLogOut,
  IconUsers, IconList, IconPerson, IconQuill, IconMenu, IconX,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { to: "/dashboard",  label: "Diary",      icon: IconNotebook },
  { to: "/profile",    label: "Profile",    icon: IconPerson   },
  { to: "/feed",       label: "Feed",       icon: IconUsers    },
  { to: "/collection", label: "Collection", icon: IconShelf    },
  { to: "/lists",      label: "Lists",      icon: IconList     },
  { to: "/groups",     label: "Crews",      icon: IconShield   },
  { to: "/sessions",   label: "Sessions",   icon: IconCalendar },
  { to: "/reviews",    label: "Reviews",    icon: IconQuill    },
] as const;

function NavLinks({ userId, onNavigate }: { userId?: string; onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const resolvedTo = to === "/profile" ? `/users/${userId}` : to;
        const active = location.pathname === resolvedTo ||
          (to !== "/profile" && location.pathname.startsWith(to));
        return (
          <Link
            key={label}
            to={resolvedTo}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors border-l-2",
              active
                ? "border-l-plum text-foreground"
                : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            style={active ? { background: "rgba(201,124,176,.14)" } : undefined}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const handleLogout = () => { logout(); navigate("/login"); };

  const initials = user?.display_name
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  const userSection = (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={user?.avatar_url ?? undefined} />
          <AvatarFallback
            className="text-[10px] font-semibold"
            style={{ background: "var(--rd-plum-deep)", color: "var(--rd-cream)" }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[12px] font-medium">{user?.display_name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          title="Log out"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          <IconLogOut size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">

      {/* ── Desktop sidebar ───────────────────────────────── */}
      <aside
        className="hidden md:flex w-56 flex-col border-r border-border shrink-0"
        style={{ background: "rgba(0,0,0,.22)" }}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <LogoMark size={26} />
          <span className="font-serif text-[17px] font-bold tracking-tight" style={{ color: "var(--rd-cream)" }}>
            Table Knight
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-1">
          <NavLinks userId={user?.id} />
        </nav>
        {userSection}
      </aside>

      {/* ── Mobile drawer backdrop ────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,.5)" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile slide-in drawer ────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--rd-bg)" }}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-serif text-[15px] font-bold tracking-tight" style={{ color: "var(--rd-cream)" }}>
              Table Knight
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          <NavLinks userId={user?.id} onNavigate={() => setDrawerOpen(false)} />
        </nav>
        {userSection}
      </aside>

      {/* ── Main column ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="flex md:hidden h-14 shrink-0 items-center justify-between border-b border-border px-4"
          style={{ background: "rgba(0,0,0,.22)" }}
        >
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-serif text-[15px] font-bold tracking-tight" style={{ color: "var(--rd-cream)" }}>
              Table Knight
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconMenu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <LogoMark size={36} />
          <span
            className="font-serif text-[22px] font-bold"
            style={{ color: "var(--rd-cream)" }}
          >
            Table Knight
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
