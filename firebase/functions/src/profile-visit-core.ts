export const PROFILE_VISIT_DEDUPLICATION_MS = 15 * 60 * 1000;

export function shouldCountProfileVisit(lastVisitedAt: number | undefined, requestedAt: number) {
  if (lastVisitedAt === undefined) return true;
  return requestedAt - lastVisitedAt >= PROFILE_VISIT_DEDUPLICATION_MS;
}

export function resolveProfileVisitIdentity(
  visibility: "visible" | "anonymous",
  visitorUid: string,
  visitor: Record<string, unknown>
) {
  if (visibility === "anonymous") return null;
  return {
    visitorUid,
    visitorName: String(visitor.displayName || visitor.username || ""),
    visitorUsername: String(visitor.username || ""),
    visitorPhotoURL: String(visitor.photoURL || "")
  };
}
