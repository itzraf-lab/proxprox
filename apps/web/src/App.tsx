import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';

import Home from '@/pages/home';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Dashboard from '@/pages/dashboard';
import Models from '@/pages/models';
import AdminDashboard from '@/pages/admin/dashboard';
import AdminUsers from '@/pages/admin/users';
import AdminProviders from '@/pages/admin/providers';
import AdminModels from '@/pages/admin/models';
import AdminCachePricing from '@/pages/admin/cache-pricing';
import Requests from '@/pages/requests';
import AdminRequests from '@/pages/admin/requests';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 30s so navigating between pages doesn't trigger
      // a refetch storm on every mount; pages can still opt out per-query.
      staleTime: 30_000,
      // Fail fast: one retry instead of the default three so error states
      // surface quickly instead of leaving spinners up for seconds.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-mono">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4 border-b-2 border-primary pb-2 uppercase tracking-widest">404</h1>
        <p className="text-xl uppercase tracking-widest text-muted-foreground">Resource not found</p>
      </div>
    </div>
  )
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/models" component={Models} />
      <Route path="/requests" component={Requests} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/providers" component={AdminProviders} />
      <Route path="/admin/models" component={AdminModels} />
      <Route path="/admin/cache-pricing" component={AdminCachePricing} />
      <Route path="/admin/requests" component={AdminRequests} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
