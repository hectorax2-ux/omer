import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { loadAppVersionConfig } from "@/src/services/firebase/app-version-service";
import { resumeAndroidImmediateUpdate, startAndroidImmediateUpdate } from "@/src/services/platform/android-in-app-update";
import { isAppVersionOlder } from "@/utils/app-version";
import { useStartupPhase } from "@/hooks/use-startup-phase";

type UpdateState = { required: boolean; optional: boolean; storeUrl: string; latestVersion: string };

const copy = {
  title: { tr: "Yeni Güncelleme Hazır", en: "A New Update Is Ready", ru: "Доступно обновление", uz: "Yangi yangilanish tayyor" },
  body: {
    tr: "Art Atlas'ın yeni sürümü kullanıma hazır. Devam etmek için uygulamayı güncellemeniz gerekiyor.",
    en: "A new version of Art Atlas is ready. Update the app to continue.",
    ru: "Доступна новая версия Art Atlas. Обновите приложение, чтобы продолжить.",
    uz: "Art Atlas'ning yangi versiyasi tayyor. Davom etish uchun ilovani yangilang."
  },
  optionalBody: {
    tr: "Art Atlas'ın yeni sürümü kullanıma hazır. En yeni özellikler için şimdi güncelleyebilirsiniz.",
    en: "A new Art Atlas version is ready. Update now for the latest improvements.",
    ru: "Доступна новая версия Art Atlas. Обновитесь, чтобы получить последние улучшения.",
    uz: "Art Atlas'ning yangi versiyasi tayyor. So'nggi yaxshilanishlar uchun yangilang."
  },
  update: { tr: "UYGULAMAYI GÜNCELLE", en: "UPDATE APP", ru: "ОБНОВИТЬ", uz: "ILOVANI YANGILASH" },
  starting: { tr: "GÜNCELLEME BAŞLATILIYOR", en: "STARTING UPDATE", ru: "ЗАПУСК ОБНОВЛЕНИЯ", uz: "YANGILANISH BOSHLANMOQDA" },
  later: { tr: "Daha Sonra", en: "Later", ru: "Позже", uz: "Keyinroq" }
} as const;

export function AppUpdateGate({ children }: PropsWithChildren) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const dismissedVersion = useRef("");
  const checking = useRef(false);
  const lastCheckedAt = useRef(0);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [startingUpdate, setStartingUpdate] = useState(false);
  const startupPhase = useStartupPhase();

  const checkVersion = useCallback(async () => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (checking.current) return;
    if (Date.now() - lastCheckedAt.current < 15 * 60 * 1000) return;
    checking.current = true;
    const config = await loadAppVersionConfig().finally(() => {
      checking.current = false;
      lastCheckedAt.current = Date.now();
    });
    if (!config) return;

    const installed = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0";
    const ios = Platform.OS === "ios";
    const latestVersion = ios ? config.iosLatestVersion : config.androidLatestVersion;
    const minimumVersion = ios ? config.iosMinimumVersion : config.androidMinimumVersion;
    const forceUpdate = ios ? config.iosForceUpdate : config.androidForceUpdate;
    const storeUrl = ios ? config.iosStoreUrl : config.androidStoreUrl;
    const belowMinimum = isAppVersionOlder(installed, minimumVersion);
    const required = belowMinimum || (forceUpdate && isAppVersionOlder(installed, latestVersion));
    const optional = !required && isAppVersionOlder(installed, latestVersion) && dismissedVersion.current !== latestVersion;
    setUpdate(required || optional ? { required, optional, storeUrl, latestVersion } : null);
    if (required && Platform.OS === "android") void resumeAndroidImmediateUpdate();
  }, []);

  const beginUpdate = useCallback(async () => {
    if (!update || startingUpdate) return;
    setStartingUpdate(true);
    try {
      if (Platform.OS === "android" && await startAndroidImmediateUpdate()) return;
      const nativeStoreUrl = Platform.OS === "android"
        ? "market://details?id=com.artatlas.app"
        : "itms-apps://itunes.apple.com/app/id6792671640";
      await Linking.openURL(nativeStoreUrl).catch(() => Linking.openURL(update.storeUrl));
    } catch (error) {
      if (__DEV__) console.warn("[version-control] update flow failed", error);
    } finally {
      setStartingUpdate(false);
    }
  }, [startingUpdate, update]);

  useEffect(() => {
    if (startupPhase === "critical") return;
    void checkVersion();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkVersion();
    });
    return () => subscription.remove();
  }, [checkVersion, startupPhase]);

  const required = update?.required === true;

  return (
    <>
      {children}
      <Modal
        visible={Boolean(update)}
        transparent={!required}
        animationType="fade"
        presentationStyle={required ? "fullScreen" : "overFullScreen"}
        onRequestClose={() => {
          if (!required && update) {
            dismissedVersion.current = update.latestVersion;
            setUpdate(null);
          }
        }}
      >
        <View style={[styles.backdrop, required && { backgroundColor: colors.ink }, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.panel, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            <View style={[styles.icon, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
              <Ionicons name="cloud-download-outline" size={36} color={colors.gold} />
            </View>
            <Text style={[styles.title, { color: colors.ivory }]}>{copy.title[language]}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{(required ? copy.body : copy.optionalBody)[language]}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={startingUpdate}
              onPress={() => void beginUpdate()}
              style={[styles.updateButton, { backgroundColor: colors.gold }, startingUpdate && styles.updateButtonBusy]}
            >
              <Text style={[styles.updateText, { color: colors.ink }]}>{(startingUpdate ? copy.starting : copy.update)[language]}</Text>
            </Pressable>
            {!required && update ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  dismissedVersion.current = update.latestVersion;
                  setUpdate(null);
                }}
                style={styles.laterButton}
              >
                <Text style={[styles.laterText, { color: colors.muted }]}>{copy.later[language]}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  panel: { width: "100%", maxWidth: 440, borderRadius: 18, borderWidth: 1, alignItems: "center", padding: 24 },
  icon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { fontSize: 23, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 23, fontWeight: "600", textAlign: "center", marginTop: 10 },
  updateButton: { width: "100%", minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 24, paddingHorizontal: 16 },
  updateButtonBusy: { opacity: 0.72 },
  updateText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
  laterButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 6 },
  laterText: { fontSize: 14, fontWeight: "800" }
});
