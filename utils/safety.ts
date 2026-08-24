export const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
export const RATE_LIMIT_MAX_ACTIONS = 15;
export const RATE_LIMIT_WARNING_AFTER = 5;
export const POST_COOLDOWN_MS = 60 * 1000;
export const COMMENT_COOLDOWN_MS = 60 * 1000;

export type RateLimitStatus = {
  used: number;
  limit: number;
  remaining: number;
  resetAt: number | null;
  nextAllowedAt: number | null;
  blocked: boolean;
  showWarning: boolean;
};

export type SafetyActionResult = {
  ok: boolean;
  reason?: "rate_limit" | "cooldown" | "blocked_language";
  message?: string;
  status?: RateLimitStatus;
};

const blockedTerms = [
  "amk",
  "aq",
  "mk",
  "oc",
  "o c",
  "orospu",
  "orospu cocugu",
  "pic",
  "pich",
  "pezevenk",
  "got",
  "göt",
  "gotveren",
  "siktir",
  "sik",
  "sikik",
  "sikerim",
  "yarrak",
  "yarak",
  "tasak",
  "taşak",
  "kahpe",
  "kaltak",
  "ibne",
  "ibneler",
  "haysiyetsiz",
  "serefsiz",
  "şerefsiz",
  "it",
  "aptal",
  "salak",
  "gerizekali",
  "gerizekalı",
  "ahmak",
  "блядь",
  "сука",
  "хуй",
  "пизда",
  "пидор",
  "ебать",
  "мудак",
  "идиот",
  "дурак",
  "shit",
  "fuck",
  "fucking",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "cunt",
  "whore",
  "slut",
  "idiot",
  "moron"
];

// Lightweight, silent client-side guards for high-frequency repeatable actions
// (like/dislike toggles, votes, ratings, reports). These do not surface UI; they
// simply ignore presses that come too fast or exceed a short burst window, which
// stops accidental/abusive spam from hammering Firestore.
const lastActionAt = new Map<string, number>();
const burstWindows = new Map<string, number[]>();

export function throttleAction(key: string, minIntervalMs: number, now = Date.now()) {
  const last = lastActionAt.get(key) ?? 0;
  if (now - last < minIntervalMs) return false;
  lastActionAt.set(key, now);
  return true;
}

export function withinBurstLimit(key: string, maxCount: number, windowMs: number, now = Date.now()) {
  const times = (burstWindows.get(key) ?? []).filter((time) => now - time < windowMs);
  if (times.length >= maxCount) {
    burstWindows.set(key, times);
    return false;
  }
  times.push(now);
  burstWindows.set(key, times);
  return true;
}

export function getRateLimitStatus(timestamps: number[], now = Date.now()): RateLimitStatus {
  const active = timestamps.filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  const resetAt = active.length ? active[0] + RATE_LIMIT_WINDOW_MS : null;
  const nextAllowedAt = active.length ? active[active.length - 1] + POST_COOLDOWN_MS : null;
  const remaining = Math.max(0, RATE_LIMIT_MAX_ACTIONS - active.length);

  return {
    used: active.length,
    limit: RATE_LIMIT_MAX_ACTIONS,
    remaining,
    resetAt,
    nextAllowedAt,
    blocked: active.length >= RATE_LIMIT_MAX_ACTIONS,
    showWarning: active.length >= RATE_LIMIT_WARNING_AFTER
  };
}

export function pruneRateLimitTimestamps(timestamps: number[], now = Date.now()) {
  return timestamps.filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
}

export function formatRemainingTime(resetAt: number | null, now = Date.now()) {
  if (!resetAt) {
    return "00:00";
  }

  const remainingSeconds = Math.max(0, Math.ceil((resetAt - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function containsBlockedLanguage(value: string) {
  const normalized = normalizeForModeration(value);
  return blockedTerms.some((term) => {
    const normalizedTerm = normalizeForModeration(term);
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`, "i").test(normalized);
  });
}

export function buildCommentCooldownMessage(remainingMs: number, language: "tr" | "en" | "ru" | "uz") {
  const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
  return {
    tr: `${remainingSec} sn sonra tekrar yorum yazabilirsin.`,
    en: `You can comment again in ${remainingSec}s.`,
    ru: `Комментарий через ${remainingSec} сек.`,
    uz: `${remainingSec} soniyadan keyin izoh yozishingiz mumkin.`
  }[language];
}

export function buildBlockedLanguageMessage(language: "tr" | "en" | "ru" | "uz") {
  return {
    tr: "Paylaşımda küfür, hakaret veya saldırgan ifade kullanılamaz. Lütfen metni düzenleyin.",
    en: "Posts cannot include profanity, insults, or abusive language. Please edit the text.",
    ru: "Публикация не может содержать оскорбления или грубую лексику. Отредактируйте текст.",
    uz: "Postda haqoratli yoki qo'pol iboralar bo'lmasligi kerak. Matnni tahrirlang."
  }[language];
}

export function buildRateLimitMessage(status: RateLimitStatus | undefined, language: "tr" | "en" | "ru" | "uz") {
  const time = formatRemainingTime(status?.resetAt ?? null);
  return {
    tr: `30 dakika içinde en fazla 15 paylaşım yapabilirsiniz. Kalan süre: ${time}.`,
    en: `You can share up to 15 items in 30 minutes. Remaining time: ${time}.`,
    ru: `За 30 минут можно опубликовать не более 15 материалов. Осталось: ${time}.`,
    uz: `30 daqiqada ko'pi bilan 15 ta ulashish mumkin. Qolgan vaqt: ${time}.`
  }[language];
}

export function buildCooldownMessage(status: RateLimitStatus | undefined, language: "tr" | "en" | "ru" | "uz", now = Date.now()) {
  const time = formatRemainingTime(status?.nextAllowedAt ?? null, now);
  return {
    tr: `Yeni paylaşım için 1 dakika bekleme sınırı var. Kalan süre: ${time}.`,
    en: `There is a 1-minute wait before a new share. Remaining time: ${time}.`,
    ru: `Перед новой публикацией нужно подождать 1 минуту. Осталось: ${time}.`,
    uz: `Yangi ulashishdan oldin 1 daqiqa kutish kerak. Qolgan vaqt: ${time}.`
  }[language];
}

export function buildLimitStatusText(status: RateLimitStatus | undefined, language: "tr" | "en" | "ru" | "uz", now = Date.now()) {
  if (!status || !status.showWarning) {
    return "";
  }

  const time = formatRemainingTime(status.resetAt, now);
  return {
    tr: `${status.used}/${status.limit} paylaşım kullanıldı. Kalan süre: ${time}.`,
    en: `${status.used}/${status.limit} shares used. Remaining time: ${time}.`,
    ru: `Использовано ${status.used}/${status.limit}. Осталось: ${time}.`,
    uz: `${status.used}/${status.limit} ulashish ishlatildi. Qolgan vaqt: ${time}.`
  }[language];
}

export function isPostCooldownActive(status: RateLimitStatus | undefined, now = Date.now()) {
  return Boolean(status?.nextAllowedAt && now < status.nextAllowedAt);
}

function normalizeForModeration(value: string) {
  return ` ${value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
