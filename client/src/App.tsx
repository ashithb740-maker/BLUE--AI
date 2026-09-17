import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeToggle from "./components/ThemeToggle";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import BlueChat from "./pages/BlueChat";
import Auth from "./pages/Auth";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/auth" component={Auth} /><Route path="/chat" component={BlueChat} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function GlobalThemeToggle() {
  const [location] = useLocation();
  if (location === "/") return null;
  return <ThemeToggle />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster theme="dark" /><Router /><GlobalThemeToggle /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
