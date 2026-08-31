import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { ArtAtlasLoader } from "@/components/art-atlas-loader";
import { markPerformanceEvent } from "@/utils/performance";

export function TabScreenMountGate({ title, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const focused = useIsFocused();
  const [mounted, setMounted] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const firstPaintLogged = useRef(false);

  useEffect(() => {
    if (mounted || !laidOut || !focused) return;
    let task: ReturnType<typeof setTimeout> | undefined;
    // Commit the target route's native shell before mounting expensive hooks
    // and lists. No network/InteractionManager gate; warm tabs stay mounted.
    const frame = requestAnimationFrame(() => {
      task = setTimeout(() => setMounted(true), 0);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(task); };
  }, [focused, laidOut, mounted]);

  if (mounted) return children;
  return <View style={styles.shell} onLayout={() => {
    setLaidOut(true);
    if (firstPaintLogged.current) return;
    firstPaintLogged.current = true;
    markPerformanceEvent("NAV_TARGET_SHELL_LAYOUT", { title });
  }}><ArtAtlasLoader visible variant="detail" label={title} /></View>;
}

const styles = StyleSheet.create({ shell: { flex: 1, backgroundColor: "#070A12" } });
