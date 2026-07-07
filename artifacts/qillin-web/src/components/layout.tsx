import * as React from "react"
import { useLocation } from "wouter"
import { useGetMe, useLogout } from "@workspace/api-client-react"
import { LayoutDashboard, Database, Users, Server, BookOpen, LogOut, Loader2, Home } from "lucide-react"
import { Button } from "./ui/button"
import { Link } from "wouter"

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation()
  const { data: user, isLoading } = useGetMe({ query: { retry: false } })
  const logout = useLogout()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('qillin_token')
        setLocation('/')
      }
    })
  }

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      <aside className="w-full md:w-64 border-r bg-sidebar flex-shrink-0 flex flex-col">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-sidebar-foreground">
            <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-primary-foreground rounded-full" />
            </div>
            Qillin
          </Link>
          <div className="mt-1 text-xs font-mono text-muted-foreground tracking-wider">PROXY CONTROL</div>
        </div>

        {user ? (
          <nav className="flex-1 px-4 py-4 space-y-1">
            <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/dashboard' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </Link>
            <Link href="/models" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/models' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <BookOpen className="h-4 w-4" />
              Model Catalog
            </Link>

            {isAdmin && (
              <div className="mt-8 pt-4 border-t border-sidebar-border">
                <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</div>
                <Link href="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/admin' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                  <Database className="h-4 w-4" />
                  System Stats
                </Link>
                <Link href="/admin/users" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/admin/users' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                  <Users className="h-4 w-4" />
                  Users
                </Link>
                <Link href="/admin/providers" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/admin/providers' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                  <Server className="h-4 w-4" />
                  Providers
                </Link>
                <Link href="/admin/models" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/admin/models' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                  <Database className="h-4 w-4" />
                  Models
                </Link>
              </div>
            )}
          </nav>
        ) : (
          <nav className="flex-1 px-4 py-4 space-y-1">
            <Link href="/" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link href="/models" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/models' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <BookOpen className="h-4 w-4" />
              Model Catalog
            </Link>
          </nav>
        )}

        <div className="p-4 border-t border-sidebar-border mt-auto">
          {user ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold truncate">{user.name}</span>
                  <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {user.qredits.toFixed(2)} Qr
                  </span>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/register">Create Account</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
