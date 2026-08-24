import { buildProphecyFirestorePayload, resolveProphecyWinnerId, resolvePoolEntrySubtitles, resolvePoolEntryTitles, type DuelPoolEntry, type ProphecyWeekPackage } from "./duel-automation";
import { createWeeklyCandidateSlots, defaultProphecyQuestion, defaultProphecyTitle } from "./prophecy-duel-bridge";

export type ProphecyPackageKind = "artwork" | "artist";
export type ProphecyPackageStatus = "draft" | "scheduled" | "active" | "finished" | "cancelled";

export type ScheduledProphecyPackage = {
  id: string;
  kind: ProphecyPackageKind;
  title: string;
  titleLocalized?: Partial<Record<"tr" | "en" | "ru" | "uz", string>>;
  question: string;
  questionLocalized?: Partial<Record<"tr" | "en" | "ru" | "uz", string>>;
  candidates: DuelPoolEntry[];
  startsAt: string;
  endsAt: string;
  status: ProphecyPackageStatus;
  liveWeekId?: string;
  winnerId?: string;
  statsSnapshot?: {
    totalPredictions: number;
    correctPredictions: number;
    missedPredictions: number;
    pointsAwarded: number;
    winnerId: string;
    winnerName: string;
    candidates: { id: string; name: string; predictions: number }[];
  };
};

export const PROPHECY_PACKAGES_COLLECTION = "prophecyPackages";

export function createScheduledProphecyPackage(kind: ProphecyPackageKind = "artwork"): ScheduledProphecyPackage {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const question = defaultProphecyQuestion(kind);
  const title = defaultProphecyTitle(kind, now);
  return {
    id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title,
    titleLocalized: { tr: title, en: title, ru: title, uz: title },
    question,
    questionLocalized: { tr: question, en: question, ru: question, uz: question },
    candidates: createWeeklyCandidateSlots(),
    startsAt: toDateTimeLocal(now),
    endsAt: toDateTimeLocal(weekLater),
    status: "draft"
  };
}

export function resolveLocalizedField(primary: string, localized?: Partial<Record<"tr" | "en" | "ru" | "uz", string>>) {
  const tr = localized?.tr?.trim() || primary.trim();
  return {
    tr,
    en: localized?.en?.trim() || tr,
    ru: localized?.ru?.trim() || tr,
    uz: localized?.uz?.trim() || tr
  };
}

