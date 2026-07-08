import * as React from "react"
import { useLocation } from "wouter"
import { useGetMe, useLogout } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { LayoutDashboard, Database, Users, Server, BookOpen, LogOut, Loader2, Home, Menu, X, BrainCircuit, History, ScrollText } from "lucide-react"
import { Button } from "./ui/button"
import { Link } from "wouter"
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet"

function NavLinks({ location, isAdmin, onNavigate }: { location: string; isAdmin: boolean; onNavigate?: () => void }) {
  const cls = (path: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      location === path
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
    }`

  return (
    <>
      <Link href="/dashboard" className={cls("/dashboard")} onClick={onNavigate}>
        <LayoutDashboard className="h-4 w-4 shrink-0" /> Overview
      </Link>
      <Link href="/models" className={cls("/models")} onClick={onNavigate}>
        <BookOpen className="h-4 w-4 shrink-0" /> Model Catalog
      </Link>
      <Link href="/requests" className={cls("/requests")} onClick={onNavigate}>
        <History className="h-4 w-4 shrink-0" /> Request Log
      </Link>

      {isAdmin && (
        <div className="mt-6 pt-4 border-t border-sidebar-border">
          <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</div>
          <Link href="/admin" className={cls("/admin")} onClick={onNavigate}>
            <Database className="h-4 w-4 shrink-0" /> System Stats
          </Link>
          <Link href="/admin/users" className={cls("/admin/users")} onClick={onNavigate}>
            <Users className="h-4 w-4 shrink-0" /> Users
          </Link>
          <Link href="/admin/providers" className={cls("/admin/providers")} onClick={onNavigate}>
            <Server className="h-4 w-4 shrink-0" /> Providers
          </Link>
          <Link href="/admin/models" className={cls("/admin/models")} onClick={onNavigate}>
            <BrainCircuit className="h-4 w-4 shrink-0" /> Models
          </Link>
          <Link href="/admin/requests" className={cls("/admin/requests")} onClick={onNavigate}>
            <ScrollText className="h-4 w-4 shrink-0" /> Global Stream
          </Link>
        </div>
      )}
    </>
  )
}

function GuestLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  const cls = (path: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      location === path
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
    }`

  return (
    <>
      <Link href="/" className={cls("/")} onClick={onNavigate}>
        <Home className="h-4 w-4 shrink-0" /> Home
      </Link>
      <Link href="/models" className={cls("/models")} onClick={onNavigate}>
        <BookOpen className="h-4 w-4 shrink-0" /> Model Catalog
      </Link>
    </>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation()
  const { data: user, isLoading } = useGetMe({ query: { retry: false } })
  const logout = useLogout()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const handleLogout = () => {
    const finishLogout = () => {
      localStorage.removeItem("qillin_token")
      // Clear the cached user (and every other cached response) so no stale,
      // previously-logged-in user data lingers in the sidebar/UI after sign out.
      queryClient.clear()
      setLocation("/")
    }

    logout.mutate(undefined, {
      onSuccess: finishLogout,
      // Even if the server call fails (e.g. token already expired), the user
      // still expects to be signed out locally.
      onError: finishLogout,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isAdmin = user?.role === "admin"

  const Logo = () => (
    <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-sidebar-foreground">
      <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center shrink-0">
        <div className="w-3 h-3 border-2 border-primary-foreground rounded-full" />
      </div>
      Qillin
    </Link>
  )

  const UserFooter = () =>
    user ? (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold truncate">{user.name}</span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {user.qredits.toFixed(2)} Qr
            </span>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2 rounded-none" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full rounded-none">
          <Link href="/login">Sign In</Link>
        </Button>
        <Button asChild className="w-full rounded-none">
          <Link href="/register">Create Account</Link>
        </Button>
      </div>
    )

  return (
    <div className="flex min-h-screen w-full bg-background flex-col">
      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-sidebar shrink-0">
        <Logo />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-sidebar-border">
              <Logo />
              <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {user ? (
                <NavLinks location={location} isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
              ) : (
                <GuestLinks location={location} onNavigate={() => setMobileOpen(false)} />
              )}
            </nav>
            <div className="p-4 border-t border-sidebar-border">
              <UserFooter />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* ── Desktop layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="hidden md:flex w-64 border-r bg-sidebar flex-shrink-0 flex-col">
          <div className="p-6 pb-4">
            <Logo />
            <div className="mt-1 text-xs font-mono text-muted-foreground tracking-wider">PROXY CONTROL</div>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {user ? (
              <NavLinks location={location} isAdmin={isAdmin} />
            ) : (
              <GuestLinks location={location} />
            )}
          </nav>

          <div className="p-4 border-t border-sidebar-border mt-auto">
            <UserFooter />
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
