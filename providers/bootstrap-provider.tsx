import { PropsWithChildren, useEffect, useState } from "react";
import { ArtAtlasLoader } from "@/components/art-atlas-loader";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { startPerformanceSpan } from "@/utils/performance";

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const { authLoading, isAuthenticated } = useAccount();
  const { isLanguageReady } = useLanguage();
  const { isThemeReady } = useAppTheme();
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [startupBudgetExpired, setStartupBudgetExpired] = useState(false);
  const [bootstrapSpan] = useState(() => startPerformanceSpan("bootstrap.ready"));

  useEffect(() => {
    if (!hasBootstrapped && ((!authLoading && isLanguageReady && isThemeReady) || startupBudgetExpired)) {
      bootstrapSpan.end({ authenticated: isAuthenticated, budgetExpired: startupBudgetExpired });
      setHasBootstrapped(true);
    }
  }, [authLoading, bootstrapSpan, hasBootstrapped, isAuthenticated, isLanguageReady, isThemeReady, startupBudgetExpired]);

  useEffect(() => {
    const timer = setTimeout(() => setStartupBudgetExpired(true), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {children}
      <ArtAtlasLoader visible={!hasBootstrapped} label="Art Atlas hazırlanıyor" variant="splash" />
    </>
  );
}
