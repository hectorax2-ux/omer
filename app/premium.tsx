import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppChrome, type AppChromeVirtualizedItem } from "@/components/app-chrome";
import { PremiumPlansSection } from "@/components/premium-plans-section";
import {
  premiumExperienceCopy,
  premiumFeatureSections,
  premiumNumberStats,
  premiumQuickBenefits,
  type PremiumFeatureSection
} from "@/app/i18n/premium-experience";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";

const dateLocales = { tr: "tr-TR", en: "en-US", ru: "ru-RU", uz: "uz-UZ" } as const;

export default function PremiumScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { account } = useAccount();
  const { width } = useWindowDimensions();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const colors = getThemeColors(theme);
  const compact = width < 360;
  const tablet = width >= 720;
  const styles = useMemo(() => createStyles(colors, compact, tablet), [colors, compact, tablet]);
  const expiryDate = useMemo(() => {
    if (!account.premiumExpiresAt) return null;
    const date = new Date(account.premiumExpiresAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(dateLocales[language], { day: "numeric", month: "long", year: "numeric" }).format(date);
  }, [account.premiumExpiresAt, language]);

  const items = useMemo(() => {
    const result: AppChromeVirtualizedItem[] = [
      {
        key: "hero",
        content: <PremiumHero isPremium={account.isPremium} expiryDate={account.isPremium ? expiryDate : null} language={language} styles={styles} />
      },
      { key: "quick-benefits", content: <QuickBenefits language={language} styles={styles} /> },
      {
        key: "plans",
        content: (
          <View style={styles.sectionBlock}>
            <SectionHeading
              eyebrow={t(premiumExperienceCopy.plansEyebrow, language)}
              title={t(premiumExperienceCopy.plansTitle, language)}
              body={t(premiumExperienceCopy.plansBody, language)}
              styles={styles}
            />
            <PremiumPlansSection language={language} theme={theme} isPremium={account.isPremium} statusTextStyle={styles.status} />
          </View>
        )
      },
      {
        key: "numbers",
        content: <NumbersSection detailsVisible={detailsVisible} onToggle={() => setDetailsVisible((visible) => !visible)} language={language} styles={styles} />
      }
    ];

    if (detailsVisible) {
      result.push(...premiumFeatureSections.map((section, index) => ({
        key: `feature-${section.id}`,
        content: <FeatureSection section={section} index={index + 1} language={language} styles={styles} />
      })));
    }

    result.push({ key: "final", content: <FinalSection isPremium={account.isPremium} language={language} styles={styles} /> });
    return result;
  }, [account.isPremium, detailsVisible, expiryDate, language, styles, theme]);

  return (
    <AppChrome
      title={t(premiumExperienceCopy.pageTitle, language)}
      eyebrow={t(premiumExperienceCopy.pageEyebrow, language)}
      showBackButton
      backToHome
      showTopAd={false}
      virtualizedItems={items}
      virtualizedInitialNumToRender={4}
    />
  );
}

