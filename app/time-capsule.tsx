import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { CoverImage } from "@/components/cover-image";
import { PressableScale } from "@/components/ui/pressable-scale";
import { hexAlpha, radii } from "@/constants/design";
import { getThemeColors } from "@/constants/theme";
import { ArtistPickerModal } from "@/features/time-letter/artist-picker-modal";
import { LetterPolicyNote, LetterStatusChip } from "@/features/time-letter/letter-status-chip";
import { pickOrbitArtists, TimePortal } from "@/features/time-letter/time-portal";
import { useAccount } from "@/hooks/use-account";
import { useArtists } from "@/hooks/use-artists";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { updateTimeCapsuleStatus } from "@/src/services/firebase/art-systems-service";
import { fieldLimits, TimeCapsule } from "@/types/art-systems";
import { Artist, Language } from "@/types/content";
import { isSameArtistLetterWindow } from "@/utils/artist-letter-window";
import { isOwnedTimeCapsule } from "@/utils/user-identity";

type ThemeColors = ReturnType<typeof getThemeColors>;

export default function ArtistLetterScreen() {
  const { language } = useLanguage();
  const { isAuthenticated } = useAccount();
  const copy = screenCopy(language);
  if (!isAuthenticated) return <AuthRequired title={copy.title} />;
  return <AuthenticatedArtistLetterScreen />;
}

