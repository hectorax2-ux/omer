import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { runDuelAutomationAdmin } from "./run-duel-automation";
import { ensureDailyJigsawPuzzle } from "./jigsaw-game-functions";

if (!admin.apps.length) admin.initializeApp();

export { purgeUserAccount } from "./delete-user-account";
export { syncDuelVoteCounts } from "./sync-duel-vote";
export { syncProphecyPredictionCounts } from "./sync-prophecy-predictions";
export { syncChanceCardSeerPoints } from "./sync-chance-card-seer";
export { drawChanceCard } from "./chance-card-functions";
export { activateDailyJigsawGame, completeDailyJigsawGame, prepareDailyJigsawGame } from "./jigsaw-game-functions";
import { runCompetitionWeekAutomation } from "./competition-week-runner";
import { runNotificationAutomationAdmin } from "./notification-automation-runner";
import { runScheduledContentPublishAdmin } from "./content-schedule-runner";
import { processPendingExpoPushReceipts } from "./push-notifications";

export { finishCompetitionWeekAdmin, resetCompetitionUploadQuotasAdmin } from "./competition-week-runner";
export { syncUserFollowCounts } from "./sync-follow-counts";
export { syncProfileVisit, syncProfileVisitPrivacy } from "./sync-profile-visits";
export { syncLikeCounts, syncFavoriteCounts } from "./sync-engagement-counts";
export { sendDirectMessage, directMessageConversationAction, blockDirectMessageUser, unblockDirectMessageUser, reportDirectMessage, sendAdminDirectMessage } from "./send-direct-message";
export { activatePremiumPurchase } from "./activate-premium-purchase";
export { appStoreServerNotifications } from "./app-store-server-notifications";
export { syncPremiumStatus, expirePremiumSubscriptions } from "./sync-premium-status";
export { setManualPremium } from "./set-manual-premium";
export {
  normalizeArtStoryPremium,
  normalizeCommunityImageCommentPremium,
  normalizeCommunityImagePremium,
  normalizePostCommentPremium,
  normalizePostPremium,
  syncPremiumContentOnUserChange
} from "./premium/premium-content-sync";
export { premiumSubscriptionPrices } from "./premium-subscription-prices";
export { reconcilePushDeviceRegistration, sendNotificationPush } from "./push-notifications";
export {
  notifyCommunityImageCommentActivity,
  notifyCommunityImageReview,
  notifyDirectMessageActivity,
  notifyNewFollowerActivity,
  notifyPostCommentActivity,
  notifyPostReview,
  notifyReactionActivity
} from "./activity-notifications";
export {
  activateTimelineGame,
  completeTimelineGame,
  finalizeTimelineDailyPercentiles,
  getTimelineGameHistory,
  getTimelineGameState,
  getTimelineLeaderboard,
  prepareTimelineGame
} from "./timeline-game-functions";

export const duelAutomationDaily = onSchedule(
  {
    schedule: "0 21 * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runDuelAutomationAdmin(false);
    logger.info("Duel automation finished", result);
  }
);

export const dailyJigsawAutomation = onSchedule(
  {
    schedule: "5 0 * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const puzzle = await ensureDailyJigsawPuzzle();
    logger.info("Daily Art Detective automation finished", { puzzleId: puzzle.id });
  }
);

export const duelAutomationHourly = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runDuelAutomationAdmin(false);
    if (result.messages.some((message) => message.includes("Yeni düello") || message.includes("haftası başlatıldı") || message.includes("Önceki düello kapatıldı"))) {
      logger.info("Duel automation catch-up run", result);
    }
  }
);

export const ensureDuelRotation = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Düello otomasyonu için oturum gerekli.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "E-posta doğrulaması gerekli.");
  }
  const result = await runDuelAutomationAdmin(false);
  return result;
});

export const competitionWeekAutomationHourly = onSchedule(
  {
    schedule: "10 * * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runCompetitionWeekAutomation(false);
    if (result.ok) {
      logger.info("Competition week automation finished", result);
    }
  }
);

export const competitionWeekAutomationSunday = onSchedule(
  {
    schedule: "59 23 * * 0",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runCompetitionWeekAutomation(true);
    logger.info("Competition week Sunday close", result);
  }
);

export const notificationAutomationQuarterHour = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runNotificationAutomationAdmin(false);
    if (result.dispatched > 0) {
      logger.info("Notification automation dispatched", result);
    }
  }
);

export const expoPushReceiptQuarterHour = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "UTC",
    timeoutSeconds: 300,
    memory: "256MiB"
  },
  async () => {
    await processPendingExpoPushReceipts();
  }
);

export const runNotificationAutomationNow = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Bildirim otomasyonu için oturum gerekli.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "E-posta doğrulaması gerekli.");
  }
  return runNotificationAutomationAdmin(Boolean(request.data?.force));
});

export const scheduledContentPublishMinute = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Europe/Istanbul"
  },
  async () => {
    const result = await runScheduledContentPublishAdmin();
    if (result.published > 0) {
      logger.info("Scheduled content published", result);
    }
  }
);

export const publishScheduledContentNow = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Planlı yayın için oturum gerekli.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "E-posta doğrulaması gerekli.");
  }
  return runScheduledContentPublishAdmin();
});
