import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { useSocial } from "@/hooks/use-social";
import { belongsToProfileMuseum, normalizeIdentityKey } from "@/utils/user-identity";
import { commonCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";

export default function UserMuseumScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { account } = useAccount();
  const { suggestedUsers, isUserBlocked, isUserSuspended } = useSocial();
  const profileUsername = Array.isArray(username) ? username[0] : username ?? "";
  const normalizedUsername = normalizeIdentityKey(profileUsername);
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { personalMuseums } = useArtSystems();
  const { artworks } = useArtworks();
  const profileUser = suggestedUsers.find((user) => normalizeIdentityKey(user.username) === normalizedUsername);
  const profileUid = normalizeIdentityKey(account.username) === normalizedUsername ? account.uid : profileUser?.uid;
  const ownerSuspended = normalizeIdentityKey(account.username) === normalizedUsername
    ? account.isSuspended
    : isUserSuspended({ uid: profileUid, username: profileUser?.username ?? profileUsername, displayName: profileUser?.name });
  const ownerBlocked = isUserBlocked({ uid: profileUid, username: profileUser?.username ?? profileUsername, displayName: profileUser?.name });
  const museum = personalMuseums.find((item) => item.active && belongsToProfileMuseum(item, { uid: profileUid, username: profileUser?.username ?? profileUsername }));
  const museumArtworks = museum ? artworks.filter((artwork) => museum.artworkIds.includes(artwork.id)) : [];

  if (ownerSuspended || ownerBlocked) {
    return (
      <AppChrome title={language === "tr" ? "Müze" : "Museum"} eyebrow="Art Atlas" showBackButton backToHome>
        <Text style={styles.empty}>
          {ownerBlocked
            ? t(commonCopy.blockedMuseumNotice, language)
            : language === "tr"
            ? "Bu hesap askıya alınmıştır. Müze geçici olarak gizlenmiştir."
            : language === "ru"
              ? "Аккаунт заблокирован. Музей временно скрыт."
              : language === "uz"
                ? "Bu hisob to'xtatilgan. Muzey vaqtincha yashirilgan."
                : "This account is suspended. The museum is temporarily hidden."}
        </Text>
      </AppChrome>
    );
  }

  if (!museum) {
    return (
      <AppChrome title={language === "tr" ? "Müze" : "Museum"} eyebrow="Art Atlas" showBackButton backToHome>
        <Text style={styles.empty}>{language === "tr" ? "Bu kullanıcıya ait aktif müze bulunamadı." : "No active museum found for this member."}</Text>
      </AppChrome>
    );
  }

  return (
    <AppChrome title={museum.name} eyebrow={museum.ownerName} showBackButton backToHome>
      <View style={styles.hero}>
        <Image source={{ uri: museum.coverImage }} style={styles.heroImage} contentFit="cover" />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>{museum.name}</Text>
          <Text style={styles.heroText}>{museum.ownerName} · {museum.artworkIds.length} / 100 {language === "tr" ? "eser" : "artworks"}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {museumArtworks.map((artwork) => (
          <Pressable key={artwork.id} onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })} style={styles.artCard}>
            <Image source={{ uri: artwork.image }} style={styles.artImage} contentFit="cover" />
            <Text style={styles.artTitle} numberOfLines={1}>{artwork.title[language]}</Text>
            <Text style={styles.artMeta} numberOfLines={1}>{artwork.artist[language]}</Text>
          </Pressable>
        ))}
      </View>
      {!museumArtworks.length ? <Text style={styles.empty}>{language === "tr" ? "Bu müzede henüz eser yok." : "This museum has no artworks yet."}</Text> : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    hero: { height: 230, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, marginBottom: 12 },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroOverlay: { marginTop: "auto", padding: 16, backgroundColor: "rgba(0,0,0,0.46)" },
    heroTitle: { color: colors.ivory, fontSize: 25, fontWeight: "900" },
    heroText: { color: colors.gold, fontWeight: "900", marginTop: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    artCard: { width: "48.5%", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
    artImage: { width: "100%", aspectRatio: 1 },
    artTitle: { color: colors.ivory, fontWeight: "900", paddingHorizontal: 8, paddingTop: 8 },
    artMeta: { color: colors.muted, fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
    empty: { color: colors.muted, fontWeight: "900", textAlign: "center", marginTop: 18 }
  });
}
