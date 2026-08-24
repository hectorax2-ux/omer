export type DuelPoolEntry = {
  id: string;
  title: string;
  titles?: Partial<Record<"tr" | "en" | "ru" | "uz", string>>;
  subtitle?: string;
  subtitles?: Partial<Record<"tr" | "en" | "ru" | "uz", string>>;
  image: string;
};

export type AppLanguage = "tr" | "en" | "ru" | "uz";
export type LocalizedString = Record<AppLanguage, string>;

export function emptyLocalizedString(fallback = ""): LocalizedString {
  return { tr: fallback, en: fallback, ru: fallback, uz: fallback };
}

export function resolvePoolEntryTitles(entry: DuelPoolEntry): LocalizedString {
  const base = entry.title.trim();
  const titles = entry.titles ?? {};
  const tr = titles.tr?.trim() || base;
  return {
    tr,
    en: titles.en?.trim() || tr,
    ru: titles.ru?.trim() || tr,
    uz: titles.uz?.trim() || tr
  };
}

export function resolvePoolEntrySubtitles(entry: DuelPoolEntry): LocalizedString {
  const base = (entry.subtitle ?? "").trim();
  const subtitles = entry.subtitles ?? {};
  const tr = subtitles.tr?.trim() || base;
  return {
    tr,
    en: subtitles.en?.trim() || tr,
    ru: subtitles.ru?.trim() || tr,
    uz: subtitles.uz?.trim() || tr
  };
}

export type ProphecyWeekPackage = {
  id: string;
  title: string;
  question: string;
  candidates: DuelPoolEntry[];
};

export type DuelTypeState = {
  lastWinnerPoolId?: string;
  currentDuelId?: string;
  initialized?: boolean;
  lastRotationDayKey?: string;
  /** Index into the ordered weekly pool for the next challenger after the opening pair. */
  nextChallengerIndex?: number;
  /** Pool ids eliminated from the weekly bracket. */
  eliminatedPoolIds?: string[];
  /** No further daily duels until the next prophecy week. */
  bracketComplete?: boolean;
};

export function resetDuelTypeState(): DuelTypeState {
  return {};
}

export type DuelAutomationConfig = {
  enabled: boolean;
  timezone: string;
  dailyRotationHour: number;
  artworkPool: DuelPoolEntry[];
  artistPool: DuelPoolEntry[];
  prophecyArtworkWeeks: ProphecyWeekPackage[];
  prophecyArtistWeeks: ProphecyWeekPackage[];
  artworkState: DuelTypeState;
  artistState: DuelTypeState;
  prophecyArtworkWeekIndex: number;
  prophecyArtistWeekIndex: number;
  activeProphecyArtworkWeekId?: string;
  activeProphecyArtistWeekId?: string;
};

export const DUEL_AUTOMATION_DOC_ID = "settings";
export const DUEL_AUTOMATION_COLLECTION = "duelAutomation";
export const DEFAULT_TIMEZONE = "Europe/Istanbul";
export const DEFAULT_DAILY_HOUR = 21;
export const PROPHECY_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function createPoolEntry(title = "", subtitle = "", image = ""): DuelPoolEntry {
  return {
    id: `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    subtitle,
    image
  };
}

export function createProphecyWeekPackage(title = "", question = ""): ProphecyWeekPackage {
  return {
    id: `week-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    question,
    candidates: [createPoolEntry(), createPoolEntry()]
  };
}

export function defaultDuelAutomationConfig(): DuelAutomationConfig {
  return {
    enabled: false,
    timezone: DEFAULT_TIMEZONE,
    dailyRotationHour: DEFAULT_DAILY_HOUR,
    artworkPool: [],
    artistPool: [],
    prophecyArtworkWeeks: [],
    prophecyArtistWeeks: [],
    artworkState: {},
    artistState: {},
    prophecyArtworkWeekIndex: 0,
    prophecyArtistWeekIndex: 0
  };
}

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
};

