import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import TemplateDetail from "./pages/TemplateDetail";
import Settings from "./pages/Settings";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={user ? Dashboard : () => <RedirectToLogin />} />
      <Route path="/template/:id" component={user ? TemplateDetail : () => <RedirectToLogin />} />
      <Route path="/settings" component={user ? Settings : () => <RedirectToLogin />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RedirectToLogin() {
  return (
    <div className="flex items-center justify-center h-screen">
      <a href={getLoginUrl()} className="text-cyan-400 underline">
        Click here to login
      </a>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
