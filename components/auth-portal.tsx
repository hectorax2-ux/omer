import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/use-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getThemeColors } from "@/constants/theme";

const title = { tr: "Sanatla yeniden buluş", en: "Return to your world of art", ru: "Снова в мире искусства", uz: "San’at bilan yana uchrashing" };
const subtitle = { tr: "Eserlerin, koleksiyonların ve topluluğun burada.", en: "Your artworks, collections and community await.", ru: "Ваши работы, коллекции и сообщество — здесь.", uz: "Asarlar, kolleksiyalar va hamjamiyat shu yerda." };

/** Static, bundled museum entrance: no queries, timers, blur or animation. */
export const AuthPortal = memo(function AuthPortal() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  return <View testID="auth-portal" style={styles.portal}>
    <View pointerEvents="none" accessible={false} style={styles.art}>
      <View style={[styles.halo, { backgroundColor: colors.panelSoft }]} />
      <View style={[styles.orbit, { borderColor: colors.gold }]} />
      <View style={[styles.orbit, styles.innerOrbit, { borderColor: colors.line }]} />
      <View style={[styles.medallion, styles.goya, { borderColor: colors.gold }]}>
        <Image source={require("@/assets/images/art-detective-cover-mobile.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" allowDownscaling transition={0} />
      </View>
      <View style={[styles.medallion, styles.mona, { borderColor: colors.gold }]}>
        {/* Small existing local brand artwork; crop the portrait, not a new download. */}
        <Image source={require("@/assets/images/art-atlas-loader.jpg")} style={styles.portraitCrop} cachePolicy="memory-disk" allowDownscaling transition={0} />
      </View>
      <View style={[styles.symbol, { backgroundColor: colors.panel, borderColor: colors.line }]}>
        <Ionicons name="diamond-outline" size={25} color={colors.gold} />
      </View>
    </View>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.ivory }]}>{title[language]}</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle[language]}</Text>
  </View>;
});

const styles = StyleSheet.create({
  portal: { alignItems: "center", minWidth: 0, paddingBottom: 8 },
  art: { width: 238, height: 56, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 126, height: 52, borderRadius: 70, opacity: 0.55 },
  orbit: { position: "absolute", width: 188, height: 40, borderRadius: 100, borderWidth: 1, opacity: 0.35, transform: [{ rotate: "-9deg" }] },
  innerOrbit: { width: 150, height: 46, opacity: 0.7, transform: [{ rotate: "12deg" }] },
  medallion: { position: "absolute", borderRadius: 24, overflow: "hidden", borderWidth: 1, backgroundColor: "#161B2C" },
  goya: { width: 34, height: 34, left: 21, top: 17 },
  mona: { width: 40, height: 40, right: 23, top: 1 },
  portraitCrop: { position: "absolute", width: 110, height: 110, left: -65, top: -3 },
  symbol: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  subtitle: { fontSize: 11, lineHeight: 15, textAlign: "center", marginTop: 2, maxWidth: 360 }
});
