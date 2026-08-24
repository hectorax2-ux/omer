import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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

export function SuggestedProfiles({ theme, users, onFollow }: { theme: AppTheme; users: SuggestedUser[]; onFollow: (user: SuggestedUser) => void }) {
  const { language } = useLanguage();
  const router = useRouter();
  const styles = createStyles(theme);
  const [limit, setLimit] = useState(3);
  const visible = useMemo(() => users.slice(0, limit), [limit, users]);
  if (!users.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme} title={t(homeCopy.suggestedUsers, language)} />
      <View style={styles.profileList}>
        {visible.map((user) => (
          <PressableScale key={user.uid || user.username} onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } })} accessibilityLabel={`${user.name}, @${user.username}`}>
            <GlassSurface theme={theme} radius={radii.md} level="low" contentStyle={styles.profileCard}>
              <ProfileAvatar uri={user.image} size={46} />
              <View style={styles.profileIdentity}>
                <UserNameWithCountry name={user.name} username={user.username} uid={user.uid} countryCode={resolveCountryCodeFromUser(user)} nameStyle={styles.profileName} />
                <Text style={styles.profileUsername} numberOfLines={1}>@{user.username}</Text>
              </View>
              <PressableScale onPress={() => onFollow(user)} style={styles.followButton} accessibilityLabel={`${t(homeCopy.follow, language)} ${user.name}`}>
                <Ionicons name="person-add" size={15} color="#ffffff" />
                <Text style={styles.followText} numberOfLines={1}>{t(homeCopy.follow, language)}</Text>
              </PressableScale>
            </GlassSurface>
          </PressableScale>
        ))}
      </View>
      {limit < users.length && limit < 20 ? (
        <PressableScale onPress={() => setLimit((value) => Math.min(20, value + 5))} style={styles.moreButton} accessibilityLabel={t(homeCopy.showMore, language)}>
          <Text style={styles.moreText}>{t(homeCopy.showMore, language)}</Text>
          <Ionicons name="chevron-down" size={17} color={v2Colors.primary} />
        </PressableScale>
      ) : null}
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
    profileList: { gap: 9 },
    profileCard: { minHeight: 72, padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
    profileIdentity: { flex: 1, minWidth: 0 },
    profileName: { ...safeTextLayout, color: colors.ivory, fontSize: 13.5, lineHeight: 18, fontWeight: "900" },
    profileUsername: { ...safeTextLayout, color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 1 },
    followButton: { minHeight: homeLayout.minimumTouchTarget, minWidth: 88, maxWidth: 116, borderRadius: radii.pill, paddingHorizontal: 11, backgroundColor: v2Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    followText: { ...safeTextLayout, color: "#ffffff", fontSize: 11.5, fontWeight: "800" },
    moreButton: { minHeight: 50, marginTop: 9, borderRadius: radii.md, backgroundColor: v2Colors.surface1, borderWidth: 1, borderColor: v2Colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    moreText: { ...safeTextLayout, color: colors.ivory, fontSize: 12.5, fontWeight: "900" }
  });
}
