export const MESSAGING_SETTINGS_DOC = "appSettings/messaging";

export type MessagingSettings = {
  enabled: boolean;
  freeDailyConversationLimit: number;
  freeDailyMessageLimit: number;
  premiumDailyConversationLimit: number | null;
  premiumDailyMessageLimit: number | null;
  freeMaxMessageLength: number;
  premiumMaxMessageLength: number;
  freePinnedConversationLimit: number;
  premiumPinnedConversationLimit: number;
  requireEmailVerified: boolean;
  messageRequestsEnabled: boolean;
  allowFreeColdMessages: boolean;
  allowPremiumColdMessages: boolean;
  pushEnabled: boolean;
  spamProtectionEnabled: boolean;
  perSecondMessageLimit: number;
  perMinuteMessageLimit: number;
  fiveMinuteMessageLimit: number;
  newAccountFirstDayMessageLimit: number;
  newAccountFirstDayConversationLimit: number;
  linkProtectionEnabled: boolean;
};

export const defaultMessagingSettings: MessagingSettings = {
  enabled: true,
  freeDailyConversationLimit: 10,
  freeDailyMessageLimit: 100,
  premiumDailyConversationLimit: null,
  premiumDailyMessageLimit: null,
  freeMaxMessageLength: 750,
  premiumMaxMessageLength: 3000,
  freePinnedConversationLimit: 1,
  premiumPinnedConversationLimit: 10,
  requireEmailVerified: true,
  messageRequestsEnabled: true,
  allowFreeColdMessages: false,
  allowPremiumColdMessages: true,
  pushEnabled: true,
  spamProtectionEnabled: true,
  perSecondMessageLimit: 1,
  perMinuteMessageLimit: 20,
  fiveMinuteMessageLimit: 80,
  newAccountFirstDayMessageLimit: 20,
  newAccountFirstDayConversationLimit: 2,
  linkProtectionEnabled: true
};

export type ConversationStatus = "request" | "active" | "blocked" | "closed" | "archived";

export function conversationIdForParticipants(uidA: string, uidB: string) {
  return uidA < uidB ? `${uidA}__${uidB}` : `${uidB}__${uidA}`;
}

export function otherParticipantIdFromConversationId(currentUid: string, conversationId: string) {
  const parts = conversationId.split("__");
  if (parts.length !== 2) return "";
  if (parts[0] === currentUid) return parts[1];
  if (parts[1] === currentUid) return parts[0];
  return "";
}

export function dayKeyInTimezone(date: Date, timezone = "Europe/Istanbul") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function followDocId(followerId: string, followedId: string) {
  return `${followerId}_${followedId}`;
}
