import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminStats } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Users, Server, Box, Activity, DollarSign } from "lucide-react"

export default function AdminDashboard() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminDashboardContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminDashboardContent() {
  const { data: stats } = useGetAdminStats()

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary">System Telemetry</h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">Global administrative overview</p>
      </div>

      {/* Metrics grid — 2 cols on mobile, 5 on desktop */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <MetricCard title="Users" value={formatNumber(stats?.totalUsers)} icon={Users} />
        <MetricCard title="Spend" value={`${formatCurrency(stats?.totalSpend)} Qr`} icon={DollarSign} valueColor="text-emerald-500" />
        <MetricCard title="Requests" value={formatNumber(stats?.totalRequests)} icon={Activity} />
        <MetricCard title="Models" value={formatNumber(stats?.activeModels)} icon={Box} />
        <MetricCard title="Providers" value={formatNumber(stats?.activeProviders)} icon={Server} className="col-span-2 md:col-span-1" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="rounded-none border-2 md:col-span-2 shadow-lg">
          <CardHeader className="border-b bg-background pb-4 px-4">
            <CardTitle className="font-mono uppercase tracking-wider text-sm md:text-base">Consumption Trajectory</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 bg-background">
            <div className="h-[220px] md:h-[300px] w-full">
              {stats?.spendByDay && stats.spendByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.spendByDay} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}Qr`}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '0', border: '2px solid hsl(var(--border))', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      formatter={(val: number) => [`${val.toFixed(4)} Qr`, 'Spend']}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSpend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center font-mono text-muted-foreground text-sm border-2 border-dashed">
                  Insufficient telemetry data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 shadow-lg flex flex-col">
          <CardHeader className="border-b bg-background pb-4 px-4">
            <CardTitle className="font-mono uppercase tracking-wider text-sm md:text-base">Top Consumers</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 bg-background overflow-hidden">
            <div className="divide-y max-h-[220px] md:max-h-[300px] overflow-y-auto">
              {stats?.topUsers && stats.topUsers.length > 0 ? (
                stats.topUsers.map((user, i) => (
                  <div key={user.userId} className="p-3 md:p-4 flex items-center justify-between hover:bg-sidebar/30 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="font-mono font-bold text-xs bg-muted text-muted-foreground w-5 h-5 flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-sm truncate">{user.name}</div>
                        <div className="font-mono text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-mono font-bold text-sm text-primary">{formatCurrency(user.spend)} Qr</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{formatNumber(user.requests)} req</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center font-mono text-muted-foreground text-sm">No consumer data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, valueColor = "text-foreground", className = "" }: {
  title: string; value: string; icon: any; valueColor?: string; className?: string
}) {
  return (
    <Card className={`rounded-none border-2 bg-background shadow-sm hover:border-primary/50 transition-colors group ${className}`}>
      <CardContent className="p-3 md:p-4 flex flex-col justify-between h-full">
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-primary transition-colors mb-2 md:mb-4" />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">{title}</p>
          <h3 className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${valueColor}`}>{value}</h3>
        </div>
      </CardContent>
    </Card>
  )
}