export function getTimezoneParts(date = new Date(), timeZone = DEFAULT_TIMEZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

export function getDayKey(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getTimezoneParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shouldRunDailyRotation(lastRotationDayKey: string | undefined, dailyRotationHour: number, date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getTimezoneParts(date, timeZone);
  if (parts.hour < dailyRotationHour) return false;
  const todayKey = getDayKey(date, timeZone);
  return lastRotationDayKey !== todayKey;
}

export function shouldRotateDailyDuel(
  state: DuelTypeState,
  dailyRotationHour: number,
  activeDuelEndsAt: Date | null | undefined,
  date = new Date(),
  timeZone = DEFAULT_TIMEZONE
) {
  if (state.bracketComplete) return false;

  const todayKey = getDayKey(date, timeZone);
  const nowMs = date.getTime();

  if (activeDuelEndsAt && activeDuelEndsAt.getTime() <= nowMs && state.lastRotationDayKey !== todayKey) {
    return true;
  }

  if (!activeDuelEndsAt && state.initialized && !state.currentDuelId && state.lastRotationDayKey !== todayKey) {
    return shouldRunDailyRotation(state.lastRotationDayKey, dailyRotationHour, date, timeZone);
  }

  return shouldRunDailyRotation(state.lastRotationDayKey, dailyRotationHour, date, timeZone);
}

export function needsInitialDailyDuel(state: DuelTypeState, hasActiveWeek: boolean, hasActiveDuel: boolean) {
  if (!hasActiveWeek || hasActiveDuel || state.bracketComplete) return false;
  return !state.initialized || !state.currentDuelId;
}

export function istanbulLocalToDate(year: string, month: string, day: string, hour: number, minute = 0) {
  const iso = `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:00`;
  return new Date(iso);
}

export function getDailyDuelWindow(dailyRotationHour: number, date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getTimezoneParts(date, timeZone);
  const todayRotation = istanbulLocalToDate(parts.year, parts.month, parts.day, dailyRotationHour);
  const startsAt = parts.hour < dailyRotationHour
    ? new Date(todayRotation.getTime() - 24 * 60 * 60 * 1000)
    : todayRotation;
  const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    dayKey: getDayKey(startsAt, timeZone),
    startsAt,
    endsAt
  };
}

export function pickRandomOpponent(pool: DuelPoolEntry[], excludeId: string): DuelPoolEntry | null {
  const candidates = pool.filter((entry) => entry.id !== excludeId && entry.title.trim());
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

export function resolveWinnerSide(votesA: number, votesB: number): "a" | "b" {
  if (votesA >= votesB) return "a";
  return "b";
}

export function resolveWinnerPoolId(
  votesA: number,
  votesB: number,
  sideAPoolId?: string,
  sideBPoolId?: string
): string | undefined {
  const side = resolveWinnerSide(votesA, votesB);
  return side === "a" ? sideAPoolId : sideBPoolId;
}

export function resolveLoserPoolId(
  votesA: number,
  votesB: number,
  sideAPoolId?: string,
  sideBPoolId?: string
): string | undefined {
  const winnerId = resolveWinnerPoolId(votesA, votesB, sideAPoolId, sideBPoolId);
  if (!winnerId) return undefined;
  if (winnerId === sideAPoolId) return sideBPoolId;
  return sideAPoolId;
}

export function buildInitialPair(pool: DuelPoolEntry[]): [DuelPoolEntry, DuelPoolEntry] | null {
  const usable = pool.filter((entry) => entry.title.trim());
  if (usable.length < 2) return null;
  return [usable[0], usable[1]];
}

export function buildNextBracketPair(
  pool: DuelPoolEntry[],
  winnerPoolId: string,
  nextChallengerIndex: number
): { pair: [DuelPoolEntry, DuelPoolEntry]; nextChallengerIndex: number } | null {
  const usable = pool.filter((entry) => entry.title.trim());
  const winner = usable.find((entry) => entry.id === winnerPoolId);
  if (!winner) return null;
  if (nextChallengerIndex >= usable.length) return null;
  const challenger = usable[nextChallengerIndex];
  if (!challenger || challenger.id === winner.id) return null;
  return {
    pair: [winner, challenger],
    nextChallengerIndex: nextChallengerIndex + 1
  };
}

/** @deprecated Use buildNextBracketPair for weekly elimination brackets. */
export function buildWinnerPair(pool: DuelPoolEntry[], winnerPoolId: string): [DuelPoolEntry, DuelPoolEntry] | null {
  const next = buildNextBracketPair(pool, winnerPoolId, 2);
  return next?.pair ?? null;
}

export function advanceDuelBracket(
  pool: DuelPoolEntry[],
  state: DuelTypeState,
  closedDuel?: { winnerPoolId?: string; loserPoolId?: string }
) {
  if (state.bracketComplete) {
    return { pair: null as [DuelPoolEntry, DuelPoolEntry] | null, nextState: state, bracketComplete: true };
  }

  const usable = pool.filter((entry) => entry.title.trim());
  const eliminatedPoolIds = closedDuel?.loserPoolId
    ? [...(state.eliminatedPoolIds ?? []), closedDuel.loserPoolId]
    : state.eliminatedPoolIds ?? [];

  if (!state.initialized || (!closedDuel?.winnerPoolId && !state.lastWinnerPoolId)) {
    const initial = buildInitialPair(usable);
    if (!initial) {
      return { pair: null, nextState: state, bracketComplete: false };
    }
    return {
      pair: initial,
      nextState: {
        ...state,
        initialized: true,
        nextChallengerIndex: 2,
        eliminatedPoolIds: [],
        lastWinnerPoolId: undefined,
        bracketComplete: false
      },
      bracketComplete: false
    };
  }

  const winnerPoolId = closedDuel?.winnerPoolId || state.lastWinnerPoolId;
  if (!winnerPoolId) {
    return { pair: null, nextState: state, bracketComplete: false };
  }

  const nextChallengerIndex = state.nextChallengerIndex ?? 2;
  const next = buildNextBracketPair(usable, winnerPoolId, nextChallengerIndex);
  if (!next) {
    return {
      pair: null,
      nextState: {
        ...state,
        lastWinnerPoolId: winnerPoolId,
        eliminatedPoolIds,
        bracketComplete: true,
        currentDuelId: undefined
      },
      bracketComplete: true
    };
  }

  return {
    pair: next.pair,
    nextState: {
      ...state,
      lastWinnerPoolId: winnerPoolId,
      nextChallengerIndex: next.nextChallengerIndex,
      eliminatedPoolIds,
      bracketComplete: false
    },
    bracketComplete: false
  };
}

export function buildLocalizedText(text: string) {
  return { tr: text, en: text, ru: text, uz: text, all: text };
}

export function buildDuelFirestorePayload(params: {
  type: "artwork" | "artist";
  title: string;
  description: string;
  sideA: DuelPoolEntry;
  sideB: DuelPoolEntry;
  startsAt: Date;
  endsAt: Date;
  notificationEnabled?: boolean;
}) {
  return {
    kind: params.type,
    type: params.type,
    title: buildLocalizedText(params.title),
    description: buildLocalizedText(params.description),
    sideA: {
      id: "a",
      sourceId: params.sideA.id,
      title: resolvePoolEntryTitles(params.sideA),
      subtitle: resolvePoolEntrySubtitles(params.sideA),
      image: params.sideA.image
    },
    sideB: {
      id: "b",
      sourceId: params.sideB.id,
      title: resolvePoolEntryTitles(params.sideB),
      subtitle: resolvePoolEntrySubtitles(params.sideB),
      image: params.sideB.image
    },
    sideATitle: resolvePoolEntryTitles(params.sideA).tr,
    sideBTitle: resolvePoolEntryTitles(params.sideB).tr,
    sideASubtitle: resolvePoolEntrySubtitles(params.sideA).tr,
    sideBSubtitle: resolvePoolEntrySubtitles(params.sideB).tr,
    sideAImage: params.sideA.image,
    sideBImage: params.sideB.image,
    sideAPoolId: params.sideA.id,
    sideBPoolId: params.sideB.id,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    votesA: 0,
    votesB: 0,
    active: true,
    status: "active",
    notificationEnabled: params.notificationEnabled ?? true,
    automated: true
  };
}

export function buildProphecyFirestorePayload(params: {
  pkg: ProphecyWeekPackage;
  kind: "artwork" | "artist";
  startsAt: Date;
  endsAt: Date;
}) {
  const candidates = params.pkg.candidates
    .filter((candidate) => candidate.title.trim())
    .map((candidate) => ({
      id: candidate.id,
      title: resolvePoolEntryTitles(candidate),
      image: candidate.image,
      predictions: 0
    }));

  return {
    kind: params.kind,
    title: buildLocalizedText(params.pkg.title),
    question: buildLocalizedText(params.pkg.question),
    candidates,
    winnerId: "",
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    status: "active",
    active: true,
    automated: true,
    packageId: params.pkg.id
  };
}

export function shouldRotateProphecyWeek(endsAt: Date | null | undefined, now = new Date()) {
  if (!endsAt) return false;
  return now.getTime() >= endsAt.getTime();
}

export function getNextWeekIndex(currentIndex: number, length: number) {
  if (length <= 0) return 0;
  return (currentIndex + 1) % length;
}

export function getProphecyWeekWindow(now = new Date()) {
  const startsAt = now;
  const endsAt = new Date(now.getTime() + PROPHECY_WEEK_MS);
  return { startsAt, endsAt };
}

export function resolveProphecyWinnerId(
  candidates: { id: string; predictions: number }[]
): string | undefined {
  if (!candidates.length) return undefined;
  let winner = candidates[0];
  for (const candidate of candidates) {
    if (candidate.predictions > winner.predictions) {
      winner = candidate;
    }
  }
  return winner.id;
}

export function duelTitleForType(type: "artwork" | "artist") {
  return type === "artwork" ? "Günün Eser Düellosu" : "Günün Sanatçı Düellosu";
}

export function duelDescriptionForType(type: "artwork" | "artist") {
  return type === "artwork"
    ? "Hafta boyunca günlük eser eşleşmeleri devam eder."
    : "Hafta boyunca günlük sanatçı eşleşmeleri devam eder.";
}

export function normalizeDuelAutomationConfig(raw: Partial<DuelAutomationConfig> | undefined): DuelAutomationConfig {
  const defaults = defaultDuelAutomationConfig();
  if (!raw) return defaults;
  return {
    ...defaults,
    ...raw,
    artworkPool: Array.isArray(raw.artworkPool) ? raw.artworkPool : defaults.artworkPool,
    artistPool: Array.isArray(raw.artistPool) ? raw.artistPool : defaults.artistPool,
    prophecyArtworkWeeks: Array.isArray(raw.prophecyArtworkWeeks) ? raw.prophecyArtworkWeeks : defaults.prophecyArtworkWeeks,
    prophecyArtistWeeks: Array.isArray(raw.prophecyArtistWeeks) ? raw.prophecyArtistWeeks : defaults.prophecyArtistWeeks,
    artworkState: { ...defaults.artworkState, ...(raw.artworkState ?? {}) },
    artistState: { ...defaults.artistState, ...(raw.artistState ?? {}) },
    prophecyArtworkWeekIndex: typeof raw.prophecyArtworkWeekIndex === "number" ? raw.prophecyArtworkWeekIndex : 0,
    prophecyArtistWeekIndex: typeof raw.prophecyArtistWeekIndex === "number" ? raw.prophecyArtistWeekIndex : 0
  };
}
