import { extractWeekPeriodId } from "../../../firebase/shared/competition-week";
import { listUserCompetitionEntries } from "./community-image-service";
import { listUserChanceCardDraws } from "./art-systems-service";
import { listUserJigsawAttempts } from "./jigsaw-attempt-service";
import { listUserQuizAttempts } from "./quiz-week-service";
import { fetchTimelineGameHistory } from "./timeline-game-service";

export type MemberScoreSummary = {
  totalScore: number;
  completedWeeks: string[];
};

export async function loadMemberScore(uid: string): Promise<MemberScoreSummary> {
  if (!uid) return { totalScore: 0, completedWeeks: [] };
  const [quizAttempts, jigsawAttempts, artworkTimeline, artistTimeline, chanceDraws, competitionEntries] = await Promise.all([
    listUserQuizAttempts(uid).catch(() => []),
    listUserJigsawAttempts(uid).catch(() => []),
    loadTimelineHistory("artwork").catch(() => []),
    loadTimelineHistory("artist").catch(() => []),
    listUserChanceCardDraws(uid).catch(() => []),
    listUserCompetitionEntries(uid).catch(() => [])
  ]);
  const completedWeeks = Array.from(new Set(quizAttempts.map((item) => extractWeekPeriodId(item.weekId))));
  const competitionWeeks = new Set(competitionEntries
    .filter((item) => item.competitionEntry && item.status !== "rejected" && !item.deletedByAdmin && !item.deletedByUser)
    .map((item) => item.weekId)
    .filter(Boolean));
  const chanceDays = new Set(chanceDraws.map((item) => item.dayKey).filter(Boolean));
  const totalScore = quizAttempts.reduce((sum, item) => sum + quizParticipationPoints(item.score), 0)
    + jigsawAttempts.reduce((sum, item) => sum + rankedGamePoints(item.score), 0)
    + [...artworkTimeline, ...artistTimeline].reduce((sum, item) => sum + timelineParticipationPoints(item.correctPositions), 0)
    + chanceDays.size
    + competitionWeeks.size * 3;
  return { totalScore, completedWeeks };
}

export function quizParticipationPoints(score: number) {
  return 2 + Math.max(0, Math.min(3, Math.floor(Math.max(0, score) / 100)));
}

function rankedGamePoints(score: number) {
  return 2 + Math.max(0, Math.min(3, Math.floor(Math.max(0, score) / 50)));
}

function timelineParticipationPoints(correctPositions: number) {
  return 2 + Math.max(0, Math.min(3, Math.floor(Math.max(0, correctPositions) / 3)));
}

async function loadTimelineHistory(gameType: "artwork" | "artist", cursorMs?: number | null, loaded: Awaited<ReturnType<typeof fetchTimelineGameHistory>>["rows"] = []) {
  if (loaded.length >= 200) return loaded;
  const page = await fetchTimelineGameHistory(gameType, cursorMs);
  const next = [...loaded, ...page.rows];
  if (!page.nextCursorMs || !page.rows.length) return next;
  return loadTimelineHistory(gameType, page.nextCursorMs, next);
}
