import * as React from "react"
import { useLocation } from "wouter"
import { useGetMe } from "@workspace/api-client-react"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const [_, setLocation] = useLocation()
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false } })

  React.useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation('/login')
    } else if (!isLoading && requireAdmin && user?.role !== 'admin') {
      setLocation('/dashboard')
    }
  }, [isLoading, user, error, requireAdmin, setLocation])

  if (isLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (requireAdmin && user.role !== 'admin') {
    return null
  }

  return <>{children}</>
}
