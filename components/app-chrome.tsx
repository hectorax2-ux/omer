import { memo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, TextInput, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import { useGlobalSearchParams, usePathname, useRouter, useSegments } from "expo-router";
import { UserRoleId } from "@/constants/profile-taxonomy";
import { AppTheme, colors, getThemeColors, isBrightTheme } from "@/constants/theme";
import { hairline, navigationLayout, v2Colors } from "@/constants/design";
import { copy, uiCopy } from "@/data/content";
import { useLanguage } from "@/hooks/use-language";
import { LanguageGate, LanguageMenu } from "@/components/language-menu";
import { LegalGate } from "@/components/legal-gate";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useAccount } from "@/hooks/use-account";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAds } from "@/hooks/use-ads";
import { useRefresh } from "@/providers/refresh-provider";
import { GlobalAdOverlays } from "@/components/ad-overlays";
import { isCategoryTopBannerRoute } from "@/utils/ad-routes";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useSocial } from "@/hooks/use-social";
import { useMessageBadgeCount } from "@/components/messages-tab-icon";
import { subscribeScrollToTop } from "@/utils/scroll-to-top";
import { profileRouteParam } from "@/utils/profile-route";
import { AdDocument } from "@/src/types/firestore";
import type { AdPlacementId } from "@/constants/ad-placements";
import { AdMobBannerView, isAdMobDelivery } from "@/components/admob-ad";
import { canUseAdMobUnit } from "@/constants/admob-config";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { ChromeTitle } from "@/components/chrome-title";
import { ThemePickerModal, getThemePickerLabel } from "@/components/theme-picker-modal";
import { homeCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";
import { getAppShortcutVisibility } from "@/utils/atlas-club-navigation";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useIsFocused } from "@react-navigation/native";
import { beginNavigationPerformanceLock, beginScrollPerformanceLock, endScrollPerformanceLock } from "@/hooks/use-runtime-performance-mode";
import { beginNavigationTransition, completeNavigationTransition, navigationLocationKey } from "@/utils/navigation-transition-store";

type ChromeChild = ReactNode | ((refreshVersion: number) => ReactNode);

export type AppChromeVirtualizedItem = {
  key: string;
  content: ReactNode;
};

const VirtualizedSection = memo(function VirtualizedSection({ item }: { item: AppChromeVirtualizedItem }) {
  return <View>{item.content}</View>;
});

type Props = {
  title: string;
  eyebrow?: string;
  scroll?: boolean;
  showTopAd?: boolean;
  showBackButton?: boolean;
  backToHome?: boolean;
  showBottomDock?: boolean;
  showFloatingShortcuts?: boolean;
  floatingCreateAction?: {
    label: string;
    accessibilityHint?: string;
    onPress: () => void;
  };
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  topAdContent?: ReactNode;
  onNavigationRequest?: (navigate: () => void) => void;
  fixedFooter?: ReactNode;
  fixedFooterHeight?: number;
  children?: ChromeChild;
  virtualizedItems?: readonly AppChromeVirtualizedItem[];
  virtualizedInitialNumToRender?: number;
  onVirtualizedViewableItemsChanged?: (keys: string[]) => void;
};

