export type ScheduledContentRule = {
  collection: string;
  queryStatus: string;
  publishStatus: string;
  extra?: Record<string, unknown>;
};

export const SCHEDULED_CONTENT_RULES: ScheduledContentRule[] = [
  { collection: "bookFilms", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "artworks", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "artists", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "museums", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "artStories", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "quizzes", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "notifications", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "rewardInfos", queryStatus: "scheduled", publishStatus: "published" },
  { collection: "posts", queryStatus: "pending", publishStatus: "published" },
  {
    collection: "communityImages",
    queryStatus: "pending",
    publishStatus: "published",
    extra: { reviewedBy: "admin" }
  }
];

export function scheduledAtMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "object" && value !== null && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function isDueScheduledContent(data: Record<string, unknown>, now = Date.now()) {
  const dueAt = scheduledAtMillis(data.scheduledAt);
  return dueAt > 0 && dueAt <= now;
}

export function mapFirestoreScheduledStatus(data: Record<string, unknown>) {
  const raw = typeof data.status === "string" ? data.status : "";
  const scheduledAtMs = scheduledAtMillis(data.scheduledAt);
  if ((raw === "pending" || raw === "scheduled") && scheduledAtMs > Date.now()) return "scheduled";
  if (raw === "scheduled") return "scheduled";
  return raw;
}