export function toDateTimeLocal(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function parseScheduleDate(value: string | Date | undefined | null) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function packageToWeekPackage(pkg: ScheduledProphecyPackage): ProphecyWeekPackage {
  return {
    id: pkg.id,
    title: pkg.title,
    question: pkg.question,
    candidates: pkg.candidates
  };
}

export function validateScheduledPackage(pkg: ScheduledProphecyPackage) {
  const startsAt = parseScheduleDate(pkg.startsAt);
  const endsAt = parseScheduleDate(pkg.endsAt);
  const candidates = pkg.candidates.filter((candidate) => candidate.title.trim());
  if (!pkg.title.trim()) return "Başlık gerekli.";
  if (!pkg.question.trim()) return "Soru gerekli.";
  if (candidates.length < 2) return "En az 2 aday gerekli.";
  if (!startsAt || !endsAt) return "Başlangıç ve bitiş tarihi gerekli.";
  if (endsAt.getTime() <= startsAt.getTime()) return "Bitiş tarihi başlangıçtan sonra olmalı.";
  return null;
}

export function prophecyPackagePayload(pkg: ScheduledProphecyPackage) {
  const candidates = pkg.candidates
    .filter((candidate) => candidate.title.trim())
    .map((candidate) => ({
      id: candidate.id,
      title: resolvePoolEntryTitles(candidate),
      image: candidate.image,
      subtitle: resolvePoolEntrySubtitles(candidate)
    }));

  return {
    kind: pkg.kind,
    title: resolveLocalizedField(pkg.title, pkg.titleLocalized),
    question: resolveLocalizedField(pkg.question, pkg.questionLocalized),
    candidates,
    startsAt: parseScheduleDate(pkg.startsAt) || new Date(),
    endsAt: parseScheduleDate(pkg.endsAt) || new Date(),
    status: pkg.status,
    liveWeekId: pkg.liveWeekId || "",
    winnerId: pkg.winnerId || ""
  };
}

export function buildLiveProphecyWeekPayload(pkg: ScheduledProphecyPackage) {
  const startsAt = parseScheduleDate(pkg.startsAt) || new Date();
  const endsAt = parseScheduleDate(pkg.endsAt) || new Date();
  const payload = buildProphecyFirestorePayload({
    pkg: packageToWeekPackage(pkg),
    kind: pkg.kind,
    startsAt,
    endsAt
  });
  const candidates = pkg.candidates
    .filter((candidate) => candidate.title.trim())
    .map((candidate) => ({
      id: candidate.id,
      title: resolvePoolEntryTitles(candidate),
      image: candidate.image,
      predictions: 0
    }));
  return {
    ...payload,
    title: resolveLocalizedField(pkg.title, pkg.titleLocalized),
    question: resolveLocalizedField(pkg.question, pkg.questionLocalized),
    candidates,
    schedulePackageId: pkg.id
  };
}

function readLocalizedField(value: unknown) {
  if (typeof value === "string") {
    return { tr: value, en: value, ru: value, uz: value };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const tr = stringPlain(record.tr) || stringPlain(record.all);
    return {
      tr,
      en: stringPlain(record.en) || tr,
      ru: stringPlain(record.ru) || tr,
      uz: stringPlain(record.uz) || tr
    };
  }
  return { tr: "", en: "", ru: "", uz: "" };
}

export function normalizeScheduledProphecyPackage(id: string, raw: Record<string, unknown>): ScheduledProphecyPackage {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  return {
    id,
    kind: raw.kind === "artist" ? "artist" : "artwork",
    title: localizedPlain(raw.title),
    question: localizedPlain(raw.question),
    candidates: candidates.map((candidate, index) => {
      const record = typeof candidate === "object" && candidate ? (candidate as Record<string, unknown>) : {};
      const titleRecord = typeof record.title === "object" && record.title ? (record.title as Record<string, unknown>) : {};
      const subtitleRecord = typeof record.subtitle === "object" && record.subtitle ? (record.subtitle as Record<string, unknown>) : {};
      const trTitle = localizedPlain(record.title);
      return {
        id: stringPlain(record.id, `candidate-${id}-${index}`),
        title: trTitle,
        titles: {
          tr: localizedPlain(titleRecord.tr) || trTitle,
          en: localizedPlain(titleRecord.en) || trTitle,
          ru: localizedPlain(titleRecord.ru) || trTitle,
          uz: localizedPlain(titleRecord.uz) || trTitle
        },
        subtitle: localizedPlain(record.subtitle),
        subtitles: {
          tr: localizedPlain(subtitleRecord.tr),
          en: localizedPlain(subtitleRecord.en),
          ru: localizedPlain(subtitleRecord.ru),
          uz: localizedPlain(subtitleRecord.uz)
        },
        image: stringPlain(record.image)
      };
    }),
    startsAt: datePlain(raw.startsAt),
    endsAt: datePlain(raw.endsAt),
    status: normalizePackageStatus(raw.status),
    liveWeekId: stringPlain(raw.liveWeekId) || undefined,
    winnerId: stringPlain(raw.winnerId) || undefined,
    statsSnapshot: raw.statsSnapshot && typeof raw.statsSnapshot === "object"
      ? (raw.statsSnapshot as ScheduledProphecyPackage["statsSnapshot"])
      : undefined,
    titleLocalized: readLocalizedField(raw.title),
    questionLocalized: readLocalizedField(raw.question)
  };
}

export function packageStatusLabel(status: ProphecyPackageStatus) {
  const labels: Record<ProphecyPackageStatus, string> = {
    draft: "Taslak",
    scheduled: "Planlandı",
    active: "Aktif",
    finished: "Tamamlandı",
    cancelled: "İptal"
  };
  return labels[status];
}

export function kindLabel(kind: ProphecyPackageKind) {
  return kind === "artwork" ? "Eser kehaneti" : "Sanatçı kehaneti";
}

export function pickNextScheduledPackage(
  packages: ScheduledProphecyPackage[],
  kind: ProphecyPackageKind,
  now = new Date(),
  options?: { immediate?: boolean }
) {
  return packages
    .filter((pkg) => {
      if (pkg.kind !== kind || pkg.status !== "scheduled") return false;
      if (options?.immediate) return true;
      const startsAt = parseScheduleDate(pkg.startsAt);
      const endsAt = parseScheduleDate(pkg.endsAt);
      if (!startsAt || !endsAt) return false;
      return startsAt.getTime() <= now.getTime() && endsAt.getTime() > now.getTime();
    })
    .sort((a, b) => (parseScheduleDate(a.startsAt)?.getTime() || 0) - (parseScheduleDate(b.startsAt)?.getTime() || 0))[0];
}

export function realignPackageWeekDates(pkg: ScheduledProphecyPackage, now = new Date()) {
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    ...pkg,
    startsAt: toDateTimeLocal(now),
    endsAt: toDateTimeLocal(endsAt)
  };
}

export function resolveWinnerFromCounts(candidates: { id: string; predictions: number }[]) {
  return resolveProphecyWinnerId(candidates);
}

function normalizePackageStatus(value: unknown): ProphecyPackageStatus {
  if (value === "scheduled" || value === "active" || value === "finished" || value === "cancelled" || value === "draft") {
    return value;
  }
  return "draft";
}

function localizedPlain(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringPlain(record.tr) || stringPlain(record.en) || stringPlain(record.all);
  }
  return "";
}

function stringPlain(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function datePlain(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return toDateTimeLocal(value);
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return toDateTimeLocal((value as { toDate: () => Date }).toDate());
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : toDateTimeLocal(parsed);
}