function PremiumHero({ isPremium, expiryDate, language, styles }: {
  isPremium: boolean;
  expiryDate: string | null;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
}) {
  const activeUntil = expiryDate ? t(premiumExperienceCopy.activeUntil, language).replace("{date}", expiryDate) : null;
  return (
    <LinearGradient colors={["#0D1427", "#111B35", "#182747"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View pointerEvents="none" style={styles.galleryFrame} />
      <View pointerEvents="none" style={styles.galleryFrameInner} />
      <View style={styles.heroTopRow}>
        <View style={styles.diamondPlate}><Ionicons name="diamond" size={20} color="#F1BF50" /></View>
        <Text style={styles.heroEyebrow}>{t(premiumExperienceCopy.heroEyebrow, language)}</Text>
      </View>
      <Text style={styles.heroTitle}>{isPremium ? t(premiumExperienceCopy.activeTitle, language) : t(premiumExperienceCopy.heroTitle, language)}</Text>
      <Text style={styles.heroBody}>{isPremium ? t(premiumExperienceCopy.activeBody, language) : t(premiumExperienceCopy.heroBody, language)}</Text>
      <View style={styles.promisePill}>
        <Ionicons name={isPremium ? "checkmark-circle" : "key-outline"} size={14} color="#F1BF50" />
        <Text style={styles.promiseText}>{isPremium ? t(premiumExperienceCopy.activeBadge, language) : t(premiumExperienceCopy.heroPromise, language)}</Text>
      </View>
      {activeUntil ? <Text style={styles.expiryText}>{activeUntil}</Text> : null}
    </LinearGradient>
  );
}

function QuickBenefits({ language, styles }: { language: "tr" | "en" | "ru" | "uz"; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading eyebrow={t(premiumExperienceCopy.quickEyebrow, language)} title={t(premiumExperienceCopy.quickTitle, language)} body={t(premiumExperienceCopy.quickBody, language)} styles={styles} />
      <View style={styles.quickGrid}>
        {premiumQuickBenefits.map((benefit) => (
          <View key={benefit.id} style={styles.quickCard}>
            <View style={styles.quickIcon}><Ionicons name={benefit.icon} size={18} color="#F1BF50" /></View>
            <Text style={styles.quickTitle}>{t(benefit.title, language)}</Text>
            <Text style={styles.quickBody}>{t(benefit.body, language)}</Text>
            <Text style={styles.quickTag}>{t(benefit.tag, language)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NumbersSection({ detailsVisible, onToggle, language, styles }: {
  detailsVisible: boolean;
  onToggle: () => void;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionBlock}>
      <SectionHeading eyebrow={t(premiumExperienceCopy.numbersEyebrow, language)} title={t(premiumExperienceCopy.numbersTitle, language)} styles={styles} />
      <View style={styles.numberGrid}>
        {premiumNumberStats.map((stat) => (
          <View key={`${stat.value}-${stat.label.tr}`} style={styles.numberCard}>
            <Text style={styles.numberValue}>{stat.value}</Text>
            <Text style={styles.numberLabel}>{t(stat.label, language)}</Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onToggle} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}>
        <Text style={styles.detailsButtonText}>{detailsVisible ? t(premiumExperienceCopy.hideBenefits, language) : t(premiumExperienceCopy.allBenefits, language)}</Text>
        <Ionicons name={detailsVisible ? "chevron-up" : "chevron-down"} size={17} color="#F1BF50" />
      </Pressable>
    </View>
  );
}

function FeatureSection({ section, index, language, styles }: {
  section: PremiumFeatureSection;
  index: number;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.featureSection}>
      <View style={styles.featureTopRow}>
        <View style={styles.featureIcon}><Ionicons name={section.icon} size={19} color="#F1BF50" /></View>
        <View style={styles.featureHeadingContent}>
          <Text style={styles.featureEyebrow}>{String(index).padStart(2, "0")} — {t(section.eyebrow, language)}</Text>
          <Text style={styles.featureTitle}>{t(section.title, language)}</Text>
        </View>
      </View>
      <Text style={styles.featureDescription}>{t(section.description, language)}</Text>
      <View style={styles.featureList}>
        {section.features.map((feature) => (
          <View key={feature.tr} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#8E7CFF" />
            <Text style={styles.featureText}>{t(feature, language)}</Text>
          </View>
        ))}
      </View>
      {section.comparison ? (
        <View style={styles.comparisonRow}>
          <ComparisonCard title={t(premiumExperienceCopy.standard, language)} items={section.comparison.standard.map((item) => t(item, language))} premium={false} styles={styles} />
          <ComparisonCard title={t(premiumExperienceCopy.premium, language)} items={section.comparison.premium.map((item) => t(item, language))} premium styles={styles} />
        </View>
      ) : null}
      {section.highlight ? <View style={styles.highlightRow}><View style={styles.highlightLine} /><Text style={styles.highlightText}>{t(section.highlight, language)}</Text></View> : null}
      {section.note ? <Text style={styles.noteText}>{t(section.note, language)}</Text> : null}
    </View>
  );
}

function ComparisonCard({ title, items, premium, styles }: { title: string; items: string[]; premium: boolean; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.comparisonCard, premium && styles.comparisonCardPremium]}>
      <Text style={[styles.comparisonTitle, premium && styles.comparisonTitlePremium]}>{title}</Text>
      {items.map((item) => <Text key={item} style={styles.comparisonText}>{item}</Text>)}
    </View>
  );
}

function FinalSection({ isPremium, language, styles }: { isPremium: boolean; language: "tr" | "en" | "ru" | "uz"; styles: ReturnType<typeof createStyles> }) {
  return (
    <LinearGradient colors={["rgba(118,87,255,0.18)", "rgba(241,191,80,0.09)", "rgba(13,20,39,0.96)"]} style={styles.finalCard}>
      <Ionicons name="diamond-outline" size={25} color="#F1BF50" />
      <Text style={styles.finalTitle}>{isPremium ? t(premiumExperienceCopy.activeTitle, language) : t(premiumExperienceCopy.finalTitle, language)}</Text>
      <Text style={styles.finalBody}>{isPremium ? t(premiumExperienceCopy.activeBody, language) : t(premiumExperienceCopy.finalBody, language)}</Text>
      <View style={styles.finalBadge}><Text style={styles.finalBadgeText}>{isPremium ? t(premiumExperienceCopy.activeBadge, language) : t(premiumExperienceCopy.upgrade, language)}</Text></View>
      <Text style={styles.finalNote}>{t(premiumExperienceCopy.sameBenefits, language)}</Text>
    </LinearGradient>
  );
}

function SectionHeading({ eyebrow, title, body, styles }: { eyebrow: string; title: string; body?: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text>{body ? <Text style={styles.sectionBody}>{body}</Text> : null}</View>;
}

function createStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean, tablet: boolean) {
  const contentWidth = tablet ? 760 : undefined;
  return StyleSheet.create({
    hero: { width: "100%", maxWidth: contentWidth, alignSelf: "center", minHeight: compact ? 300 : 322, borderRadius: 24, borderWidth: 1, borderColor: "rgba(241,191,80,0.34)", paddingHorizontal: compact ? 19 : 25, paddingVertical: compact ? 25 : 31, justifyContent: "center", alignItems: "flex-start", overflow: "hidden", gap: 12 },
    galleryFrame: { position: "absolute", width: compact ? 154 : 184, height: compact ? 220 : 250, right: -35, top: 35, borderWidth: 1, borderColor: "rgba(241,191,80,0.18)", borderRadius: 90, transform: [{ rotate: "10deg" }] },
    galleryFrameInner: { position: "absolute", width: compact ? 115 : 138, height: compact ? 176 : 202, right: -11, top: 58, borderWidth: 1, borderColor: "rgba(142,124,255,0.2)", borderRadius: 70, transform: [{ rotate: "10deg" }] },
    heroTopRow: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "82%" },
    diamondPlate: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(241,191,80,0.12)", borderWidth: 1, borderColor: "rgba(241,191,80,0.32)" },
    heroEyebrow: { color: "#F1BF50", fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1.7, flexShrink: 1 },
    heroTitle: { color: "#F8F2E3", fontSize: compact ? 30 : 36, lineHeight: compact ? 35 : 41, fontWeight: "900", maxWidth: "88%" },
    heroBody: { color: "rgba(236,239,248,0.8)", fontSize: compact ? 13 : 14, lineHeight: compact ? 20 : 22, fontWeight: "600", maxWidth: tablet ? 570 : "91%" },
    promisePill: { minHeight: 34, maxWidth: "100%", borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(6,10,22,0.54)", borderWidth: 1, borderColor: "rgba(241,191,80,0.22)" },
    promiseText: { color: "#F1BF50", fontSize: 11, lineHeight: 15, fontWeight: "800", flexShrink: 1 },
    expiryText: { color: "rgba(236,239,248,0.7)", fontSize: 11, lineHeight: 16, fontWeight: "600" },
    sectionBlock: { width: "100%", maxWidth: contentWidth, alignSelf: "center", marginTop: 28, gap: 15 },
    sectionHeading: { gap: 5 },
    sectionEyebrow: { color: "#F1BF50", fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1.45 },
    sectionTitle: { color: colors.ivory, fontSize: compact ? 22 : 25, lineHeight: compact ? 28 : 31, fontWeight: "900" },
    sectionBody: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "600", maxWidth: 650 },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: compact ? 8 : 10 },
    quickCard: { width: tablet ? "31.9%" : "48.4%", minWidth: 0, minHeight: compact ? 194 : 184, borderRadius: 18, borderWidth: 1, borderColor: "rgba(241,191,80,0.17)", backgroundColor: "rgba(17,27,53,0.88)", padding: compact ? 12 : 14, gap: 7 },
    quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(241,191,80,0.1)" },
    quickTitle: { color: colors.ivory, fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 19, fontWeight: "800" },
    quickBody: { color: colors.muted, fontSize: compact ? 10.5 : 11, lineHeight: compact ? 15 : 16, fontWeight: "600", flexGrow: 1 },
    quickTag: { color: "#F1BF50", fontSize: 9.5, lineHeight: 14, fontWeight: "800" },
    status: { color: colors.gold, fontSize: 12, lineHeight: 18, fontWeight: "800", textAlign: "center", marginTop: 10 },
    numberGrid: { flexDirection: "row", flexWrap: "wrap", gap: compact ? 7 : 9 },
    numberCard: { width: tablet ? "31.9%" : "31.5%", minWidth: 0, minHeight: compact ? 87 : 94, borderRadius: 14, backgroundColor: "rgba(17,27,53,0.78)", borderWidth: 1, borderColor: "rgba(142,124,255,0.19)", alignItems: "center", justifyContent: "center", paddingHorizontal: compact ? 6 : 9, paddingVertical: 11, gap: 3 },
    numberValue: { color: "#F1BF50", fontSize: compact ? 20 : 23, lineHeight: compact ? 25 : 28, fontWeight: "900", textAlign: "center" },
    numberLabel: { color: colors.muted, fontSize: compact ? 9 : 10, lineHeight: compact ? 12 : 14, fontWeight: "700", textAlign: "center" },
    detailsButton: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: "rgba(241,191,80,0.32)", backgroundColor: "rgba(241,191,80,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 16 },
    detailsButtonText: { color: colors.ivory, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center", flexShrink: 1 },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    featureSection: { width: "100%", maxWidth: contentWidth, alignSelf: "center", marginTop: 18, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(17,27,53,0.82)", padding: compact ? 15 : 18, gap: 13 },
    featureTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    featureIcon: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(241,191,80,0.1)", borderWidth: 1, borderColor: "rgba(241,191,80,0.18)" },
    featureHeadingContent: { flex: 1, minWidth: 0, gap: 4 },
    featureEyebrow: { color: "#F1BF50", fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.05 },
    featureTitle: { color: colors.ivory, fontSize: compact ? 18 : 20, lineHeight: compact ? 23 : 25, fontWeight: "900" },
    featureDescription: { color: colors.muted, fontSize: 12.5, lineHeight: 19, fontWeight: "600" },
    featureList: { gap: 9 },
    featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    featureText: { color: "rgba(246,242,232,0.9)", fontSize: 12, lineHeight: 18, fontWeight: "600", flex: 1 },
    comparisonRow: { flexDirection: compact ? "column" : "row", alignItems: "stretch", gap: 8 },
    comparisonCard: { flex: 1, borderRadius: 13, backgroundColor: "rgba(7,11,24,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 11, gap: 5 },
    comparisonCardPremium: { backgroundColor: "rgba(241,191,80,0.07)", borderColor: "rgba(241,191,80,0.24)" },
    comparisonTitle: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.1 },
    comparisonTitlePremium: { color: "#F1BF50" },
    comparisonText: { color: "rgba(246,242,232,0.8)", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
    highlightRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2 },
    highlightLine: { width: 26, height: 1, backgroundColor: "#F1BF50" },
    highlightText: { color: "#F1BF50", fontSize: 11, lineHeight: 17, fontWeight: "800", flex: 1 },
    noteText: { color: colors.muted, fontSize: 10.5, lineHeight: 16, fontWeight: "600", fontStyle: "italic" },
    finalCard: { width: "100%", maxWidth: contentWidth, alignSelf: "center", marginTop: 24, marginBottom: 8, borderRadius: 22, borderWidth: 1, borderColor: "rgba(241,191,80,0.25)", paddingHorizontal: compact ? 18 : 23, paddingVertical: 24, alignItems: "center", gap: 9 },
    finalTitle: { color: colors.ivory, fontSize: compact ? 21 : 24, lineHeight: compact ? 27 : 30, fontWeight: "900", textAlign: "center" },
    finalBody: { color: colors.muted, fontSize: 12, lineHeight: 19, fontWeight: "600", textAlign: "center", maxWidth: 600 },
    finalBadge: { minHeight: 38, borderRadius: 999, backgroundColor: "#B8892D", paddingHorizontal: 18, paddingVertical: 9, justifyContent: "center", marginTop: 3 },
    finalBadgeText: { color: "#0B1023", fontSize: 12, lineHeight: 16, fontWeight: "900", textAlign: "center" },
    finalNote: { color: "rgba(241,191,80,0.78)", fontSize: 10.5, lineHeight: 15, fontWeight: "700", textAlign: "center" }
  });
}
