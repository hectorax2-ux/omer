export function formatPostTime(timestamp: number, language: "tr" | "en" | "ru" | "uz") {
  const locale = language === "tr" || language === "uz" ? "tr-TR" : language === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
