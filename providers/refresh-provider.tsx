import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { InteractionManager } from "react-native";
import { usePathname } from "expo-router";

type Refresher = () => void | Promise<void>;
type RegisteredRefresher = { fn: Refresher; scopes: string[] };

type RefreshContextValue = {
  registerRefresher: (fn: Refresher, scopes: string[]) => () => void;
  refreshAll: () => Promise<void>;
};

const RefreshContext = createContext<RefreshContextValue>({
  registerRefresher: () => () => undefined,
  refreshAll: async () => undefined
});

// Birden çok yenileme isteği art arda gelirse (gezinme + pull-to-refresh aynı anda)
// kısa pencere içinde tek seferde toplar.
const MIN_REFRESH_GAP_MS = 600;

export function RefreshProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const refreshers = useRef(new Set<RegisteredRefresher>());
  const lastRun = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const registerRefresher = useCallback((fn: Refresher, scopes: string[]) => {
    const entry = { fn, scopes };
    refreshers.current.add(entry);
    return () => {
      refreshers.current.delete(entry);
    };
  }, []);

  const refreshAll = useCallback(() => {
    const now = Date.now();
    if (inFlight.current) return inFlight.current;
    if (now - lastRun.current < MIN_REFRESH_GAP_MS) return Promise.resolve();
    lastRun.current = now;
    const entries = [...refreshers.current]
      .filter((entry) => entry.scopes.some((scope) => pathname === scope || pathname.startsWith(`${scope}/`)));
    const refresh = new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        void entries.reduce<Promise<void>>((chain, entry, index) => chain.then(async () => {
          await Promise.allSettled([Promise.resolve().then(entry.fn)]);
          if (index < entries.length - 1) await new Promise<void>((next) => requestAnimationFrame(() => next()));
        }), Promise.resolve()).finally(resolve);
      });
    });
    inFlight.current = refresh;
    void refresh.finally(() => {
      if (inFlight.current === refresh) inFlight.current = null;
    });
    return refresh;
  }, [pathname]);

  const value = useMemo(() => ({ registerRefresher, refreshAll }), [registerRefresher, refreshAll]);

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  return useContext(RefreshContext);
}

// Veri sağlayıcıların / ekranların yeniden-yükleme fonksiyonunu kayıt etmesi için.
// Render sırasında değişen closure'lar bile en güncel haliyle çalışır.
export function useRegisterRefresh(fn: Refresher, options?: { scope?: string | string[] }) {
  const { registerRefresher } = useRefresh();
  const pathname = usePathname();
  const ref = useRef(fn);
  ref.current = fn;
  const scopes = options?.scope ? (Array.isArray(options.scope) ? options.scope : [options.scope]) : [pathname];
  const scopeKey = scopes.join("|");
  useEffect(() => registerRefresher(() => ref.current(), scopeKey.split("|")), [registerRefresher, scopeKey]);
}

// Her sayfa değişiminde (push / geri dönüş / sekme değişimi) tüm kayıtlı verileri tazeler.
// İlk mount'ta sağlayıcılar zaten yükleme yaptığı için ilk odak atlanır.
export function RefreshOnNavigate() {
  const pathname = usePathname();
  const { refreshAll } = useRefresh();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refreshAll();
  }, [pathname, refreshAll]);

  return null;
}