export function AppChrome({ children, title, eyebrow, scroll = true, showTopAd, showBackButton = false, backToHome = false, showBottomDock: showBottomDockProp, showFloatingShortcuts = true, floatingCreateAction, keyboardAvoiding = false, keyboardVerticalOffset = 0, topAdContent, onNavigationRequest, fixedFooter, fixedFooterHeight = 0, virtualizedItems, virtualizedInitialNumToRender = 6, onVirtualizedViewableItemsChanged }: Props) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const virtualizedRef = useRef<FlatList<AppChromeVirtualizedItem>>(null);
  const { language } = useLanguage();
  const accessibilityCopy = chromeAccessibilityCopy(language);
  const { theme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const { refreshAll } = useRefresh();
  const themeColors = getThemeColors(theme);
  const chromeAccent = v2Colors.primary;
  const themeStyles = useMemo(() => makeChromeThemeStyles(themeColors, theme), [themeColors, theme]);
  const router = useRouter();
  const pathname = usePathname();
  const navigationParams = useGlobalSearchParams<Record<string, string | string[]>>();
  const navigationLocation = navigationLocationKey(pathname, navigationParams);
  const segments = useSegments();
  const routeShortcutVisibility = getAppShortcutVisibility(pathname, { keyboardFocused: keyboardAvoiding || keyboardVisible });
  const shortcutVisibility = showFloatingShortcuts ? routeShortcutVisibility : { showAtlasClub: false, showPremium: false };
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const showFloatingCreate = showFloatingShortcuts && normalizedPathname === "/feed" && !keyboardVisible && !!floatingCreateAction;
  const hasFloatingShortcuts = shortcutVisibility.showAtlasClub || shortcutVisibility.showPremium || showFloatingCreate;
  const { account, isAuthenticated, isEmailVerified, resendVerificationEmail } = useAccount();
  const { trackPageViewForAds } = useAds();
  const { notifications: systemNotifications } = useArtSystems();
  const { width } = useWindowDimensions();
  const Content = scroll ? ScrollView : View;
  const usesVirtualizedContent = Boolean(virtualizedItems);
  const horizontalPadding = width < 360 ? 16 : width > 720 ? 24 : 18;
  const veryCompactHeader = width < 360;
  const compactHeader = width < 430;
  const headerControlSize = veryCompactHeader ? 34 : compactHeader ? 38 : 42;
  const languageButtonWidth = veryCompactHeader ? 46 : compactHeader ? 64 : 76;
  const headerGap = veryCompactHeader ? 5 : compactHeader ? 6 : 8;
  const backSlot = showBackButton ? headerControlSize + headerGap : 0;
  const actionsSlot = headerControlSize * 3 + languageButtonWidth + headerGap * 3;
  const titleMaxWidth = Math.max(88, width - horizontalPadding * 2 - backSlot - actionsSlot - headerGap * 2);
  const titleSize = veryCompactHeader ? (showBackButton ? 12.5 : 14) : width < 390 ? (showBackButton ? 13 : 16) : width < 430 ? (showBackButton ? 14 : 16) : showBackButton ? 15 : 20;
  const showBottomDock = showBottomDockProp ?? segments[0] !== "(tabs)";
  const isTabScreen = segments[0] === "(tabs)";
  const hasBottomNavigation = showBottomDock || isTabScreen;
  const resolvedBottomInset = Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const bottomNavigationHeight = navigationLayout.floatingBarHeight + resolvedBottomInset;
  const floatingBottom = hasBottomNavigation
    ? bottomNavigationHeight + navigationLayout.floatingActionDockGap
    : resolvedBottomInset + 12;
  const fixedFooterBottom = hasBottomNavigation
    ? bottomNavigationHeight + navigationLayout.floatingActionDockGap
    : resolvedBottomInset + 8;
  const shortcutContentBottom = floatingBottom + navigationLayout.floatingContentGap + (hasFloatingShortcuts ? navigationLayout.floatingActionSize : 0);
  const fixedFooterContentBottom = fixedFooter
    ? fixedFooterBottom + fixedFooterHeight + navigationLayout.floatingContentGap
    : 0;
  const contentBottomPadding = Math.max(shortcutContentBottom, fixedFooterContentBottom);
  const unreadNotificationCount = systemNotifications.filter((item) => !item.read).length;
  const compactButtonStyle = compactHeader ? styles.headerButtonCompact : undefined;
  const compactLanguageStyle = compactHeader ? styles.languageButtonCompact : undefined;
  const veryCompactLanguageStyle = veryCompactHeader ? styles.languageButtonVeryCompact : undefined;
  const resolvedShowTopAd = showTopAd ?? isCategoryTopBannerRoute(pathname);
  const navigate = (action: () => void) => {
    const commit = () => {
      beginNavigationPerformanceLock();
      const requestId = beginNavigationTransition(navigationLocation);
      try {
        action();
      } catch (error) {
        completeNavigationTransition(requestId);
        throw error;
      }
    };
    if (onNavigationRequest) {
      onNavigationRequest(commit);
      return;
    }
    commit();
  };

  function openAtlasClub() {
    navigate(() => router.push("/atlas-club"));
  }

  useEffect(() => {
    trackPageViewForAds(pathname);
  }, [pathname, trackPageViewForAds]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollScope = segments[0] === "(tabs)" ? normalizedPathname.split("/").filter(Boolean)[0] ?? "index" : normalizedPathname;
  useEffect(() => subscribeScrollToTop(scrollScope, () => {
    if (usesVirtualizedContent) {
      virtualizedRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }), [scrollScope, usesVirtualizedContent]);

  const viewabilityCallbackRef = useRef(onVirtualizedViewableItemsChanged);
  viewabilityCallbackRef.current = onVirtualizedViewableItemsChanged;
  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: AppChromeVirtualizedItem }[] }) => {
    viewabilityCallbackRef.current?.(viewableItems.map(({ item }) => item.key));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 8, minimumViewTime: 80 }).current;
  const renderVirtualizedItem = useCallback(({ item }: { item: AppChromeVirtualizedItem }) => <VirtualizedSection item={item} />, []);

  async function refreshPage() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshAll();
      setRefreshVersion((value) => value + 1);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.ink }]}>
      <LinearGradient
        colors={getChromeGradient(theme, themeColors)}
        locations={[0, 0.48, 1]}
        style={styles.backdrop}
      />
      <AmbientBackdrop theme={theme} active={isFocused} />
      <ChromeGlass style={[styles.header, themeStyles.header, { paddingHorizontal: horizontalPadding, gap: headerGap }]}>
        {showBackButton ? (
          <Pressable accessibilityRole="button" accessibilityLabel={backToHome ? accessibilityCopy.home : accessibilityCopy.back} hitSlop={5} onPress={() => navigate(() => backToHome ? router.replace("/(tabs)") : router.back())} style={[styles.backButton, themeStyles.headerButton, compactButtonStyle, veryCompactHeader && styles.headerButtonVeryCompact, { width: headerControlSize, height: headerControlSize }]}>
            <Ionicons name={backToHome ? "home" : "arrow-back"} size={20} color={chromeAccent} />
          </Pressable>
        ) : null}
        <View style={styles.titleWrap}>
          {eyebrow && !showBackButton ? <Text style={[styles.eyebrow, { color: themeColors.bronze }]} numberOfLines={1}>{eyebrow.toLocaleUpperCase("tr")}</Text> : null}
          <ChromeTitle title={title} theme={theme} fontSize={titleSize} compact={showBackButton} maxWidth={titleMaxWidth} />
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={accessibilityCopy.notifications} hitSlop={5} onPress={() => navigate(() => router.push("/notifications"))} style={[styles.searchButton, themeStyles.headerButton, compactButtonStyle, veryCompactHeader && styles.headerButtonVeryCompact, { width: headerControlSize, height: headerControlSize }, unreadNotificationCount > 0 && { borderColor: v2Colors.magenta }]}>
            <Ionicons name="notifications" size={19} color={chromeAccent} />
            {unreadNotificationCount > 0 ? (
              <View style={styles.badgeBubble}>
                <Text style={styles.badgeText}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={accessibilityCopy.search} hitSlop={5} onPress={() => setSearchOpen(true)} style={[styles.searchButton, themeStyles.headerButton, compactButtonStyle, veryCompactHeader && styles.headerButtonVeryCompact, { width: headerControlSize, height: headerControlSize }]}>
            <Ionicons name="search" size={19} color={chromeAccent} />
          </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityCopy.language}: ${language.toUpperCase()}`} hitSlop={5} onPress={() => setMenuOpen((value) => !value)} style={[styles.languageButton, themeStyles.headerButton, compactLanguageStyle, veryCompactLanguageStyle, { minWidth: languageButtonWidth, height: headerControlSize }]}>
          {veryCompactHeader ? null : <Ionicons name="language" size={18} color={chromeAccent} />}
          <Text style={[styles.languageText, { color: themeColors.ivory }]}>{language.toUpperCase()}</Text>
        </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={accessibilityCopy.menu} hitSlop={5} onPress={() => setMenuOpen((value) => !value)} style={[styles.searchButton, themeStyles.headerButton, compactButtonStyle, veryCompactHeader && styles.headerButtonVeryCompact, { width: headerControlSize, height: headerControlSize }]}>
            <Ionicons name="menu" size={21} color={chromeAccent} />
          </Pressable>
        </View>
      </ChromeGlass>
      <LanguageMenu expanded={false} onClose={() => setMenuOpen(false)} />
      <AppMenu visible={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onNavigate={navigate} />
      <ProfileSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      {resolvedShowTopAd ? (
        <View style={[styles.topAdWrap, themeStyles.topAdWrap, { paddingHorizontal: horizontalPadding }]}>
          {isAuthenticated && !isEmailVerified ? <EmailVerificationBanner onResend={resendVerificationEmail} /> : null}
          {topAdContent !== undefined ? topAdContent : <AdSlot label={copy.adSlot[language]} compact />}
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.content}
        enabled={keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {usesVirtualizedContent ? (
          <FlatList
            ref={virtualizedRef}
            data={virtualizedItems as AppChromeVirtualizedItem[]}
            renderItem={renderVirtualizedItem}
            keyExtractor={(item) => item.key}
            style={styles.content}
            contentContainerStyle={[styles.contentContainer, { paddingHorizontal: horizontalPadding, paddingBottom: contentBottomPadding }]}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={beginScrollPerformanceLock}
            onScrollEndDrag={endScrollPerformanceLock}
            onMomentumScrollBegin={beginScrollPerformanceLock}
            onMomentumScrollEnd={endScrollPerformanceLock}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPage} tintColor={chromeAccent} colors={[chromeAccent]} progressBackgroundColor={themeColors.panel} />}
            initialNumToRender={virtualizedInitialNumToRender}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={48}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollToIndexFailed={({ index }) => requestAnimationFrame(() => virtualizedRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 }))}
          />
        ) : (
          <Content
            ref={scroll ? scrollRef : undefined}
            style={styles.content}
            contentContainerStyle={scroll ? [styles.contentContainer, { paddingHorizontal: horizontalPadding, paddingBottom: contentBottomPadding }] : undefined}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={scroll ? beginScrollPerformanceLock : undefined}
            onScrollEndDrag={scroll ? endScrollPerformanceLock : undefined}
            onMomentumScrollBegin={scroll ? beginScrollPerformanceLock : undefined}
            onMomentumScrollEnd={scroll ? endScrollPerformanceLock : undefined}
            bounces
            alwaysBounceVertical={scroll}
            overScrollMode="always"
            keyboardShouldPersistTaps={scroll ? "handled" : undefined}
            refreshControl={scroll ? <RefreshControl refreshing={refreshing} onRefresh={refreshPage} tintColor={chromeAccent} colors={[chromeAccent]} progressBackgroundColor={themeColors.panel} /> : undefined}
          >
            <View style={!scroll ? styles.staticChild : undefined}>{typeof children === "function" ? children(refreshVersion) : children}</View>
          </Content>
        )}
      </KeyboardAvoidingView>
      {fixedFooter ? (
        <View pointerEvents="box-none" style={[styles.fixedFooterHost, { left: horizontalPadding, right: horizontalPadding, bottom: fixedFooterBottom }]}>
          {fixedFooter}
        </View>
      ) : null}
      {hasFloatingShortcuts ? (
        <View pointerEvents="box-none" style={[styles.floatingActions, { right: horizontalPadding, bottom: floatingBottom, gap: width < 360 ? 7 : navigationLayout.floatingActionGap }]}>
          {shortcutVisibility.showAtlasClub ? (
            <FloatingShortcutButton
              accessibilityLabel={t(homeCopy.atlasClub, language)}
              accessibilityHint={t(homeCopy.atlasClubHint, language)}
              label={width < 390 ? "Club" : t(homeCopy.atlasClub, language)}
              onPress={openAtlasClub}
              reducedMotion={reducedMotion}
              variant="violet"
            >
              <Ionicons name="sparkles" size={13} color="#EEEAFE" />
            </FloatingShortcutButton>
          ) : null}
          {shortcutVisibility.showPremium ? (
            <FloatingShortcutButton
              accessibilityLabel={accessibilityCopy.premium}
              label={accessibilityCopy.premium}
              onPress={() => navigate(() => router.push("/premium" as never))}
              reducedMotion={reducedMotion}
              variant="gold"
            >
              <Ionicons name={account.isPremium ? "diamond" : "diamond-outline"} size={13} color="#E8D18F" />
            </FloatingShortcutButton>
          ) : null}
          {showFloatingCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={floatingCreateAction.label}
              accessibilityHint={floatingCreateAction.accessibilityHint}
              hitSlop={4}
              onPress={floatingCreateAction.onPress}
              style={({ pressed }) => [
                styles.floatingShortcut,
                styles.createPostShortcut,
                pressed && styles.floatingShortcutPressed
              ]}
            >
              <Ionicons name="create-outline" size={19} color="#ffffff" />
              <View pointerEvents="none" style={styles.createPostSparkle}>
                <Ionicons name="sparkles" size={8} color="#ffffff" />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showBottomDock ? <BottomDock themeColors={themeColors} pathname={pathname} theme={theme} onActiveTabPress={() => usesVirtualizedContent ? virtualizedRef.current?.scrollToOffset({ offset: 0, animated: true }) : scrollRef.current?.scrollTo({ y: 0, animated: true })} onNavigate={navigate} /> : null}
      <GlobalAdOverlays />
      <LanguageGate />
      <LegalGate />
    </SafeAreaView>
  );
}

function FloatingShortcutButton({ accessibilityLabel, accessibilityHint, label, onPress, reducedMotion, variant, children }: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  label: string;
  onPress: () => void;
  reducedMotion: boolean;
  variant: "violet" | "gold";
  children: ReactNode;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);

  function setPressed(pressed: boolean) {
    press.stopAnimation();
    if (reducedMotion) {
      press.setValue(0);
      return;
    }
    Animated.timing(press, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? 100 : 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  }

  const violet = variant === "violet";
  const gradient = violet
    ? ["#4841A3", "#312E6F"] as const
    : ["#594721", "#3D321D"] as const;

  return (
    <Animated.View
      style={[
        styles.floatingShortcutMotion,
        violet ? styles.atlasClubShortcut : styles.premiumShortcut,
        {
          transform: [{ scale: reducedMotion ? 1 : press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) }]
        }
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        hitSlop={4}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={({ pressed }) => [
          styles.floatingPill,
          violet ? styles.floatingPillViolet : styles.floatingPillGold,
          hovered && styles.floatingPillHovered,
          pressed && styles.floatingPillPressed
        ]}
      >
        {Platform.OS === "android" ? null : <ClippedGradient colors={gradient} start={{ x: 0.06, y: 0.08 }} end={{ x: 0.94, y: 0.92 }} radius={18} pointerEvents="none" />}
        <View pointerEvents="none" style={[styles.floatingPillHoverWash, violet ? styles.floatingPillHoverWashViolet : styles.floatingPillHoverWashGold, hovered && styles.floatingPillHoverWashVisible]} />
        {children}
        <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.floatingPillLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function EmailVerificationBanner({ onResend }: { onResend: () => Promise<{ ok: boolean; message: string }> }) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const themeColors = getThemeColors(theme);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const result = await onResend();
    setMessage(result.message);
    setSending(false);
  }

  return (
    <View style={[styles.verifyBanner, { borderColor: themeColors.gold, backgroundColor: themeColors.panel }]}>
      <View style={styles.verifyTextWrap}>
        <Ionicons name="mail-unread-outline" size={18} color={themeColors.gold} />
        <Text style={[styles.verifyText, { color: themeColors.ivory }]}>
          {language === "tr"
            ? "E-posta adresinizi doğrulayın. Bazı özellikler doğrulamadan sonra açılır."
            : language === "ru"
              ? "Подтвердите e-mail. Некоторые функции откроются после подтверждения."
              : language === "uz"
                ? "E-pochtangizni tasdiqlang. Ayrim funksiyalar tasdiqdan keyin ochiladi."
                : "Verify your email. Some features unlock after verification."}
        </Text>
      </View>
      <Pressable onPress={resend} disabled={sending} style={[styles.verifyButton, { backgroundColor: themeColors.gold }, sending && { opacity: 0.7 }]}>
        <Text style={[styles.verifyButtonText, { color: themeColors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
          {sending
            ? language === "tr" ? "Gönderiliyor" : "Sending"
            : language === "tr" ? "Tekrar gönder" : language === "ru" ? "Отправить снова" : language === "uz" ? "Qayta yuborish" : "Resend"}
        </Text>
      </Pressable>
      {message ? <Text style={[styles.verifyMessage, { color: themeColors.gold }]}>{message}</Text> : null}
    </View>
  );
}

function AppMenu({ visible, onClose, theme, onNavigate }: { visible: boolean; onClose: () => void; theme: AppTheme; onNavigate: (navigate: () => void) => void }) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { isAuthenticated, logout } = useAccount();
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themeColors = getThemeColors(theme);
  const themeStyles = useMemo(() => makeChromeThemeStyles(themeColors, theme), [themeColors, theme]);
  const primaryItems = [
    { title: language === "tr" ? "Müze Keşfi" : language === "ru" ? "Поиск музеев" : language === "uz" ? "Muzey kashfiyoti" : "Museum Explore", icon: "map-outline", path: "/museum-find" },
    { title: language === "tr" ? "Sanatçılar" : language === "ru" ? "Художники" : language === "uz" ? "San'atkorlar" : "Artists", icon: "people-outline", path: "/artists" },
    { title: language === "tr" ? "Profil Keşfet" : language === "ru" ? "Поиск профилей" : language === "uz" ? "Profillarni kashf et" : "Discover Profiles", icon: "compass-outline", path: "/discover" },
    { title: copy.ranking[language], icon: "bar-chart-outline", path: "/leaderboards" },
    { title: language === "tr" ? "Roller / Rozetler" : language === "ru" ? "Роли / значки" : language === "uz" ? "Rollar / nishonlar" : "Roles / Badges", icon: "ribbon-outline", path: "/roles-badges" },
    { title: uiCopy.inviteFriend[language], icon: "share-social-outline", path: "/invite" },
  ] as const;
  const secondaryItems = [
    { title: language === "tr" ? "Profil Ziyaretleri" : language === "ru" ? "Посещения профиля" : language === "uz" ? "Profil tashriflari" : "Profile Visits", icon: "eye-outline", path: "/profile-visits" },
    { title: language === "tr" ? "Sanatçıya Mektup" : language === "ru" ? "Письмо художнику" : language === "uz" ? "Rassomga maktub" : "Letter to the Artist", icon: "mail-outline", path: "/time-capsule" },
    { title: uiCopy.about[language], icon: "information-circle-outline", path: "/about" },
    { title: uiCopy.support[language], icon: "help-circle-outline", path: "/support" },
    ...(isAuthenticated ? [{ title: language === "tr" ? "Engellenenler" : language === "ru" ? "Заблокированные" : language === "uz" ? "Bloklanganlar" : "Blocked users", icon: "ban-outline" as const, path: "/blocked-users" as const }] : []),
    { title: uiCopy.settings[language], icon: "settings-outline", path: "/settings" }
  ] as const;

  function open(path: string) {
    onClose();
    onNavigate(() => router.push(path as never));
  }

  function signOutFromMenu() {
    onClose();
    onNavigate(() => {
      void logout().then(() => router.replace("/(tabs)/account"));
    });
  }

  function openThemePicker() {
    onClose();
    setThemePickerOpen(true);
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.menuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.menuPanel, themeStyles.panel]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: themeColors.ivory }]}>Art Atlas</Text>
              <Pressable onPress={onClose} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={themeColors.ivory} />
              </Pressable>
            </View>
            <View style={styles.menuLangRow}>
              {(["tr", "en", "ru", "uz"] as const).map((code) => (
                <Pressable key={code} onPress={() => setLanguage(code)} style={[styles.menuLang, { backgroundColor: themeColors.panelSoft }, language === code && { backgroundColor: themeColors.gold }]}>
                  <Text style={[styles.menuLangText, { color: themeColors.ivory }, language === code && { color: themeColors.ink }]}>{code.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            {primaryItems.map((item) => (
              <Pressable key={item.path} onPress={() => open(item.path)} style={styles.menuRow}>
                <Ionicons name={item.icon} size={19} color={themeColors.gold} />
                <Text style={[styles.menuRowText, { color: themeColors.ivory }]}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={17} color={themeColors.muted} />
              </Pressable>
            ))}
            <View style={[styles.menuDivider, { backgroundColor: themeColors.line }]} />
            {secondaryItems.map((item) => (
              <Pressable key={item.path} onPress={() => open(item.path)} style={styles.menuRow}>
                <Ionicons name={item.icon} size={19} color={themeColors.gold} />
                <Text style={[styles.menuRowText, { color: themeColors.ivory }]}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={17} color={themeColors.muted} />
              </Pressable>
            ))}
            <Pressable onPress={openThemePicker} style={styles.menuRow}>
              <Ionicons name={getThemeMenuIcon(theme)} size={19} color={themeColors.gold} />
              <Text style={[styles.menuRowText, { color: themeColors.ivory }]}>
                {language === "tr" ? "Tema seç" : language === "ru" ? "Выбрать тему" : language === "uz" ? "Mavzu tanlash" : "Choose theme"}
              </Text>
              <Text style={[styles.menuThemeText, { color: themeColors.gold }]}>
                {getThemePickerLabel(theme, language)}
              </Text>
            </Pressable>
            {isAuthenticated ? (
              <Pressable onPress={signOutFromMenu} style={[styles.menuRow, styles.menuLogoutRow]}>
                <Ionicons name="log-out-outline" size={19} color={themeColors.gold} />
                <Text style={[styles.menuRowText, { color: themeColors.ivory }]}>
                  {language === "tr" ? "Çıkış yap" : language === "ru" ? "Выйти" : language === "uz" ? "Chiqish" : "Log out"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
      <ThemePickerModal visible={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
    </>
  );
}

function ProfileSearchModal({ visible, onClose, onNavigate }: { visible: boolean; onClose: () => void; onNavigate: (navigate: () => void) => void }) {
  const router = useRouter();
  const { language } = useLanguage();
  const { account, isAuthenticated } = useAccount();
  const { items } = useCommunityArt();
  const { visibleSuggestedUsers } = useSocial();
  const { theme } = useAppTheme();
  const themeColors = getThemeColors(theme);
  const themeStyles = useMemo(() => makeChromeThemeStyles(themeColors, theme), [themeColors, theme]);
  const [query, setQuery] = useState("");
  const profiles = useMemo(() => {
    const names = new Map<string, { uid?: string; name: string; username?: string; role: UserRoleId; searchText: string; count: number; score: number; image?: string }>();

    visibleSuggestedUsers.forEach((user) => {
      const key = user.username.trim().toLocaleLowerCase("tr");
      names.set(key, {
        uid: user.uid,
        name: user.name,
        username: user.username,
        role: user.role,
        searchText: `${user.name} ${user.username}`,
        count: names.get(key)?.count ?? 0,
        score: names.get(key)?.score ?? 0,
        image: user.image
      });
    });

    items.forEach((item) => {
      const key = (item.uploaderUsername || item.artistName).trim().toLocaleLowerCase("tr");
      const current = names.get(key);
      names.set(key, {
        uid: current?.uid ?? item.ownerId,
        name: item.artistName,
        username: item.uploaderUsername || current?.username,
        role: current?.role ?? "artist",
        searchText: `${item.artistName} ${item.uploaderUsername ?? ""}`,
        count: (current?.count ?? 0) + 1,
        score: (current?.score ?? 0) + item.likes - item.dislikes,
        image: current?.image
      });
    });

    const accountKey = account.username.trim().toLocaleLowerCase("tr");
    names.set(accountKey, {
      uid: account.uid,
      name: account.displayName,
      username: account.username,
      role: account.role,
      searchText: `${account.displayName} ${account.username}`,
      count: names.get(accountKey)?.count ?? 0,
      score: Math.max(names.get(accountKey)?.score ?? 0, account.totalScore),
      image: account.avatar
    });

    return [...names.values()].sort((a, b) => b.score - a.score);
  }, [account.avatar, account.displayName, account.role, account.totalScore, account.uid, account.username, items, visibleSuggestedUsers]);
  const filteredProfiles = profiles.filter((profile) =>
    profile.searchText.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))
  ).slice(0, 20);
  const hasQuery = query.trim().length > 0;

  function openProfile(profile: { uid?: string; name: string; username?: string }) {
    onClose();
    setQuery("");
    if (isAuthenticated) {
      onNavigate(() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(profile) } }));
    } else {
      onNavigate(() => router.push("/(tabs)/account"));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.searchOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.searchModal, themeStyles.panel]}>
          <View style={styles.searchHeader}>
            <Text style={[styles.searchTitle, { color: themeColors.ivory }]}>
              {language === "tr" ? "Üye ara" : language === "ru" ? "Поиск участника" : language === "uz" ? "A'zo qidirish" : "Search members"}
            </Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} color={themeColors.ivory} />
            </Pressable>
          </View>
          <View style={[styles.searchInputWrap, { backgroundColor: themeColors.panelSoft, borderBottomColor: themeColors.line }]}>
            <Ionicons name="search" size={18} color={themeColors.gold} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder={language === "tr" ? "İsim, soyisim veya kullanıcı adı" : language === "ru" ? "Имя, фамилия или логин" : language === "uz" ? "Ism, familiya yoki username" : "Name, surname, or username"}
              placeholderTextColor={themeColors.muted}
              style={[styles.memberSearchInput, { color: themeColors.ivory }]}
            />
          </View>
          {!isAuthenticated ? (
            <View style={styles.memberLock}>
              <Ionicons name="lock-closed" size={26} color={themeColors.gold} />
              <Text style={[styles.searchHint, { color: themeColors.muted }]}>
                {{
                  tr: "Üye profillerini görmek için giriş yapmalısın.",
                  en: "Log in to view member profiles.",
                  ru: "Чтобы смотреть профили участников, войдите в аккаунт.",
                  uz: "A'zolar profillarini ko'rish uchun kirish kerak."
                }[language]}
              </Text>
              <Pressable onPress={() => openProfile({ name: "" })} style={[styles.searchLoginButton, { backgroundColor: themeColors.gold }]}>
              <Text style={[styles.searchLoginText, { color: themeColors.ink }]}>{uiCopy.loginRegister[language]}</Text>
              </Pressable>
            </View>
          ) : (
          <View style={styles.memberResults}>
            {hasQuery ? filteredProfiles.length ? filteredProfiles.map((profile) => (
              <Pressable key={profile.username ?? profile.name} onPress={() => openProfile(profile)} style={[styles.memberResultRow, { borderBottomColor: themeColors.line }]}>
                <ProfileAvatar uri={profile.image} size={38} />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={[styles.memberName, { color: themeColors.ivory }]}>{profile.name}</Text>
                    <Ionicons name={profile.role === "artist" ? "brush" : "heart"} size={13} color={themeColors.gold} />
                  </View>
                  {profile.username ? <Text style={[styles.memberUsername, { color: themeColors.gold }]}>@{profile.username}</Text> : null}
                  <Text style={[styles.memberMeta, { color: themeColors.muted }]}>
                    {profile.count} {language === "tr" ? "eser" : language === "ru" ? "работ" : language === "uz" ? "asar" : "artworks"} · {profile.score}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={themeColors.muted} />
              </Pressable>
            )) : (
              <Text style={[styles.searchEmpty, { color: themeColors.muted }]}>
                {language === "tr" ? "Uygun üye bulunamadı." : language === "ru" ? "Участник не найден." : language === "uz" ? "Mos a'zo topilmadi." : "No matching member found."}
              </Text>
            ) : (
              <Text style={[styles.searchHint, { color: themeColors.muted }]}>
                {language === "tr" ? "Aramak istediğin kişinin adını yaz." : language === "ru" ? "Введите имя участника." : language === "uz" ? "Qidirmoqchi bo'lgan a'zoning ismini yozing." : "Type the member name to search."}
              </Text>
            )}
          </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function AdSlot({ label, compact = false, placement = "category_top" }: { label: string; compact?: boolean; placement?: AdDocument["placement"] | AdPlacementId }) {
  const { theme } = useAppTheme();
  const { adsEnabled, getAdForPlacement } = useAds();
  const themeColors = getThemeColors(theme);
  const ad = getAdForPlacement(placement);
  const [adMobFailed, setAdMobFailed] = useState(false);
  const image = ad?.imageURL || ad?.image;
  useEffect(() => setAdMobFailed(false), [ad?.admobUnitId, ad?.id]);
  if (!adsEnabled) {
    return null;
  }

  if (!ad) {
    return null;
  }

  if (isAdMobDelivery(ad)) {
    if (Platform.OS === "web") return null;
    if (adMobFailed || !canUseAdMobUnit(ad.admobUnitId)) return null;
    return (
      <View style={[styles.adSlot, { borderColor: themeColors.line, backgroundColor: adSlotBackground(theme, themeColors) }, compact && styles.adSlotCompact]}>
        <AdMobBannerView unitId={ad.admobUnitId!} compact={compact} onUnavailable={() => setAdMobFailed(true)} />
      </View>
    );
  }

  function openAd() {
    if (ad?.linkURL) {
      Linking.openURL(ad.linkURL).catch(() => undefined);
    }
  }

  return (
    <Pressable
      onPress={openAd}
      disabled={!ad?.linkURL}
      style={[styles.adSlot, { borderColor: themeColors.line, backgroundColor: adSlotBackground(theme, themeColors) }, compact && styles.adSlotCompact]}
    >
      {image ? (
        <Image source={{ uri: image }} style={[styles.adImage, compact && styles.adImageCompact]} />
      ) : (
        <>
          <Ionicons name="sparkles-outline" size={18} color={v2Colors.primary} />
          <View style={styles.adTextBlock}>
            <Text style={[styles.adText, { color: ad ? themeColors.ivory : themeColors.muted }]} numberOfLines={compact ? 1 : 2}>
              {ad?.title || label}
            </Text>
            {ad?.body ? <Text style={[styles.adMeta, { color: themeColors.muted }]} numberOfLines={compact ? 1 : 2}>{ad.body}</Text> : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

function BottomDock({ themeColors, pathname, onActiveTabPress, theme, onNavigate }: { themeColors: ReturnType<typeof getThemeColors>; pathname: string; onActiveTabPress: () => void; theme: AppTheme; onNavigate: (navigate: () => void) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const messageBadgeCount = useMessageBadgeCount();
  const { language } = useLanguage();
  const isLight = isBrightTheme(theme);
  const activeTone = "#ffffff";
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const optimisticResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = [
    { path: "/", icon: "home" },
    { path: "/gallery", icon: "easel" },
    { path: "/feed", icon: "newspaper" },
    { path: "/messages", icon: "mail" },
    { path: "/account", icon: "person-circle" }
  ] as const;

  useEffect(() => {
    if (!optimisticPath) return;
    const reachedPath = pathname === optimisticPath
      || (optimisticPath !== "/" && pathname.startsWith(optimisticPath));
    if (!reachedPath) return;
    setOptimisticPath(null);
    if (optimisticResetRef.current) clearTimeout(optimisticResetRef.current);
    optimisticResetRef.current = null;
  }, [optimisticPath, pathname]);

  useEffect(() => () => {
    if (optimisticResetRef.current) clearTimeout(optimisticResetRef.current);
  }, []);

  function showImmediateSelection(path: string) {
    if (optimisticResetRef.current) clearTimeout(optimisticResetRef.current);
    setOptimisticPath(path);
    optimisticResetRef.current = setTimeout(() => setOptimisticPath(null), 1200);
  }

  return (
    <View style={[styles.bottomDockOuter, { paddingBottom: Math.max(insets.bottom, navigationLayout.minimumBottomInset) }]}>
      <ChromeGlass
        intensity={isLight ? 48 : 36}
        tint={isLight ? "light" : "dark"}
        style={[
          styles.bottomDock,
          {
            borderColor: isLight ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.10)",
            backgroundColor: dockBackground(theme, themeColors)
          }
        ]}
      >
        {items.map((item) => {
          const routeActive = pathname === item.path
            || (item.path !== "/" && pathname.startsWith(item.path))
            || (item.path === "/messages" && pathname.startsWith("/messages"));
          const active = optimisticPath ? optimisticPath === item.path : routeActive;
          return (
            <Pressable accessibilityRole="tab" accessibilityLabel={dockLabel(item.path, language)} accessibilityState={{ selected: active }} key={item.path} onPressIn={() => {
              if (!routeActive) showImmediateSelection(item.path);
            }} onPress={() => routeActive ? onActiveTabPress() : onNavigate(() => router.push(item.path as never))} style={styles.bottomDockButton}>
              {active ? Platform.OS === "android"
                ? <View style={styles.bottomDockActivePill} />
                : <LinearGradient colors={[v2Colors.primary, v2Colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bottomDockActivePill} />
                : null}
              <View style={styles.bottomDockIconWrap}>
                <Ionicons name={active ? item.icon : `${item.icon}-outline` as keyof typeof Ionicons.glyphMap} size={21} color={active ? activeTone : themeColors.muted} />
                {item.path === "/messages" && messageBadgeCount > 0 ? (
                  <View style={[styles.bottomDockBadge, { backgroundColor: v2Colors.magenta }]}>
                    <Text style={styles.bottomDockBadgeText}>{messageBadgeCount > 99 ? "99+" : String(messageBadgeCount)}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ChromeGlass>
    </View>
  );
}

function ChromeGlass({ children, style }: { children: ReactNode; intensity?: number; tint?: "light" | "dark"; style: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

function makeChromeThemeStyles(c: ReturnType<typeof getThemeColors>, theme: AppTheme) {
  const isLight = isBrightTheme(theme);
  return {
    header: {
      backgroundColor: isLight ? "rgba(248,250,252,0.72)" : "rgba(7,10,18,0.72)",
      borderBottomColor: hairline(theme)
    },
    headerButton: {
      backgroundColor: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.08)",
      borderColor: isLight ? "rgba(155,116,45,0.2)" : "rgba(255,255,255,0.12)",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: Platform.OS === "android" ? 0 : isLight ? 0.06 : 0.16,
      shadowRadius: Platform.OS === "android" ? 0 : 5,
      elevation: Platform.OS === "android" ? 0 : 2
    },
    topAdWrap: {
      backgroundColor: isLight ? "rgba(241,245,249,0.72)" : "rgba(11,16,32,0.64)",
      borderBottomColor: c.line
    },
    panel: {
      backgroundColor: c.panel,
      borderColor: isLight ? "rgba(99,102,241,0.18)" : v2Colors.border
    }
  };
}

function getChromeGradient(theme: AppTheme, themeColors: ReturnType<typeof getThemeColors>) {
  if (theme === "light") return ["#293142", "#3B465B", "#252D3D"] as [string, string, string];
  if (theme === "vangogh") return ["#091628", "#123b67", "#1f5f91"] as [string, string, string];
  if (theme === "monet") return ["#16373A", "#28514F", "#1B3D45"] as [string, string, string];
  if (theme === "dali") return ["#070A12", "#17112D", "#0B1020"] as [string, string, string];
  if (theme === "picasso") return ["#202A42", "#33466B", "#382D3C"] as [string, string, string];
  return [v2Colors.background, v2Colors.backgroundSecondary, v2Colors.background] as [string, string, string];
}

function getThemeMenuIcon(theme: AppTheme): keyof typeof Ionicons.glyphMap {
  if (theme === "dark") return "sunny-outline";
  if (theme === "light") return "star-outline";
  if (theme === "vangogh") return "moon-outline";
  if (theme === "monet") return "water-outline";
  if (theme === "dali") return "hourglass-outline";
  return "shapes-outline";
}

function adSlotBackground(theme: AppTheme, themeColors: ReturnType<typeof getThemeColors>) {
  if (isBrightTheme(theme)) return "rgba(255,250,241,0.74)";
  if (theme === "vangogh") return "rgba(16,42,70,0.72)";
  if (theme === "dali") return "rgba(20,18,37,0.72)";
  return theme === "dark" ? v2Colors.glass : themeColors.glass;
}

function dockBackground(theme: AppTheme, themeColors: ReturnType<typeof getThemeColors>) {
  if (isBrightTheme(theme)) return "rgba(255,250,241,0.82)";
  if (theme === "vangogh") return "rgba(9,22,40,0.78)";
  if (theme === "dali") return "rgba(23,17,11,0.82)";
  return themeColors.glass;
}

function chromeAccessibilityCopy(language: "tr" | "en" | "ru" | "uz") {
  return {
    tr: { back: "Geri", home: "Ana sayfa", notifications: "Bildirimler", search: "Ara", language: "Dil", menu: "Menü", premium: "Premium" },
    en: { back: "Back", home: "Home", notifications: "Notifications", search: "Search", language: "Language", menu: "Menu", premium: "Premium" },
    ru: { back: "Назад", home: "Главная", notifications: "Уведомления", search: "Поиск", language: "Язык", menu: "Меню", premium: "Премиум" },
    uz: { back: "Orqaga", home: "Bosh sahifa", notifications: "Bildirishnomalar", search: "Qidirish", language: "Til", menu: "Menyu", premium: "Premium" }
  }[language];
}

function dockLabel(path: string, language: "tr" | "en" | "ru" | "uz") {
  const labels = {
    tr: ["Ana sayfa", "Eserler", "Keşfet", "Mesajlar", "Profil"],
    en: ["Home", "Gallery", "Discover", "Messages", "Profile"],
    ru: ["Главная", "Галерея", "Лента", "Сообщения", "Профиль"],
    uz: ["Bosh sahifa", "Asarlar", "Kashfiyot", "Xabarlar", "Profil"]
  }[language];
  const index = ["/", "/gallery", "/feed", "/messages", "/account"].indexOf(path);
  return labels[Math.max(0, index)];
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(7,10,18,0.82)"
  },
  headerLight: {
    backgroundColor: "rgba(247,242,232,0.86)",
    borderBottomColor: "rgba(60,45,30,0.12)"
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    overflow: "hidden"
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.6,
    marginBottom: 3
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900"
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center"
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center"
  },
  headerButtonCompact: {
    width: 38,
    height: 38
  },
  headerButtonVeryCompact: {
    width: 34,
    height: 34,
    borderRadius: 999
  },
  badgeBubble: {
    position: "absolute",
    right: -5,
    top: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: v2Colors.magenta,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900"
  },
  verifyBanner: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 8
  },
  verifyTextWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  verifyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  verifyButton: {
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  verifyButtonText: {
    fontSize: 12,
    fontWeight: "900"
  },
  verifyMessage: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  languageButton: {
    height: 42,
    minWidth: 76,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1b1b1b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 8
  },
  languageButtonCompact: {
    height: 38,
    minWidth: 58,
    gap: 4
  },
  languageButtonVeryCompact: {
    minWidth: 46,
    gap: 0,
    paddingHorizontal: 5
  },
  languageText: {
    color: colors.ivory,
    fontWeight: "800"
  },
  content: {
    flex: 1
  },
  staticChild: {
    flex: 1
  },
  contentContainer: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 32
  },
  floatingActions: {
    position: "absolute",
    zIndex: 18,
    elevation: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: navigationLayout.floatingActionGap
  },
  fixedFooterHost: {
    position: "absolute",
    zIndex: 20,
    elevation: 16,
    alignItems: "center"
  },
  floatingShortcutMotion: {
    height: navigationLayout.floatingActionSize,
    borderRadius: navigationLayout.floatingActionSize / 2,
    justifyContent: "center"
  },
  floatingShortcut: {
    width: navigationLayout.floatingActionSize,
    height: navigationLayout.floatingActionSize,
    borderRadius: navigationLayout.floatingActionSize / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 9,
    overflow: "hidden"
  },
  floatingPill: {
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
    cursor: "pointer"
  },
  floatingPillViolet: {
    borderColor: "rgba(208,205,255,0.28)",
    backgroundColor: "#373277"
  },
  floatingPillGold: {
    borderColor: "rgba(242,217,151,0.3)",
    backgroundColor: "#493A20"
  },
  floatingPillLabel: {
    color: "#FFFDF8",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    letterSpacing: 0,
    flexShrink: 0
  },
  floatingPillHoverWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0
  },
  floatingPillHoverWashViolet: {
    backgroundColor: "rgba(230,226,255,0.1)"
  },
  floatingPillHoverWashGold: {
    backgroundColor: "rgba(255,232,171,0.09)"
  },
  floatingPillHoverWashVisible: {
    opacity: 1
  },
  floatingPillHovered: {
    transform: [{ translateY: -1 }]
  },
  floatingPillPressed: {
    opacity: 0.94
  },
  atlasClubShortcut: {
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  premiumShortcut: {
    shadowColor: "#2B2417",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  createPostShortcut: {
    backgroundColor: "rgba(99,102,241,0.82)",
    borderColor: "rgba(167,139,250,0.72)",
    shadowColor: v2Colors.brightViolet,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10
  },
  floatingShortcutPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9
  },
  createPostSparkle: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: v2Colors.violet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.48)",
    alignItems: "center",
    justifyContent: "center"
  },
  bottomDockOuter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    alignItems: "center"
  },
  bottomDock: {
    width: "100%",
    maxWidth: 420,
    minHeight: navigationLayout.floatingBarHeight,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12
  },
  bottomDockButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  bottomDockActivePill: {
    ...StyleSheet.absoluteFillObject,
    margin: 2,
    borderRadius: 999,
    backgroundColor: v2Colors.primary
  },
  bottomDockIconWrap: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  bottomDockBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  bottomDockBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800"
  },
  topAdWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(11,16,32,0.64)"
  },
  adSlot: {
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: v2Colors.border,
    backgroundColor: v2Colors.surface1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    overflow: "hidden",
    gap: 8,
    marginTop: 16
  },
  adSlotCompact: {
    minHeight: 66,
    marginTop: 10
  },
  adText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1
  },
  adTextBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "center"
  },
  adMeta: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2
  },
  adImage: {
    width: "100%",
    height: 86,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  adImageCompact: {
    width: "100%",
    height: 66
  },
  searchOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    paddingHorizontal: 16,
    paddingTop: 78
  },
  searchModal: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: v2Colors.border,
    backgroundColor: colors.panel,
    overflow: "hidden"
  },
  searchHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  searchTitle: {
    color: colors.ivory,
    fontSize: 17,
    fontWeight: "900"
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  searchInputWrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  memberSearchInput: {
    flex: 1,
    color: colors.ivory,
    fontSize: 15,
    fontWeight: "800"
  },
  memberResults: {
    maxHeight: 420
  },
  memberLock: {
    alignItems: "center",
    padding: 18
  },
  searchLoginButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 8
  },
  searchLoginText: {
    color: colors.ink,
    fontWeight: "900"
  },
  memberResultRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(217, 184, 101, 0.16)",
    alignItems: "center",
    justifyContent: "center"
  },
  memberInitial: {
    color: colors.gold,
    fontWeight: "900"
  },
  memberInfo: {
    flex: 1
  },
  memberName: {
    color: colors.ivory,
    fontWeight: "900",
    flexShrink: 1
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  memberUsername: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  searchEmpty: {
    color: colors.muted,
    padding: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  searchHint: {
    color: colors.muted,
    padding: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingTop: 72,
    paddingHorizontal: 14
  },
  menuPanel: {
    marginLeft: "auto",
    width: 292,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: v2Colors.border,
    backgroundColor: colors.panel,
    padding: 10
  },
  menuHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  menuTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900"
  },
  menuLangRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8
  },
  menuLang: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  menuLangActive: {
    backgroundColor: colors.gold
  },
  menuLangText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  menuLangTextActive: {
    color: colors.ink
  },
  menuRow: {
    minHeight: 46,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10
  },
  menuDivider: {
    height: 1,
    marginVertical: 6
  },
  menuRowText: {
    color: colors.ivory,
    fontWeight: "900",
    flex: 1
  },
  menuPremiumRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.55)",
    backgroundColor: "rgba(217,184,101,0.12)",
    paddingHorizontal: 8
  },
  menuPremiumText: {
    color: "#f5d98d",
    fontSize: 15
  },
  menuThemeText: {
    color: colors.gold,
    fontWeight: "900"
  },
  menuLogoutRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(217,184,101,0.18)"
  }
});
