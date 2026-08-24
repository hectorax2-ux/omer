import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { HOME_ENGINE_CONFIG } from "./content-engine";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { loadHomeRuntimeConfig, type HomeRuntimeConfig } from "@/src/services/firebase/home-config-service";

const initial: HomeRuntimeConfig = { config: HOME_ENGINE_CONFIG, overrides: {} };

export function useHomeRuntimeConfig() {
  const [runtime, setRuntime] = useState(initial);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setRefreshCounter((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    loadHomeRuntimeConfig().then((value) => {
      if (active) setRuntime(value);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshCounter]);

  return runtime;
}
