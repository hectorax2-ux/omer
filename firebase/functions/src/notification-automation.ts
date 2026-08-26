export type NotificationAutomationTrigger =
  | "daily_midnight_reset"
  | "daily_duel_rotation"
  | "weekly_prophecy_start"
  | "weekly_competition_close"
  | "custom_daily_time";

export type NotificationAutomationRecord = {
  id: string;
  name: string;
  description: string;
  templateId: string;
  enabled: boolean;
  trigger: NotificationAutomationTrigger;
  triggerHour?: number;
  triggerMinute?: number;
  timezone: string;
  suggestedTargetPath: string;
  lastRunAt?: string;
  lastRunDayKey?: string;
};

export type LocalizedAdminMap = Partial<Record<"tr" | "uz" | "ru" | "en", string>>;

export type NotificationTemplateRecord = {
  id: string;
  name: string;
  title: string | LocalizedAdminMap;
  body: string | LocalizedAdminMap;
  audience?: string;
  channel?: string;
  country?: string;
  targetPath?: string;
  metadata?: Record<string, unknown>;
};

export const DEFAULT_NOTIFICATION_TIMEZONE = "Europe/Istanbul";

export const defaultNotificationAutomations: Omit<NotificationAutomationRecord, "templateId" | "lastRunAt" | "lastRunDayKey">[] = [
  {
    id: "chance-card-daily-reset",
    name: "Şans kartı günlük sıfırlama",
    description: "Her gün gece yarısından sonra şans kartı limiti yenilendiğinde bildirim gönderir.",
    enabled: false,
    trigger: "daily_midnight_reset",
    triggerHour: 0,
    triggerMinute: 5,
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    suggestedTargetPath: "/chance-card"
  },
  {
    id: "daily-quiz-reset",
    name: "Günlük test sıfırlama",
    description: "Günlük sanat testi / oyun limiti yenilendiğinde bildirim gönderir.",
    enabled: false,
    trigger: "daily_midnight_reset",
    triggerHour: 0,
    triggerMinute: 10,
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    suggestedTargetPath: "/games"
  },
  {
    id: "daily-duel-rotation",
    name: "Günlük düello dönüşü",
    description: "Günlük düello saatinde yeni düello açıldığında bildirim gönderir.",
    enabled: false,
    trigger: "daily_duel_rotation",
    triggerHour: 21,
    triggerMinute: 0,
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    suggestedTargetPath: "/duels"
  },
  {
    id: "weekly-prophecy-start",
    name: "Haftalık kehanet başlangıcı",
    description: "Yeni kehanet haftası başladığında bildirim gönderir.",
    enabled: false,
    trigger: "weekly_prophecy_start",
    triggerHour: 0,
    triggerMinute: 15,
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    suggestedTargetPath: "/duels"
  },
  {
    id: "weekly-competition-close",
    name: "Haftalık yarışma kapanışı",
    description: "Resim yarışması haftası kapandığında sonuç bildirimi gönderir.",
    enabled: false,
    trigger: "weekly_competition_close",
    triggerHour: 23,
    triggerMinute: 55,
    timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    suggestedTargetPath: "/weekly-winners"
  }
];

export function dayKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

export function clockInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  return { hour, minute, weekday };
}

export function shouldRunNotificationAutomation(
  automation: Pick<NotificationAutomationRecord, "trigger" | "triggerHour" | "triggerMinute" | "timezone" | "lastRunDayKey">,
  now: Date
) {
  const timezone = automation.timezone || DEFAULT_NOTIFICATION_TIMEZONE;
  const dayKey = dayKeyInTimezone(now, timezone);
  const clock = clockInTimezone(now, timezone);
  const targetHour = automation.triggerHour ?? 0;
  const targetMinute = automation.triggerMinute ?? 0;
  const pastTarget = clock.hour > targetHour || (clock.hour === targetHour && clock.minute >= targetMinute);

  if (automation.trigger === "weekly_prophecy_start") {
    if (clock.weekday !== "Mon" || !pastTarget) return false;
    return automation.lastRunDayKey !== dayKey;
  }

  if (automation.trigger === "weekly_competition_close") {
    if (clock.weekday !== "Sun" || !pastTarget) return false;
    return automation.lastRunDayKey !== dayKey;
  }

  if (!pastTarget) return false;
  return automation.lastRunDayKey !== dayKey;
}

function localizedValue(value: string | LocalizedAdminMap | undefined, fallback = "") {
  if (typeof value === "string") return { tr: value, uz: value, ru: value, en: value };
  if (!value || typeof value !== "object") return { tr: fallback, uz: fallback, ru: fallback, en: fallback };
  const tr = value.tr?.trim() || fallback;
  return {
    tr,
    uz: value.uz?.trim() || tr,
    ru: value.ru?.trim() || tr,
    en: value.en?.trim() || tr
  };
}

export function buildAutomationNotificationPayload(
  template: NotificationTemplateRecord,
  automation: Pick<NotificationAutomationRecord, "id" | "suggestedTargetPath">,
  dayKey: string
) {
  const title = localizedValue(template.title, template.name);
  const body = localizedValue(template.body, "");
  const audience = typeof template.metadata?.audience === "string"
    ? template.metadata.audience
    : template.audience || "all";
  const channel = typeof template.metadata?.channel === "string"
    ? template.metadata.channel
    : template.channel || "both";
  const pushStyle = template.metadata?.pushStyle === "silent" ? "silent" : "alert";
  const targetPath = template.targetPath || automation.suggestedTargetPath || "/notifications";
  return {
    recipientId: "all",
    userId: "all",
    actorId: "admin",
    actorUsername: "Art Atlas Admin",
    actorPhotoURL: "",
    role: "",
    country: audience === "country" ? template.country || "" : "",
    language: "all",
    title,
    body,
    type: "system_announcement",
    targetType: "system",
    targetId: targetPath,
    targetOwnerId: "",
    targetPath,
    readBy: [],
    isRead: false,
    isDeleted: false,
    pushEnabled: channel === "both" || channel === "push",
    pushSent: false,
    metadata: {
      channel,
      pushStyle,
      audience,
      source: "automation",
      automationId: automation.id,
      templateId: template.id
    },
    dedupeKey: `auto_${automation.id}_${dayKey}`.slice(0, 180),
    status: "published",
    scheduledAt: null
  };
}
