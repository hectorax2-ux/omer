import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";
import { ArtAtlasLoader } from "@/components/art-atlas-loader";

type LoadingContextValue = {
  hideLoading: () => void;
  showLoading: (label?: string) => void;
  withLoading: <T>(task: () => Promise<T>, label?: string) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: PropsWithChildren) {
  const [manualLoading, setManualLoading] = useState<{ visible: boolean; label?: string }>({ visible: false });

  const showLoading = useCallback((label?: string) => {
    setManualLoading({ visible: true, label });
  }, []);

  const hideLoading = useCallback(() => {
    setManualLoading({ visible: false });
  }, []);

  const withLoading = useCallback(async <T,>(task: () => Promise<T>, label?: string) => {
    setManualLoading({ visible: true, label });
    try {
      return await task();
    } finally {
      setManualLoading({ visible: false });
    }
  }, []);

  const value = useMemo(() => ({ hideLoading, showLoading, withLoading }), [hideLoading, showLoading, withLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <ArtAtlasLoader
        visible={manualLoading.visible}
        variant="overlay"
        label={manualLoading.label}
      />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used inside LoadingProvider");
  }
  return context;
}
