import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import {
  loadCachedAppUpdateConfig,
  loadRemoteAppUpdateConfig,
  subscribeAppUpdateConfig
} from "@/src/services/firebase/app-update-service";
import {
  parseNativeBuild,
  shouldPresentAppUpdate,
  type AppUpdateConfig,
  type AppUpdatePlatform
} from "@/firebase/shared/app-update";

type UpdateState = AppUpdateConfig & { required: boolean; installedVersion: string };

const DISMISS_PREFIX = "art-atlas:app-update-dismissed";
const DISMISS_DURATION_MS = 12 * 60 * 60 * 1000;

const copy = {
  eyebrowOptional: { tr: "ART ATLAS · YENİ SÜRÜM", en: "ART ATLAS · NEW VERSION", ru: "ART ATLAS · НОВАЯ ВЕРСИЯ", uz: "ART ATLAS · YANGI VERSIYA" },
  eyebrowRequired: { tr: "ART ATLAS · GÜNCELLEME GEREKLİ", en: "ART ATLAS · UPDATE REQUIRED", ru: "ART ATLAS · ТРЕБУЕТСЯ ОБНОВЛЕНИЕ", uz: "ART ATLAS · YANGILASH ZARUR" },
  titleOptional: { tr: "Yeni bir keşif seni bekliyor.", en: "A new discovery awaits you.", ru: "Вас ждёт новое открытие.", uz: "Sizni yangi kashfiyot kutmoqda." },
  titleRequired: { tr: "Yolculuğa devam etmek için Art Atlas'ı güncelle.", en: "Update Art Atlas to continue your journey.", ru: "Обновите Art Atlas, чтобы продолжить путешествие.", uz: "Sayohatni davom ettirish uchun Art Atlas'ni yangilang." },
  bodyOptional: {
    tr: "Art Atlas'ın yeni sürümü hazır. Yeni özellikler ve iyileştirmeler için uygulamanı güncelle.",
    en: "A new Art Atlas version is ready. Update for the latest features and improvements.",
    ru: "Доступна новая версия Art Atlas. Обновитесь, чтобы получить новые функции и улучшения.",
    uz: "Art Atlas'ning yangi versiyasi tayyor. Yangi imkoniyatlar va yaxshilanishlar uchun ilovani yangilang."
  },
  bodyRequired: {
    tr: "Kullandığın sürüm artık desteklenmiyor. Devam etmek için en güncel Art Atlas sürümünü yükle.",
    en: "Your version is no longer supported. Install the latest Art Atlas version to continue.",
    ru: "Ваша версия больше не поддерживается. Установите последнюю версию Art Atlas, чтобы продолжить.",
    uz: "Siz foydalanayotgan versiya endi qo'llab-quvvatlanmaydi. Davom etish uchun eng so'nggi Art Atlas versiyasini o'rnating."
  },
  update: { tr: "Güncelle", en: "Update", ru: "Обновить", uz: "Yangilash" },
  opening: { tr: "Mağaza açılıyor", en: "Opening store", ru: "Открываем магазин", uz: "Do'kon ochilmoqda" },
  later: { tr: "Daha Sonra", en: "Later", ru: "Позже", uz: "Keyinroq" }
} as const;

