import "react-native-gesture-handler";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccountProvider } from "@/providers/account-provider";
import { AdProvider } from "@/providers/ad-provider";
import { ArtSystemsProvider } from "@/providers/art-systems-provider";
import { CommunityArtProvider } from "@/providers/community-art-provider";
import { DiscoveryPostProvider } from "@/providers/discovery-post-provider";
import { EngagementProvider } from "@/providers/engagement-provider";
import { ArtStoryEngagementProvider } from "@/providers/art-story-engagement-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { LegalProvider } from "@/providers/legal-provider";
import { LoadingProvider } from "@/providers/loading-provider";
import { SocialProvider } from "@/providers/social-provider";
import { CountryLookupProvider } from "@/providers/country-lookup-provider";
import { SupportProvider } from "@/providers/support-provider";
import { MessagingProvider } from "@/providers/messaging-provider";
import { RefreshProvider } from "@/providers/refresh-provider";
import { ReadingPreferencesProvider } from "@/providers/reading-preferences-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { disablePushDevice, registerForPushNotifications } from "@/src/services/firebase/push-notification-service";
import { markNotificationRead } from "@/src/services/firebase/notification-service";
import { ProfileCompletionGate } from "@/components/profile-completion-gate";
import { AppUpdateGate } from "@/components/app-update-gate";
import { AppBootstrapProvider } from "@/providers/bootstrap-provider";
import { endPerformanceMarker, markPerformanceEvent } from "@/utils/performance";
import { useStartupPhase } from "@/hooks/use-startup-phase";

markPerformanceEvent("APP_START");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

function PushNotificationRegistrar() {
  const { account, isAuthenticated } = useAccount();
  const { language } = useLanguage();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const lastOpenedNotificationId = useRef("");
  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);
  const activePushUid = useRef("");
  const lastPushRegistrationAt = useRef(0);
  const startupPhase = useStartupPhase();

  useEffect(() => {
    const nextUid = isAuthenticated ? account.uid : "";
    const previousUid = activePushUid.current;
    activePushUid.current = nextUid;
    if (previousUid && previousUid !== nextUid) void disablePushDevice(previousUid);
  }, [account.uid, isAuthenticated]);

  useEffect(() => {
    if (startupPhase !== "idle" || !isAuthenticated || !account.uid) return;
    const uid = account.uid;
    let registrationPromise: Promise<unknown> | null = null;
    const register = (force = false) => {
      if (registrationPromise) return registrationPromise;
      if (!force && Date.now() - lastPushRegistrationAt.current < 6 * 60 * 60 * 1000) return Promise.resolve(null);
      registrationPromise = registerForPushNotifications(uid, language)
        .then((token) => {
          lastPushRegistrationAt.current = Date.now();
          return token;
        })
        .catch((error) => console.warn("[push] registration failed", error))
        .finally(() => {
          registrationPromise = null;
        });
      return registrationPromise;
    };
    void register();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void register();
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => void register(true));
    return () => {
      subscription.remove();
      tokenSubscription.remove();
    };
  }, [account.uid, isAuthenticated, language, startupPhase]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (!navigationState?.key) {
        pendingResponse.current = response;
        return;
      }
      const data = response.notification.request.content.data;
      const notificationId = typeof data?.notificationId === "string" ? data.notificationId : response.notification.request.identifier;
      if (notificationId && notificationId === lastOpenedNotificationId.current) return;
      const targetPath = data?.targetPath;
      if (typeof targetPath !== "string" || !targetPath.startsWith("/") || targetPath.startsWith("//") || targetPath.length > 300) return;
      lastOpenedNotificationId.current = notificationId;
      if (account.uid && notificationId) void markNotificationRead(notificationId, account.uid).catch(() => undefined);
      router.push(targetPath as never);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then(openResponse).catch(() => undefined);
    return () => subscription.remove();
  }, [account.uid, isAuthenticated, navigationState?.key, router]);

  useEffect(() => {
    if (!navigationState?.key || !pendingResponse.current) return;
    const response = pendingResponse.current;
    pendingResponse.current = null;
    const data = response.notification.request.content.data;
    const notificationId = typeof data?.notificationId === "string" ? data.notificationId : response.notification.request.identifier;
    const targetPath = data?.targetPath;
    if (notificationId && notificationId === lastOpenedNotificationId.current) return;
    if (typeof targetPath !== "string" || !targetPath.startsWith("/") || targetPath.startsWith("//") || targetPath.length > 300) return;
    lastOpenedNotificationId.current = notificationId;
    if (account.uid && notificationId) void markNotificationRead(notificationId, account.uid).catch(() => undefined);
    router.push(targetPath as never);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, [account.uid, navigationState?.key, router]);

  return null;
}

function NavigationPerformanceObserver() {
  const pathname = usePathname();
  const renderedPathname = useRef("");
  const navigationReady = useRef(false);
  if (renderedPathname.current !== pathname) {
    renderedPathname.current = pathname;
    markPerformanceEvent("NAV_DESTINATION_FIRST_RENDER", { pathname });
  }
  useEffect(() => {
    if (!navigationReady.current) {
      navigationReady.current = true;
      markPerformanceEvent("NAV_READY", { pathname });
    }
    markPerformanceEvent("NAV_DESTINATION_MOUNTED", { pathname });
    endPerformanceMarker("NAV_TAP", { pathname });
  }, [pathname]);
  return null;
}

function EmailVerificationLinkHandler() {
  const { verifyEmailCode } = useAccount();
  const handledCodes = useRef(new Set<string>());

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const mode = parsed.queryParams?.mode;
      const code = parsed.queryParams?.oobCode;
      if (mode !== "verifyEmail" || typeof code !== "string" || handledCodes.current.has(code)) return;
      handledCodes.current.add(code);
      void verifyEmailCode(code);
    };
    const subscription = Linking.addEventListener("url", (event) => handleUrl(event.url));
    void Linking.getInitialURL().then(handleUrl);
    return () => subscription.remove();
  }, [verifyEmailCode]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Art Atlas";
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ThemeProvider>
      <LanguageProvider>
        <AppUpdateGate>
        <RefreshProvider>
        <AccountProvider>
          <EmailVerificationLinkHandler />
          <MessagingProvider>
            <PushNotificationRegistrar />
            <SocialProvider>
            <CountryLookupProvider>
            <ArtSystemsProvider>
              <AdProvider>
                <LegalProvider>
                  <SupportProvider>
                    <EngagementProvider>
                      <ArtStoryEngagementProvider>
                      <CommunityArtProvider>
                        <DiscoveryPostProvider>
                          <LoadingProvider>
                            <ReadingPreferencesProvider>
                              <AppBootstrapProvider>
                              <NavigationPerformanceObserver />
                              <StatusBar style="light" />
                              <Stack screenOptions={{ headerShown: false }} />
                              <ProfileCompletionGate />
                              </AppBootstrapProvider>
                            </ReadingPreferencesProvider>
                          </LoadingProvider>
                        </DiscoveryPostProvider>
                      </CommunityArtProvider>
                      </ArtStoryEngagementProvider>
                    </EngagementProvider>
                  </SupportProvider>
                </LegalProvider>
              </AdProvider>
            </ArtSystemsProvider>
            </CountryLookupProvider>
            </SocialProvider>
          </MessagingProvider>
        </AccountProvider>
        </RefreshProvider>
        </AppUpdateGate>
      </LanguageProvider>
    </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
