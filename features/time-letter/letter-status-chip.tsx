import { memo, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatProphecyCountdown } from "@/app/utils/prophecy-prediction";
import { hexAlpha, radii } from "@/constants/design";
import { getThemeColors } from "@/constants/theme";
import { getArtistLetterResetRemainingMs, isSameArtistLetterWindow } from "@/utils/artist-letter-window";

type ThemeColors = ReturnType<typeof getThemeColors>;

function useLetterWindowMs(onWindowUnlock?: () => void) {
  const [remainingMs, setRemainingMs] = useState(getArtistLetterResetRemainingMs);
  const previousMs = useRef(remainingMs);

  useEffect(() => {
    const timer = setInterval(() => setRemainingMs(getArtistLetterResetRemainingMs()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const crossedMidnight = remainingMs > previousMs.current + 60_000;
    const hitZero = previousMs.current > 0 && remainingMs === 0;
    if (crossedMidnight || hitZero) onWindowUnlock?.();
    previousMs.current = remainingMs;
  }, [onWindowUnlock, remainingMs]);

  return remainingMs;
}

export const LetterStatusChip = memo(function LetterStatusChip({
  colors,
  isPremium,
  lastSentAt,
  onWindowUnlock,
  readyLabel
}: {
  colors: ThemeColors;
  isPremium: boolean;
  lastSentAt?: string;
  onWindowUnlock?: () => void;
  readyLabel: string;
}) {
  const remainingMs = useLetterWindowMs(onWindowUnlock);
  const sentToday = Boolean(lastSentAt && isSameArtistLetterWindow(lastSentAt));
  const ready = isPremium && !sentToday;

  return (
    <View style={{
      minHeight: 26,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: ready ? hexAlpha(colors.plum, 0.4) : hexAlpha(colors.gold, 0.32),
      backgroundColor: hexAlpha(colors.navy, 0.45),
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9
    }}>
      <Ionicons color={ready ? colors.plum : colors.gold} name="hourglass-outline" size={11} />
      {ready ? (
        <Text style={{ color: colors.ivory, fontSize: 9, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }}>
          {readyLabel}
        </Text>
      ) : (
        <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: 0.4 }}>
          {formatProphecyCountdown(remainingMs)}
        </Text>
      )}
    </View>
  );
});

export const LetterPolicyNote = memo(function LetterPolicyNote({
  colors,
  dailyLabel,
  isPremium,
  lastSentAt,
  nextLabel
}: {
  colors: ThemeColors;
  dailyLabel: string;
  isPremium: boolean;
  lastSentAt?: string;
  nextLabel: string;
}) {
  const remainingMs = useLetterWindowMs();
  const sentToday = Boolean(lastSentAt && isSameArtistLetterWindow(lastSentAt));
  const waiting = isPremium && sentToday;

  return (
    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
      {waiting ? `${dailyLabel} · ${nextLabel} ${formatProphecyCountdown(remainingMs)}` : dailyLabel}
    </Text>
  );
});
