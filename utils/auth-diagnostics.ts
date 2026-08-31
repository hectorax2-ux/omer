import { authErrorCode } from "@/utils/auth-lifecycle";

/** Keep the actual exception type/message, never credentials or provider payloads. */
export function authErrorDetails(error: unknown) {
  const value = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; stack?: unknown } : {};
  const redact = (text: string) => text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:https?:\/\/|file:\/\/)[^\s)]+/gi, "[url]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(["']?(?:password|access[_-]?token|id[_-]?token|refresh[_-]?token|identityToken|nonce|secret|api[_-]?key)["']?\s*[=:]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[redacted]")
    .replace(/[A-Za-z0-9_+-]{80,}(?:\.[A-Za-z0-9_+-]+)*/g, "[redacted]")
    .slice(0, 2400);
  return {
    code: authErrorCode(error),
    name: typeof value.name === "string" ? redact(value.name) : typeof error,
    message: typeof value.message === "string" ? redact(value.message).slice(0, 700) : "Non-Error rejection",
    ...(typeof value.stack === "string" ? { stack: redact(value.stack) } : {})
  };
}

export function logAuthStage(stage: string, provider: string, result: "start" | "success" | "error", error?: unknown, flags?: Record<string, boolean>) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  const entry = { stage, provider, result, ...flags, ...(error === undefined ? {} : { error: authErrorDetails(error) }) };
  // One serializable record is easier to inspect on Metro, browser and devices.
  if (result === "error") console.warn("[AuthPipeline]", JSON.stringify(entry));
  else console.info("[AuthPipeline]", JSON.stringify(entry));
}

export async function traceAuthStep<T>(stage: string, provider: string, action: () => Promise<T>) {
  logAuthStage(stage, provider, "start");
  try {
    const result = await action();
    logAuthStage(stage, provider, "success");
    return result;
  } catch (error) {
    logAuthStage(stage, provider, "error", error);
    throw error;
  }
}
