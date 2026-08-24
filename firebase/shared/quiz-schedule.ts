import { buildDailyQuizDocumentId, buildWeeklyQuizDocumentId } from "./quiz-week";

export function weeklyQuizDocId(periodId: string) {
  return buildWeeklyQuizDocumentId(periodId);
}

export function dailyQuizDocId(periodId: string) {
  return buildDailyQuizDocumentId(periodId);
}

export type QuizPackRotationResult = {
  messages: string[];
  publishedWeekly: boolean;
  publishedDaily: boolean;
};

type QuizPackSnapshot = {
  id: string;
  type?: string;
  weekId?: string;
  status?: string;
};

export function buildQuizRotationPlan(
  archivedPeriodId: string,
  nextPeriodId: string,
  packs: QuizPackSnapshot[]
) {
  const archiveIds = packs
    .filter((pack) => pack.weekId === archivedPeriodId && pack.status === "published")
    .map((pack) => pack.id);
  const weeklyNextId = weeklyQuizDocId(nextPeriodId);
  const dailyNextId = dailyQuizDocId(nextPeriodId);
  const weeklyCandidate = packs.find((pack) => pack.id === weeklyNextId || (pack.type === "weekly" && pack.weekId === nextPeriodId && pack.status === "scheduled"));
  const dailyCandidate = packs.find((pack) => pack.id === dailyNextId || (pack.type === "daily" && pack.weekId === nextPeriodId && pack.status === "scheduled"));
  return {
    archiveIds,
    publishWeeklyId: weeklyCandidate?.status === "scheduled" ? weeklyCandidate.id : "",
    publishDailyId: dailyCandidate?.status === "scheduled" ? dailyCandidate.id : "",
    hidePublishedForWeek: nextPeriodId
  };
}
