import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlassSurface } from "@/components/ui/glass-surface";
import { PressableScale } from "@/components/ui/pressable-scale";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { homeCopy } from "@/app/i18n/common";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { useLanguage } from "@/hooks/use-language";
import type { CommunityArtwork } from "@/providers/community-art-provider";
import type { DiscoveryPost } from "@/providers/discovery-post-provider";
import type { SuggestedUser } from "@/providers/social-provider";
import { resolveCountryCodeFromUser } from "@/utils/country-utils";
import { profileRouteParam } from "@/utils/profile-route";
import { t } from "@/utils/localized-text";
import { HomeImage } from "./home-image";

export function FollowingActivity({ theme, artworks, posts }: { theme: AppTheme; artworks: CommunityArtwork[]; posts: DiscoveryPost[] }) {
  const { language } = useLanguage();
  const router = useRouter();
  const colors = getThemeColors(theme);
  const styles = createStyles(theme);
  const [mode, setMode] = useState<"images" | "posts">("images");
  const hasItems = mode === "images" ? artworks.length > 0 : posts.length > 0;
  return (
    <View style={styles.section}>
      <SectionHeading
        theme={theme}
        title={t(homeCopy.following, language)}
        action={(
          <View style={styles.modeTabs}>
            {(["images", "posts"] as const).map((item) => (
              <PressableScale
                key={item}
                onPress={() => setMode(item)}
                style={[styles.modeTab, mode === item && styles.modeTabActive]}
                accessibilityLabel={t(item === "images" ? homeCopy.images : homeCopy.posts, language)}
                accessibilityState={{ selected: mode === item }}
              >
                <Ionicons name={item === "images" ? "images-outline" : "document-text-outline"} size={15} color={mode === item ? "#ffffff" : colors.ivory} />
              </PressableScale>
            ))}
          </View>
        )}
      />
      {!hasItems ? (
        <GlassSurface theme={theme} radius={radii.md} level="low" contentStyle={styles.empty}>
          <Ionicons name="compass-outline" size={25} color={v2Colors.primary} />
          <Text style={styles.emptyText}>{t(homeCopy.followingEmpty, language)}</Text>
          <PressableScale onPress={() => router.push("/discover")} style={styles.emptyAction} accessibilityLabel={t(homeCopy.discover, language)}>
            <Text style={styles.emptyActionText}>{t(homeCopy.discover, language)}</Text>
          </PressableScale>
        </GlassSurface>
      ) : mode === "images" ? (
        <View style={styles.artGrid}>
          {artworks.map((artwork) => (
            <PressableScale
              key={artwork.id}
              onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: artwork.uploaderUsername, displayName: artwork.artistName, uid: artwork.ownerId }) } })}
              wrapStyle={styles.artCardWrap}
              style={styles.artCard}
              accessibilityLabel={`${artwork.title}, ${artwork.artistName}`}
            >
              <HomeImage uri={artwork.image} style={styles.artImage} contentFit="cover" transition={180} />
              <LinearGradient colors={["rgba(5,6,16,0)", "rgba(5,6,16,0.9)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.artBody}>
                <Text style={styles.artTitle} numberOfLines={2}>{artwork.title}</Text>
                <Text style={styles.artArtist} numberOfLines={1}>{artwork.artistName}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : (
        <View style={styles.postList}>
          {posts.map((post) => (
            <PressableScale key={post.id} onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })} accessibilityLabel={`${post.author}: ${post.text}`}>
              <GlassSurface theme={theme} radius={radii.md} level="low" contentStyle={styles.postCard}>
                <ProfileAvatar uri={post.authorPhotoURL} size={38} />
                <View style={styles.postBody}>
                  <Text style={styles.postAuthor} numberOfLines={1}>{post.author}</Text>
                  <Text style={styles.postText} numberOfLines={3}>{post.text}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </GlassSurface>
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

export function SuggestedProfiles({ theme, users }: { theme: AppTheme; users: SuggestedUser[] }) {
  const { language } = useLanguage();
  const router = useRouter();
  const styles = createStyles(theme);
  if (!users.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeading
        theme={theme}
        title={t(homeCopy.suggestedUsers, language)}
        action={(
          <PressableScale onPress={() => router.push("/discover")} style={styles.allProfilesButton} accessibilityLabel={language === "tr" ? "Tüm profilleri gör" : "See all profiles"}>
            <Text style={styles.allProfilesText}>{language === "tr" ? "Tümünü Gör" : language === "ru" ? "Смотреть все" : language === "uz" ? "Barchasini ko'rish" : "See All"}</Text>
            <Ionicons name="arrow-forward" size={14} color={v2Colors.cyan} />
          </PressableScale>
        )}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileRail} decelerationRate="fast">
        {users.slice(0, 5).map((user) => (
          <PressableScale key={user.uid || user.username} onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } })} wrapStyle={styles.profilePortraitWrap} style={styles.profilePortrait} accessibilityLabel={`${user.name}, @${user.username}`}>
            <LinearGradient colors={["rgba(49,95,234,0.18)", "rgba(17,24,49,0.98)"]} style={StyleSheet.absoluteFill} />
            <ProfileAvatar uri={user.image} size={82} borderRadius={17} borderColor="rgba(56,215,232,0.24)" />
            <View style={styles.profilePortraitIdentity}>
              <UserNameWithCountry name={user.name} username={user.username} uid={user.uid} countryCode={resolveCountryCodeFromUser(user)} nameStyle={styles.profilePortraitName} />
              <Text style={styles.profilePortraitUsername} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>@{user.username}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const colors = getThemeColors(theme);
  return StyleSheet.create({
    section: { marginTop: 24 },
    modeTabs: { flexDirection: "row", gap: 6 },
    modeTab: { width: homeLayout.minimumTouchTarget, height: homeLayout.minimumTouchTarget, borderRadius: 22, backgroundColor: v2Colors.surface1, borderWidth: 1, borderColor: v2Colors.border, alignItems: "center", justifyContent: "center" },
    modeTabActive: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
    empty: { minHeight: 128, alignItems: "center", justifyContent: "center", padding: 18, gap: 8 },
    emptyText: { ...safeTextLayout, color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: "700", textAlign: "center" },
    emptyAction: { minHeight: homeLayout.minimumTouchTarget, borderRadius: radii.pill, backgroundColor: v2Colors.primary, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
    emptyActionText: { ...safeTextLayout, color: "#ffffff", fontSize: 12, fontWeight: "800" },
    artGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    artCardWrap: { width: "31.2%", minWidth: 92, flexGrow: 1 },
    artCard: { width: "100%", aspectRatio: 0.82, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.panel },
    artImage: { width: "100%", height: "100%", backgroundColor: colors.panelSoft },
    artBody: { position: "absolute", left: 9, right: 9, bottom: 9 },
    artTitle: { ...safeTextLayout, color: "#FFF9F0", fontSize: 11, lineHeight: 14, fontWeight: "900" },
    artArtist: { ...safeTextLayout, color: "rgba(255,249,240,0.68)", fontSize: 9.5, lineHeight: 13, fontWeight: "700", marginTop: 2 },
    postList: { gap: 9 },
    postCard: { minHeight: 76, padding: 12, flexDirection: "row", alignItems: "center", gap: 11 },
    postBody: { flex: 1, minWidth: 0 },
    postAuthor: { ...safeTextLayout, color: colors.ivory, fontSize: 13, lineHeight: 17, fontWeight: "900" },
    postText: { ...safeTextLayout, color: colors.muted, fontSize: 11.5, lineHeight: 16, fontWeight: "600", marginTop: 2 },
    allProfilesButton: { minHeight: 38, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
    allProfilesText: { ...safeTextLayout, color: v2Colors.cyan, fontSize: 10.5, lineHeight: 14, fontWeight: "900" },
    profileRail: { gap: 10, paddingRight: 18 },
    profilePortraitWrap: { width: 132 },
    profilePortrait: { width: 132, minHeight: 166, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", padding: 12, gap: 8, backgroundColor: colors.panel },
    profilePortraitIdentity: { width: "100%", minWidth: 0, alignItems: "center" },
    profilePortraitName: { ...safeTextLayout, color: colors.ivory, fontSize: 12.5, lineHeight: 16, fontWeight: "900", textAlign: "center" },
    profilePortraitUsername: { ...safeTextLayout, color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 2, maxWidth: "100%" }
  });
}