export function AppUpdateGate({ children }: PropsWithChildren) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const startupPhase = useStartupPhase();
  const refreshing = useRef(false);
  const evaluationRevision = useRef(0);
  const componentMounted = useRef(true);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [openingStore, setOpeningStore] = useState(false);
  const platform = nativePlatform();

  const applyConfig = useCallback(async (config: AppUpdateConfig | null, remoteVerified: boolean) => {
    if (!componentMounted.current) return;
    const revision = ++evaluationRevision.current;
    if (!platform || !config) {
      setUpdate(null);
      return;
    }
    const installedBuild = parseNativeBuild(Application.nativeBuildVersion ?? Constants.nativeBuildVersion);
    const decision = shouldPresentAppUpdate(config, platform, installedBuild, remoteVerified);
    if (!decision) {
      setUpdate(null);
      return;
    }
    if (!decision.required && await wasDismissedRecently(platform, config.build)) {
      if (!componentMounted.current || revision !== evaluationRevision.current) return;
      setUpdate(null);
      return;
    }
    if (!componentMounted.current || revision !== evaluationRevision.current) return;
    setUpdate({
      ...config,
      required: decision.required,
      installedVersion: Application.nativeApplicationVersion ?? Constants.nativeAppVersion ?? ""
    });
  }, [platform]);

  useEffect(() => () => {
    componentMounted.current = false;
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!platform || refreshing.current) return;
    refreshing.current = true;
    await loadRemoteAppUpdateConfig(platform)
      .then((config) => applyConfig(config, true))
      .catch(() => {
        if (componentMounted.current) setUpdate(null);
      })
      .finally(() => {
        refreshing.current = false;
      });
  }, [applyConfig, platform]);

  useEffect(() => {
    if (!platform || __DEV__ || startupPhase === "critical") return;
    let mounted = true;
    void loadCachedAppUpdateConfig(platform).then((config) => {
      if (mounted && config?.updateType === "optional") void applyConfig(config, false);
    });
    const unsubscribe = subscribeAppUpdateConfig(
      platform,
      (config, remoteVerified) => {
        if (mounted) void applyConfig(config, remoteVerified);
      },
      () => {
        if (mounted) setUpdate(null);
      }
    );
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshFromServer();
    });
    return () => {
      mounted = false;
      unsubscribe();
      appState.remove();
    };
  }, [applyConfig, platform, refreshFromServer, startupPhase]);

  const dismiss = useCallback(async () => {
    if (!platform || !update || update.required) return;
    await AsyncStorage.setItem(
      `${DISMISS_PREFIX}:${platform}`,
      JSON.stringify({ build: update.build, dismissedAt: Date.now() })
    ).catch(() => undefined);
    setUpdate(null);
  }, [platform, update]);

  const beginUpdate = useCallback(async () => {
    if (!update || openingStore) return;
    setOpeningStore(true);
    await Linking.openURL(update.storeUrl)
      .catch((error) => {
        if (__DEV__) console.warn("[app-update] store could not be opened", error);
      })
      .finally(() => setOpeningStore(false));
  }, [openingStore, update]);

  const required = update?.required === true;
  const title = update?.title[language] || update?.title.tr || (required ? copy.titleRequired : copy.titleOptional)[language];
  const body = update?.message[language] || update?.message.tr || (required ? copy.bodyRequired : copy.bodyOptional)[language];

  return (
    <>
      {children}
      <Modal
        visible={Boolean(update)}
        transparent={!required}
        animationType="fade"
        presentationStyle={required ? "fullScreen" : "overFullScreen"}
        onRequestClose={() => {
          if (!required) void dismiss();
        }}
      >
        <View style={[styles.backdrop, required && { backgroundColor: colors.ink }, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.panel, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            <Text style={[styles.eyebrow, { color: colors.gold }]}>{(required ? copy.eyebrowRequired : copy.eyebrowOptional)[language]}</Text>
            <View style={[styles.icon, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
              <Ionicons name="cloud-download-outline" size={34} color={colors.gold} />
            </View>
            <Text style={[styles.title, { color: colors.ivory }]}>{title}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
            {update ? <Text style={[styles.version, { color: colors.gold }]}>{update.installedVersion || "—"} → {update.version}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={openingStore}
              onPress={() => void beginUpdate()}
              style={[styles.updateButton, { backgroundColor: colors.gold }, openingStore && styles.updateButtonBusy]}
            >
              <Text style={[styles.updateText, { color: colors.ink }]}>{(openingStore ? copy.opening : copy.update)[language]}</Text>
            </Pressable>
            {!required ? (
              <Pressable accessibilityRole="button" onPress={() => void dismiss()} style={styles.laterButton}>
                <Text style={[styles.laterText, { color: colors.muted }]}>{copy.later[language]}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function nativePlatform(): AppUpdatePlatform | null {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return null;
}

async function wasDismissedRecently(platform: AppUpdatePlatform, build: number) {
  const stored = await AsyncStorage.getItem(`${DISMISS_PREFIX}:${platform}`).catch(() => null);
  if (!stored) return false;
  try {
    const dismissal = JSON.parse(stored) as { build?: unknown; dismissedAt?: unknown };
    return parseNativeBuild(dismissal.build) === build
      && typeof dismissal.dismissedAt === "number"
      && Date.now() - dismissal.dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  panel: { width: "100%", maxWidth: 440, borderRadius: 18, borderWidth: 1, alignItems: "center", padding: 24 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 1.1, textAlign: "center", marginBottom: 14 },
  icon: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 22, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 23, fontWeight: "600", textAlign: "center", marginTop: 10 },
  version: { fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 14 },
  updateButton: { width: "100%", minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 22, paddingHorizontal: 16 },
  updateButtonBusy: { opacity: 0.72 },
  updateText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
  laterButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 6 },
  laterText: { fontSize: 14, fontWeight: "800" }
});