function AuthenticatedArtistLetterScreen() {
  const { language } = useLanguage();
  const copy = screenCopy(language);
  const { account } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const width = useWindowDimensions().width;
  const compact = width < 360;
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { artists, loading: artistsLoading } = useArtists(250);
  const { createTimeCapsule, timeCapsules } = useArtSystems();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [titleFocused, setTitleFocused] = useState(false);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeLetterId, setActiveLetterId] = useState<string | null>(null);
  const [, setWindowNonce] = useState(0);
  const [heroWidth, setHeroWidth] = useState(Math.max(280, width - 36));
  const letterFly = useRef(new Animated.Value(0)).current;
  const portalGlow = useRef(new Animated.Value(0)).current;
  const noteLimit = fieldLimits.timeCapsule;
  const titleLimit = fieldLimits.letterTitle;
  const heroHeight = compact ? 200 : 222;
  const mine = timeCapsules.filter((item) => isOwnedTimeCapsule(item, account));
  const lastSentAt = mine.reduce<string | undefined>((latest, item) => {
    if (!latest || item.createdAt > latest) return item.createdAt;
    return latest;
  }, undefined);
  const sentToday = mine.some((item) => isSameArtistLetterWindow(item.createdAt));
  const canWrite = account.isPremium && !sentToday && !sending;
  const canSubmit = canWrite && Boolean(selectedArtist) && title.trim().length >= (titleLimit.min ?? 0) && note.trim().length >= (noteLimit.min ?? 0);
  const activeLetter = mine.find((item) => item.id === activeLetterId) ?? null;
  const orbitArtists = useMemo(() => pickOrbitArtists(artists), [artists]);
  const unlockLetterWindow = useCallback(() => setWindowNonce((value) => value + 1), []);

  function playDispatchMotion() {
    if (reducedMotion) return;
    letterFly.setValue(0);
    portalGlow.setValue(0);
    Animated.parallel([
      Animated.timing(letterFly, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(portalGlow, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(portalGlow, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true })
      ])
    ]).start();
  }

  async function submit() {
    if (!account.isPremium) {
      router.push("/premium" as never);
      return;
    }
    if (!canWrite) return;
    if (!selectedArtist) {
      setPickerOpen(true);
      setFeedback({ ok: false, text: copy.pickArtist });
      return;
    }
    setSending(true);
    const result = await createTimeCapsule({
      note,
      title,
      artistId: selectedArtist.id,
      artistName: selectedArtist.name.tr || selectedArtist.name[language]
    });
    setSending(false);
    setFeedback({ ok: result.ok, text: result.message });
    if (!result.ok) return;
    playDispatchMotion();
    setNote("");
    setTitle("");
    setSelectedArtist(null);
  }

  function openReply(letter: TimeCapsule) {
    if (!letter.reply) return;
    setActiveLetterId(letter.id);
    if (!letter.opened) {
      updateTimeCapsuleStatus(letter.id, { opened: true }).catch(() => undefined);
    }
  }

  return (
    <>
      <AppChrome title={copy.title} eyebrow="Premium" showBackButton backToHome keyboardAvoiding showFloatingShortcuts={false}>
        <View style={styles.heroCopy}>
          <View onLayout={(event) => setHeroWidth(event.nativeEvent.layout.width)} style={{ height: heroHeight }}>
            <TimePortal
              colors={colors}
              dispatch={letterFly}
              glow={portalGlow}
              height={heroHeight}
              language={language}
              orbitArtists={orbitArtists}
              reducedMotion={reducedMotion}
              selectedArtist={selectedArtist}
              width={heroWidth}
            />
          </View>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.heroTitle}>{copy.heading}</Text>
          <Text numberOfLines={2} style={styles.tagline}>{copy.tagline}</Text>
          <View style={styles.statusRow}>
            {account.isPremium ? (
              <View style={styles.chip}>
                <Ionicons color={colors.gold} name="diamond" size={10} />
                <Text style={styles.chipText}>{copy.premiumChip}</Text>
              </View>
            ) : (
              <PressableScale onPress={() => router.push("/premium" as never)} style={styles.chip}>
                <Ionicons color={colors.gold} name="diamond-outline" size={10} />
                <Text style={styles.chipText}>{copy.premiumChip}</Text>
              </PressableScale>
            )}
            <LetterStatusChip
              colors={colors}
              isPremium={account.isPremium}
              lastSentAt={lastSentAt}
              onWindowUnlock={unlockLetterWindow}
              readyLabel={copy.ready}
            />
          </View>
        </View>

        <View style={styles.recipientBlock}>
          <Text style={styles.sectionEyebrow}>{copy.who}</Text>
          <ArtistRecipientCard
            artist={selectedArtist}
            artistsLoading={artistsLoading}
            canChange={canWrite || !account.isPremium}
            colors={colors}
            compact={compact}
            copy={copy}
            language={language}
            onOpen={() => setPickerOpen(true)}
            styles={styles}
          />
        </View>

        <Animated.View style={{
          transform: [
            { scale: letterFly.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0.98, 1] }) },
            { translateY: letterFly.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }
          ]
        }}>
          <DigitalLetterSheet
            canWrite={canWrite}
            colors={colors}
            compact={compact}
            copy={copy}
            focused={canvasFocused || titleFocused}
            language={language}
            max={noteLimit.max}
            note={note}
            onBlurBody={() => setCanvasFocused(false)}
            onBlurTitle={() => setTitleFocused(false)}
            onChangeNote={setNote}
            onChangeTitle={(value) => setTitle(value.slice(0, titleLimit.max))}
            onFocusBody={() => setCanvasFocused(true)}
            onFocusTitle={() => setTitleFocused(true)}
            styles={styles}
            title={title}
            titleMax={titleLimit.max}
          />
        </Animated.View>

        {feedback ? <Text style={[styles.feedback, { color: feedback.ok ? colors.jade : colors.wine }]}>{feedback.text}</Text> : null}

        <SendCta
          canSubmit={canSubmit}
          colors={colors}
          copy={copy}
          disabled={sending || (account.isPremium && sentToday)}
          isPremium={account.isPremium}
          lastSentAt={lastSentAt}
          onPress={() => void submit()}
          sending={sending}
          sentToday={sentToday}
          styles={styles}
        />

        {mine.length ? (
          <View style={styles.archive}>
            <Text style={styles.archiveEyebrow}>{copy.archiveEyebrow}</Text>
            <Text style={styles.archiveTitle}>{copy.archive}</Text>
            <View style={styles.archiveGrid}>
              {mine.map((letter) => (
                <Pressable disabled={!letter.reply} key={letter.id} onPress={() => openReply(letter)} style={styles.archiveCard}>
                  <View style={styles.archiveCardTop}>
                    <Text numberOfLines={1} style={styles.archiveMeta}>{letter.artistName || formatArchiveDate(letter.createdAt, language)}</Text>
                    {letter.reply ? <Ionicons color={colors.plum} name={letter.opened ? "mail-open" : "hourglass"} size={15} /> : null}
                  </View>
                  <Text numberOfLines={1} style={styles.archivePreview}>{letter.title || letter.note}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </AppChrome>
      <ArtistPickerModal
        artists={artists}
        colors={colors}
        copy={{ search: copy.artistSearch, empty: copy.artistEmpty, title: copy.who }}
        language={language}
        loading={artistsLoading}
        onClose={() => setPickerOpen(false)}
        onSelect={(artist) => {
          setSelectedArtist(artist);
          setPickerOpen(false);
          setFeedback(null);
        }}
        visible={pickerOpen}
      />
      <ReplyModal colors={colors} copy={copy} language={language} letter={activeLetter} onClose={() => setActiveLetterId(null)} />
    </>
  );
}

function SendCta({
  canSubmit,
  colors,
  copy,
  disabled,
  isPremium,
  lastSentAt,
  onPress,
  sending,
  sentToday,
  styles
}: {
  canSubmit: boolean;
  colors: ThemeColors;
  copy: ReturnType<typeof screenCopy>;
  disabled: boolean;
  isPremium: boolean;
  lastSentAt?: string;
  onPress: () => void;
  sending: boolean;
  sentToday: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const glow = canSubmit && !disabled;
  return (
    <View style={styles.ctaBlock}>
      <Ionicons color={glow ? colors.gold : colors.muted} name="sparkles" size={14} />
      <PressableScale disabled={disabled} onPress={onPress} style={{ width: "100%" }} wrapStyle={{ width: "100%" }}>
        <LinearGradient
          colors={glow ? [colors.plum, hexAlpha(colors.wine, 0.88)] : [hexAlpha(colors.panel, 0.9), hexAlpha(colors.navy, 0.9)]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.send, glow && styles.sendGlow, disabled && styles.sendDisabled]}
        >
          {sending ? <ActivityIndicator color={colors.ivory} /> : null}
          <Text style={styles.sendText}>{buttonLabel(copy, isPremium, sentToday, sending)}</Text>
        </LinearGradient>
      </PressableScale>
      <Text style={styles.sendHint}>{copy.sendHint}</Text>
      <LetterPolicyNote
        colors={colors}
        dailyLabel={copy.dailyLimit}
        isPremium={isPremium}
        lastSentAt={lastSentAt}
        nextLabel={copy.nextLetter}
      />
    </View>
  );
}

function ArtistRecipientCard({
  artist,
  artistsLoading,
  canChange,
  colors,
  compact,
  copy,
  language,
  onOpen,
  styles
}: {
  artist: Artist | null;
  artistsLoading: boolean;
  canChange: boolean;
  colors: ThemeColors;
  compact: boolean;
  copy: ReturnType<typeof screenCopy>;
  language: Language;
  onOpen: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <PressableScale disabled={Boolean(artist) && !canChange} onPress={onOpen} style={styles.recipient} wrapStyle={{ width: "100%" }}>
      <ClippedGradient colors={[hexAlpha(colors.panelSoft, 0.95), hexAlpha(colors.navy, 0.88)]} androidColors={[hexAlpha(colors.panelSoft, 0.98), hexAlpha(colors.navy, 0.94)]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} radius={radii.md} />
      <View pointerEvents="none" style={[styles.surfaceShine, { backgroundColor: hexAlpha(colors.ivory, 0.08) }]} />
      {artist?.image ? (
        <CoverImage imageFocus={artist.imageFocus} source={{ uri: artist.image }} style={styles.portrait} />
      ) : (
        <View style={[styles.portrait, styles.portraitEmpty]}>
          {artistsLoading ? <ActivityIndicator color={colors.plum} size="small" /> : <Ionicons color={colors.plum} name="ellipse-outline" size={16} />}
        </View>
      )}
      <View style={styles.recipientCopy}>
        <Text numberOfLines={1} style={styles.recipientName}>{artist ? artist.name[language] : copy.pickPrompt}</Text>
        <Text numberOfLines={1} style={styles.recipientLife}>{artist?.life || copy.pickHint}</Text>
      </View>
      {artist ? <Ionicons color={colors.jade} name="checkmark" size={18} /> : <Ionicons color={colors.muted} name="chevron-forward" size={compact ? 16 : 18} />}
    </PressableScale>
  );
}

function DigitalLetterSheet({
  canWrite,
  colors,
  compact,
  copy,
  focused,
  language,
  max,
  note,
  onBlurBody,
  onBlurTitle,
  onChangeNote,
  onChangeTitle,
  onFocusBody,
  onFocusTitle,
  styles,
  title,
  titleMax
}: {
  canWrite: boolean;
  colors: ThemeColors;
  compact: boolean;
  copy: ReturnType<typeof screenCopy>;
  focused: boolean;
  language: Language;
  max: number;
  note: string;
  onBlurBody: () => void;
  onBlurTitle: () => void;
  onChangeNote: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onFocusBody: () => void;
  onFocusTitle: () => void;
  styles: ReturnType<typeof createStyles>;
  title: string;
  titleMax: number;
}) {
  const year = new Date().getFullYear();
  return (
    <View style={[styles.sheet, focused && styles.sheetFocused]}>
      <ClippedGradient colors={[hexAlpha(colors.panel, 0.98), hexAlpha(colors.navy, 0.94)]} androidColors={[hexAlpha(colors.panel, 1), hexAlpha(colors.navy, 0.96)]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} radius={radii.lg} />
      <View pointerEvents="none" style={[styles.surfaceShine, { backgroundColor: hexAlpha(colors.ivory, 0.07) }]} />
      <View pointerEvents="none" style={[styles.corner, styles.cornerTl, { borderColor: hexAlpha(colors.gold, 0.28) }]} />
      <View pointerEvents="none" style={[styles.corner, styles.cornerBr, { borderColor: hexAlpha(colors.plum, 0.32) }]} />
      <View style={styles.sheetHeader}>
        <View>
          <Text style={styles.sheetBrand}>{copy.stampBrand}</Text>
          <Text style={styles.sheetKind}>{copy.stampKind} · {year}</Text>
        </View>
        <View style={styles.sheetMeta}>
          <Ionicons color={colors.gold} name="sparkles" size={12} />
          <Text style={styles.sheetDate}>{formatLetterStamp()}</Text>
        </View>
      </View>
      <Text style={styles.sheetLabel}>{copy.titleLabel}</Text>
      <TextInput
        editable={canWrite}
        maxLength={titleMax}
        onBlur={onBlurTitle}
        onChangeText={onChangeTitle}
        onFocus={onFocusTitle}
        placeholder={copy.nameLetter}
        placeholderTextColor={hexAlpha(colors.muted, 0.7)}
        style={styles.sheetTitle}
        value={title}
      />
      <View style={[styles.sheetRule, { backgroundColor: hexAlpha(colors.plum, 0.35) }]} />
      <View style={styles.sheetBody}>
        <View pointerEvents="none" style={styles.guides}>
          {[0, 1, 2, 3, 4].map((line) => (
            <View key={line} style={[styles.guide, { backgroundColor: hexAlpha(colors.ivory, 0.07) }]} />
          ))}
        </View>
        <TextInput
          editable={canWrite}
          maxLength={max}
          multiline
          onBlur={onBlurBody}
          onChangeText={(value) => onChangeNote(value.slice(0, max))}
          onFocus={onFocusBody}
          placeholder={copy.letterPrompt}
          placeholderTextColor={hexAlpha(colors.muted, 0.62)}
          style={[styles.sheetInput, { minHeight: compact ? 124 : 148 }]}
          textAlignVertical="top"
          value={note}
        />
      </View>
      <Text style={styles.counter}>{note.trim().length} / {max}</Text>
    </View>
  );
}

function ReplyModal({
  colors,
  copy,
  language,
  letter,
  onClose
}: {
  colors: ThemeColors;
  copy: ReturnType<typeof screenCopy>;
  language: Language;
  letter: TimeCapsule | null;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(letter?.reply)}>
      <View style={replyStyles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[replyStyles.card, { backgroundColor: colors.panel, borderColor: hexAlpha(colors.plum, 0.35) }]}>
          <View style={[replyStyles.seal, { backgroundColor: hexAlpha(colors.plum, 0.22), borderColor: hexAlpha(colors.plum, 0.5) }]}>
            <Ionicons color={colors.gold} name="hourglass" size={18} />
          </View>
          <Text style={[replyStyles.stamp, { color: colors.muted }]}>{copy.fromThePast}</Text>
          <Text style={[replyStyles.headline, { color: colors.ivory }]}>{copy.replyTitle}</Text>
          {letter?.artistName ? <Text style={[replyStyles.artist, { color: colors.gold }]}>{letter.artistName}</Text> : null}
          {letter?.title || letter?.note ? (
            <View style={[replyStyles.original, { backgroundColor: hexAlpha(colors.navy, 0.45) }]}>
              <Text style={[replyStyles.originalLabel, { color: colors.muted }]}>{letter?.title || copy.yourLetter}</Text>
              <Text style={[replyStyles.originalText, { color: colors.ivory }]}>{letter?.note}</Text>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={replyStyles.replyBody} style={replyStyles.replyScroll}>
            <Text style={[replyStyles.replyText, { color: colors.ivory }]}>{letter?.reply}</Text>
          </ScrollView>
          <Text style={[replyStyles.meta, { color: colors.muted }]}>
            {copy.arrived} · {formatArchiveDate(letter?.repliedAt || letter?.createdAt || "", language)}
          </Text>
          <Pressable onPress={onClose} style={[replyStyles.close, { backgroundColor: colors.plum }]}>
            <Text style={[replyStyles.closeText, { color: colors.ivory }]}>{copy.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function buttonLabel(copy: ReturnType<typeof screenCopy>, isPremium: boolean, sentToday: boolean, sending: boolean) {
  if (!isPremium) return copy.premiumCta;
  if (sending) return copy.sending;
  if (sentToday) return copy.used;
  return copy.send;
}

function formatArchiveDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(language === "tr" ? "tr-TR" : language === "ru" ? "ru-RU" : language === "uz" ? "uz-UZ" : "en-GB");
}

function formatLetterStamp() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function screenCopy(language: Language) {
  return {
    title: { tr: "Sanatçıya Mektup", en: "Letter to the Artist", ru: "Письмо художнику", uz: "Rassomga maktub" }[language],
    eyebrow: { tr: "Sanat tarihi · Zaman portalı", en: "Art history · Time portal", ru: "История искусства · Портал времени", uz: "Sanat tarixi · Vaqt portali" }[language],
    heading: { tr: "Zamana bir mektup bırak", en: "Leave a letter in time", ru: "Оставьте письмо во времени", uz: "Vaqtga maktub qoldiring" }[language],
    tagline: {
      tr: "Geçmişten bir sanatçı seç ve ona söylemek istediğini zamana bırak.",
      en: "Choose an artist from the past and leave what you want to say in time.",
      ru: "Выберите художника из прошлого и оставьте ему то, что хотите сказать.",
      uz: "O'tmishdan rassom tanlang va aytmoqchi bo'lganingizni vaqtga qoldiring."
    }[language],
    premiumChip: { tr: "Premium", en: "Premium", ru: "Premium", uz: "Premium" }[language],
    ready: { tr: "Mektup hakkın hazır", en: "Letter ready", ru: "Письмо доступно", uz: "Maktub huquqi tayyor" }[language],
    nextLetter: { tr: "Yeni hak", en: "Next credit", ru: "Следующее письмо", uz: "Yangi huquq" }[language],
    who: { tr: "Mektubun kime?", en: "Who is this letter for?", ru: "Кому письмо?", uz: "Maktub kimga?" }[language],
    pickPrompt: { tr: "Bir sanatçı seç", en: "Choose an artist", ru: "Выберите художника", uz: "Rassom tanlang" }[language],
    pickHint: { tr: "Zamanın içinden bir isim", en: "A name from inside time", ru: "Имя из потока времени", uz: "Vaqt ichidan bir ism" }[language],
    artistSearch: { tr: "Sanatçılar listesinde ara", en: "Search the Artists list", ru: "Поиск в списке художников", uz: "San'atkorlar ro'yxatidan qidiring" }[language],
    artistEmpty: { tr: "Bu isimde bir sanatçı yok. Listeden seç.", en: "No artist matches. Choose from the list.", ru: "Художник не найден. Выберите из списка.", uz: "Bunday rassom yo'q. Ro'yxatdan tanlang." }[language],
    pickArtist: { tr: "Önce Sanatçılar listesinden bir isim seç.", en: "First choose an artist from the Artists list.", ru: "Сначала выберите художника из списка.", uz: "Avval San'atkorlar ro'yxatidan ism tanlang." }[language],
    titleLabel: { tr: "Mektup başlığı", en: "Letter title", ru: "Заголовок письма", uz: "Maktub sarlavhasi" }[language],
    nameLetter: { tr: "Mektubuna bir isim ver...", en: "Give your letter a name...", ru: "Дайте письму имя...", uz: "Maktubingizga nom bering..." }[language],
    letterPrompt: { tr: "Sanatçıya ne söylemek isterdin?", en: "What would you tell the artist?", ru: "Что вы сказали бы художнику?", uz: "Rassomga nima demoqchi edingiz?" }[language],
    stampBrand: { tr: "Art Atlas", en: "Art Atlas", ru: "Art Atlas", uz: "Art Atlas" }[language],
    stampKind: { tr: "Time letter", en: "Time letter", ru: "Time letter", uz: "Time letter" }[language],
    send: { tr: "Zamana gönder", en: "Send through time", ru: "Отправить сквозь время", uz: "Vaqtga yuborish" }[language],
    sendHint: { tr: "Mektubu zaman portalına bırak", en: "Leave the letter in the time portal", ru: "Оставьте письмо в портале времени", uz: "Maktubni vaqt portaliga qoldiring" }[language],
    sending: { tr: "Gönderiliyor...", en: "Sending...", ru: "Отправка...", uz: "Yuborilmoqda..." }[language],
    used: { tr: "Bugünkü hakkın kullanıldı", en: "Today's letter was sent", ru: "Сегодняшнее письмо уже отправлено", uz: "Bugungi huquqingiz ishlatildi" }[language],
    premiumCta: { tr: "Premium'a geç", en: "Go Premium", ru: "Перейти на Premium", uz: "Premium'ga o'ting" }[language],
    dailyLimit: { tr: "Günde bir mektup", en: "One letter a day", ru: "Одно письмо в день", uz: "Kunda bitta maktub" }[language],
    archiveEyebrow: { tr: "Zaman arşivi", en: "Time archive", ru: "Архив времени", uz: "Vaqt arxivi" }[language],
    archive: { tr: "Gönderilen mektuplar", en: "Sent letters", ru: "Отправленные письма", uz: "Yuborilgan maktublar" }[language],
    fromThePast: { tr: "Zaman portalından", en: "From the time portal", ru: "Из портала времени", uz: "Vaqt portalidan" }[language],
    replyTitle: { tr: "Geçmişten bir cevap", en: "A reply from another time", ru: "Ответ из другого времени", uz: "O'tmishdan javob" }[language],
    yourLetter: { tr: "Senin mektubun", en: "Your letter", ru: "Ваше письмо", uz: "Sizning maktubingiz" }[language],
    arrived: { tr: "Ulaştı", en: "Arrived", ru: "Доставлено", uz: "Yetib keldi" }[language],
    close: { tr: "Mektubu kapat", en: "Close the letter", ru: "Закрыть письмо", uz: "Maktubni yopish" }[language]
  };
}

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    heroCopy: { alignItems: "center", marginBottom: 20 },
    eyebrow: { marginTop: 10, color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase" },
    heroTitle: { marginTop: 4, color: colors.ivory, fontSize: compact ? 20 : 23, lineHeight: compact ? 24 : 28, fontWeight: "700", textAlign: "center", paddingHorizontal: 12 },
    tagline: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "500", textAlign: "center", paddingHorizontal: 18, maxWidth: 340 },
    statusRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 },
    chip: { minHeight: 26, borderRadius: radii.pill, borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.3), backgroundColor: hexAlpha(colors.navy, 0.4), flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9 },
    chipText: { color: colors.ivory, fontSize: 9, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
    recipientBlock: { marginBottom: 18, gap: 8 },
    sectionEyebrow: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
    recipient: {
      minHeight: 68,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: hexAlpha(colors.plum, 0.28),
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      shadowColor: colors.navy,
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5
    },
    portrait: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: hexAlpha(colors.plum, 0.4) },
    portraitEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: hexAlpha(colors.plum, 0.12) },
    recipientCopy: { flex: 1, minWidth: 0, gap: 2 },
    recipientName: { color: colors.ivory, fontSize: 15, fontWeight: "700" },
    recipientLife: { color: colors.muted, fontSize: 12, fontWeight: "500" },
    sheet: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: hexAlpha(colors.plum, 0.22),
      padding: 16,
      overflow: "hidden",
      marginBottom: 16,
      shadowColor: colors.navy,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8
    },
    sheetFocused: { borderColor: hexAlpha(colors.plum, 0.48) },
    surfaceShine: { position: "absolute", top: 0, left: 0, right: 0, height: 1 },
    corner: { position: "absolute", width: 14, height: 14 },
    cornerTl: { top: 8, left: 8, borderTopWidth: 1, borderLeftWidth: 1 },
    cornerBr: { right: 8, bottom: 8, borderRightWidth: 1, borderBottomWidth: 1 },
    sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
    sheetBrand: { color: colors.ivory, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
    sheetKind: { marginTop: 2, color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
    sheetMeta: { alignItems: "flex-end", gap: 4 },
    sheetDate: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
    sheetLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
    sheetTitle: { color: colors.ivory, fontSize: 17, fontWeight: "600", paddingVertical: 6 },
    sheetRule: { height: 1, marginBottom: 10 },
    sheetBody: { position: "relative" },
    guides: { ...StyleSheet.absoluteFillObject, justifyContent: "space-evenly" },
    guide: { height: 1 },
    sheetInput: { color: colors.ivory, fontSize: 15, lineHeight: 24, fontWeight: "400", zIndex: 1 },
    counter: { marginTop: 8, color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "right" },
    ctaBlock: { alignItems: "center", gap: 8, marginBottom: 8 },
    send: { minHeight: 48, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
    sendGlow: { shadowColor: colors.plum, shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    sendDisabled: { opacity: 0.55 },
    sendText: { color: colors.ivory, fontSize: 14, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    sendHint: { color: colors.muted, fontSize: 12, fontWeight: "500", textAlign: "center" },
    feedback: { fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 12 },
    archive: { marginTop: 22, gap: 8 },
    archiveEyebrow: { color: colors.plum, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
    archiveTitle: { color: colors.ivory, fontSize: 16, fontWeight: "800", marginBottom: 4 },
    archiveGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
    archiveCard: { width: "48.5%", minHeight: 68, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 10, paddingVertical: 9, gap: 6 },
    archiveCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    archiveMeta: { color: colors.muted, fontSize: 10, fontWeight: "800", flex: 1 },
    archivePreview: { color: colors.ivory, fontSize: 12, fontWeight: "700" }
  });
}

const replyStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(4, 6, 14, 0.78)", alignItems: "center", justifyContent: "center", padding: 18 },
  card: { width: "100%", maxWidth: 420, zIndex: 1, borderRadius: radii.xl, borderWidth: 1, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16, gap: 10 },
  seal: { alignSelf: "center", width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stamp: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, textAlign: "center", textTransform: "uppercase" },
  headline: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  artist: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  original: { borderRadius: radii.sm, padding: 10, gap: 4 },
  originalLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  originalText: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  replyScroll: { maxHeight: 220 },
  replyBody: { paddingBottom: 4 },
  replyText: { fontSize: 15, fontWeight: "600", lineHeight: 23 },
  meta: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  close: { minHeight: 42, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  closeText: { fontWeight: "800" }
});
