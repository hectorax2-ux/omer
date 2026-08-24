import { Timestamp, collection, getDocs, limit, onSnapshot, query } from "firebase/firestore";
import {
  COMPETITION_ARCHIVES_COLLECTION,
  TOP_WINNERS_COUNT,
  buildContiguousArchiveWeekNumbers,
  formatWeekTitle,
  getVisibleArchiveWinners,
  normalizeArchiveWinners,
  sortArchivesNewestFirst,
  type CompetitionArchiveWinner,
  type LocalizedString
} from "../../../firebase/shared/competition-week";
import { firestoreDb } from "@/src/services/firebase";

export type CompetitionArchiveRecord = {
  id: string;
  weekId: string;
  weekNumber: number;
  weekLabel: string;
  seasonWeekLabel: LocalizedString;
  title: LocalizedString;
  competition: "weekly_artworks" | "weekly_quiz" | "guess_artwork";
  status: string;
  archivedAtMs: number;
  winners: CompetitionArchiveWinner[];
};

function timestampToMs(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function normalizeLocalizedTitle(value: unknown, periodId: string): LocalizedString {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const fallback = formatWeekTitle(periodId);
    return {
      tr: typeof record.tr === "string" && record.tr.trim() ? record.tr : fallback.tr,
      en: typeof record.en === "string" && record.en.trim() ? record.en : fallback.en,
      ru: typeof record.ru === "string" && record.ru.trim() ? record.ru : fallback.ru,
      uz: typeof record.uz === "string" && record.uz.trim() ? record.uz : fallback.uz
    };
  }
  return formatWeekTitle(periodId);
}

export function mapCompetitionArchiveFromFirebase(id: string, data: Record<string, unknown>): CompetitionArchiveRecord {
  const competition =
    data.competition === "weekly_quiz" || data.competition === "guess_artwork" ? data.competition : "weekly_artworks";
  const periodId = typeof data.weekId === "string" && data.weekId.trim() ? data.weekId.trim() : id.split("~")[0] ?? id;
  const winners = normalizeArchiveWinners(data.winners);
  const weekLabel =
    typeof data.weekLabel === "string" && data.weekLabel.trim()
      ? data.weekLabel.trim()
      : formatWeekTitle(periodId).tr.replace(" haftası", "");
  const archivedAtMs = timestampToMs(data.archivedAt ?? data.createdAt);

  return {
    id,
    weekId: periodId,
    weekNumber: 0,
    weekLabel,
    seasonWeekLabel: { tr: "", en: "", ru: "", uz: "" },
    title: normalizeLocalizedTitle(data.title, periodId),
    competition,
    status: typeof data.status === "string" ? data.status : "",
    archivedAtMs,
    winners
  };
}

export function applyPublishedArchiveDisplayNumbers(items: CompetitionArchiveRecord[]) {
  const numbered = buildContiguousArchiveWeekNumbers(items);
  return sortArchivesNewestFirst(numbered);
}

export function getPublicArchiveWinners(archive: CompetitionArchiveRecord) {
  return getVisibleArchiveWinners(archive.winners).slice(0, TOP_WINNERS_COUNT);
}

function isPublicWeeklyArchive(archive: CompetitionArchiveRecord, raw?: Record<string, unknown>) {
  return archive.competition === "weekly_artworks"
    && archive.status !== "draft"
    && archive.status !== "hidden"
    && archive.status !== "deleted"
    && raw?.isDeleted !== true
    && raw?.deletedAt == null;
}

export async function fetchPublishedWeeklyArchives(limitCount = 200): Promise<CompetitionArchiveRecord[]> {
  const snapshot = await getDocs(query(collection(firestoreDb, COMPETITION_ARCHIVES_COLLECTION), limit(limitCount)));
  const mapped = snapshot.docs
    .map((docSnapshot) => {
      const raw = docSnapshot.data() as Record<string, unknown>;
      return { archive: mapCompetitionArchiveFromFirebase(docSnapshot.id, raw), raw };
    })
    .filter((item) => isPublicWeeklyArchive(item.archive, item.raw))
    .map((item) => item.archive);

  return applyPublishedArchiveDisplayNumbers(mapped);
}

export function subscribePublishedWeeklyArchives(
  onChange: (archives: CompetitionArchiveRecord[]) => void,
  onError?: (error: Error) => void,
  limitCount = 200
) {
  return onSnapshot(
    query(collection(firestoreDb, COMPETITION_ARCHIVES_COLLECTION), limit(limitCount)),
    (snapshot) => {
      const mapped = snapshot.docs
        .map((docSnapshot) => {
          const raw = docSnapshot.data() as Record<string, unknown>;
          return { archive: mapCompetitionArchiveFromFirebase(docSnapshot.id, raw), raw };
        })
        .filter((item) => isPublicWeeklyArchive(item.archive, item.raw))
        .map((item) => item.archive);
      onChange(applyPublishedArchiveDisplayNumbers(mapped));
    },
    (error) => onError?.(error)
  );
}

export function getArchiveDateCaption(archive: CompetitionArchiveRecord, language: keyof LocalizedString) {
  const parts = [archive.weekLabel, archive.title[language]].filter(Boolean);
  return parts.join(" · ");
}
