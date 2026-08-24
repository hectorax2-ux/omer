import { useMemo } from "react";
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/constants/theme";
import { useAds } from "@/hooks/use-ads";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

const adCopy = {
  sponsored: {
    tr: "Sponsorlu içerik",
    en: "Sponsored",
    ru: "Спонсорский материал",
    uz: "Homiylik kontenti"
  },
  interstitialTitle: {
    tr: "Sanata kısa bir mola",
    en: "A short art break",
    ru: "Короткая пауза для искусства",
    uz: "San'at uchun qisqa tanaffus"
  },
  pageText: {
    tr: "Art Atlas sponsor alanı.",
    en: "Art Atlas sponsor placement.",
    ru: "Спонсорский блок Art Atlas.",
    uz: "Art Atlas homiylik maydoni."
  },
  quizStartText: {
    tr: "Yarışmaya başlamadan önce sponsor alanı.",
    en: "A sponsor placement before the quiz begins.",
    ru: "Спонсорский блок перед квизом.",
    uz: "Quiz boshlanishidan oldin homiylik maydoni."
  },
  quizFinishText: {
    tr: "Sonuç ekranından önce sponsor alanı.",
    en: "A sponsor placement before the result screen.",
    ru: "Спонсорский блок перед результатами.",
    uz: "Natija ekranidan oldin homiylik maydoni."
  },
  close: {
    tr: "Kapat",
    en: "Close",
    ru: "Закрыть",
    uz: "Yopish"
  },
  detailTitle: {
    tr: "Sponsor içerik",
    en: "Sponsored content",
    ru: "Спонсорский контент",
    uz: "Homiylik kontenti"
  },
  detailText: {
    tr: "Eser okurken gösterilen sponsor alanı.",
    en: "Sponsor placement while reading artwork notes.",
    ru: "Спонсорский блок при чтении.",
    uz: "Asar o'qish vaqtida homiylik maydoni."
  }
};

export function GlobalAdOverlays() {
  const {
    interstitialVisible,
    interstitialReason,
    interstitialAd,
    bottomSheetVisible,
    bottomSheetAd,
    closeBottomSheetAd,
    closeInterstitialAd
  } = useAds();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fallbackText = interstitialReason === "quiz-start"
    ? adCopy.quizStartText[language]
    : interstitialReason === "quiz-finish"
      ? adCopy.quizFinishText[language]
      : adCopy.pageText[language];

  const interstitialTitle = interstitialAd?.title || adCopy.interstitialTitle[language];
  const interstitialText = interstitialAd?.body || fallbackText;
  const interstitialImage = interstitialAd?.imageURL || interstitialAd?.image;
  const sheetTitle = bottomSheetAd?.title || adCopy.detailTitle[language];
  const sheetText = bottomSheetAd?.body || adCopy.detailText[language];
  const sheetImage = bottomSheetAd?.imageURL || bottomSheetAd?.image;

  function openLink(url?: string) {
    if (url) {
      Linking.openURL(url).catch(() => undefined);
    }
  }

  return (
    <>
      <Modal visible={interstitialVisible} transparent animationType="fade" onRequestClose={closeInterstitialAd}>
        <View style={styles.interstitialBackdrop}>
          <Pressable style={styles.interstitialPanel} onPress={() => openLink(interstitialAd?.linkURL)}>
            <Pressable onPress={closeInterstitialAd} style={styles.closeIcon}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
            <View style={styles.adBadge}>
              <Ionicons name="sparkles-outline" size={16} color={colors.gold} />
              <Text style={styles.adBadgeText}>{adCopy.sponsored[language]}</Text>
            </View>
            {interstitialImage ? (
              <Image source={{ uri: interstitialImage }} style={styles.adVisualImage} resizeMode="cover" />
            ) : (
              <View style={styles.adVisual}>
                <Ionicons name="easel-outline" size={44} color={colors.gold} />
              </View>
            )}
            <Text style={styles.interstitialTitle}>{interstitialTitle}</Text>
            <Text style={styles.interstitialText}>{interstitialText}</Text>
            <Pressable onPress={closeInterstitialAd} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>{adCopy.close[language]}</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={bottomSheetVisible} transparent animationType="slide" onRequestClose={closeBottomSheetAd}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeBottomSheetAd} />
          <Pressable style={styles.bottomSheet} onPress={() => openLink(bottomSheetAd?.linkURL)}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetRow}>
              {sheetImage ? (
                <Image source={{ uri: sheetImage }} style={styles.sheetImage} resizeMode="cover" />
              ) : (
                <View style={styles.sheetIcon}>
                  <Ionicons name="sparkles-outline" size={20} color={colors.gold} />
                </View>
              )}
              <View style={styles.sheetTextBlock}>
                <Text style={styles.sheetTitle}>{sheetTitle}</Text>
                <Text style={styles.sheetText}>{sheetText}</Text>
              </View>
              <Pressable onPress={closeBottomSheetAd} style={styles.sheetClose}>
                <Ionicons name="close" size={19} color={colors.muted} />
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    interstitialBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.58)",
      justifyContent: "center",
      padding: 20
    },
    interstitialPanel: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 18,
      gap: 12
    },
    closeIcon: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2
    },
    adBadge: {
      alignSelf: "flex-start",
      minHeight: 30,
      borderRadius: 8,
      backgroundColor: colors.panelSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 9
    },
    adBadgeText: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: "900"
    },
    adVisual: {
      height: 116,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    adVisualImage: {
      height: 160,
      borderRadius: 8,
      width: "100%"
    },
    interstitialTitle: {
      color: colors.ivory,
      fontSize: 23,
      fontWeight: "900",
      textAlign: "center"
    },
    interstitialText: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      fontWeight: "700"
    },
    closeButton: {
      minHeight: 46,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16
    },
    closeButtonText: {
      color: colors.ink,
      fontWeight: "900"
    },
    sheetBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.24)"
    },
    bottomSheet: {
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 20
    },
    sheetHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.line,
      marginBottom: 12
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10
    },
    sheetIcon: {
      width: 42,
      height: 42,
      borderRadius: 8,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    sheetImage: {
      width: 54,
      height: 54,
      borderRadius: 8
    },
    sheetTextBlock: {
      flex: 1
    },
    sheetTitle: {
      color: colors.ivory,
      fontSize: 15,
      fontWeight: "900"
    },
    sheetText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 2
    },
    sheetClose: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center"
    }
  });
}
