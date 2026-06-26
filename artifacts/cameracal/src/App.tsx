import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScanProvider } from "./context/ScanContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import Dashboard from "./pages/Dashboard";
import Analyse from "./pages/Analyse";
import RecoveryPreview from "./pages/RecoveryPreview";
import Report from "./pages/Report";
import Guidance from "./pages/Guidance";
import Settings from "./pages/Settings";
import ReadinessCheck from "./pages/ReadinessCheck";
import CounterfeitDetector from "./pages/CounterfeitDetector";
import ScanHistory from "./pages/ScanHistory";
import Benchmark from "./pages/Benchmark";
import SafeFormat from "./pages/SafeFormat";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        style={{ height: '100%' }}
      >
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/analyse" component={Analyse} />
          <Route path="/readiness" component={ReadinessCheck} />
          <Route path="/counterfeit" component={CounterfeitDetector} />
          <Route path="/recovery" component={RecoveryPreview} />
          <Route path="/report" component={Report} />
          <Route path="/guidance" component={Guidance} />
          <Route path="/settings" component={Settings} />
          <Route path="/history" component={ScanHistory} />
          <Route path="/benchmark" component={Benchmark} />
          <Route path="/format" component={SafeFormat} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <Layout>
      <AnimatedRoutes />
    </Layout>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <ScanProvider>
        <TooltipProvider>
          {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ScanProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
