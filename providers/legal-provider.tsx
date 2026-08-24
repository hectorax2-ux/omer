import { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAccount } from "@/hooks/use-account";

const LEGAL_ACCEPTANCE_KEY = "artco/legal-accepted";

type LegalContextValue = {
  hasAcceptedLegal: boolean;
  isLegalReady: boolean;
  acceptLegal: () => void;
  resetLegalAcceptance: () => void;
};

export const LegalContext = createContext<LegalContextValue>({
  hasAcceptedLegal: false,
  isLegalReady: false,
  acceptLegal: () => undefined,
  resetLegalAcceptance: () => undefined
});

export function LegalProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAccount();
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [isLegalReady, setIsLegalReady] = useState(false);
  const acceptedInSessionRef = useRef(false);
  const accountLegalKey = LEGAL_ACCEPTANCE_KEY;

  useEffect(() => {
    let mounted = true;
    setIsLegalReady(false);

    if (!isAuthenticated) {
      setHasAcceptedLegal(true);
      setIsLegalReady(true);
      return () => {
        mounted = false;
      };
    }

    if (acceptedInSessionRef.current) {
      setHasAcceptedLegal(true);
      setIsLegalReady(true);
      return () => {
        mounted = false;
      };
    }

    AsyncStorage.getItem(accountLegalKey)
      .then((value) => {
        if (mounted) {
          setHasAcceptedLegal(value === "true");
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLegalReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [accountLegalKey, isAuthenticated]);

  const value = useMemo(
    () => ({
      hasAcceptedLegal,
      isLegalReady,
      acceptLegal: () => {
        acceptedInSessionRef.current = true;
        setHasAcceptedLegal(true);
        AsyncStorage.setItem(accountLegalKey, "true");
      },
      resetLegalAcceptance: () => {
        acceptedInSessionRef.current = false;
        setHasAcceptedLegal(false);
        AsyncStorage.removeItem(accountLegalKey);
      }
    }),
    [accountLegalKey, hasAcceptedLegal, isLegalReady]
  );

  return <LegalContext.Provider value={value}>{children}</LegalContext.Provider>;
}
