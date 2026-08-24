export type UserRestrictionRecord = {
  id: string;
  type: "discover_post" | "image_upload" | "contest_entry" | "support_create" | "dm_send" | "dm_receive";
  reason: string;
  until: string;
  duration: "temporary" | "permanent";
  active: boolean;
};

export function parseUserRestrictions(value: unknown): UserRestrictionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<UserRestrictionRecord>;
    if (typeof record.type !== "string" || typeof record.id !== "string") return [];
    return [{
      id: record.id,
      type: record.type,
      reason: typeof record.reason === "string" ? record.reason : "",
      until: typeof record.until === "string" ? record.until : "",
      duration: record.duration === "permanent" ? "permanent" : "temporary",
      active: record.active !== false
    }];
  });
}

export function hasActiveUserRestriction(restrictions: UserRestrictionRecord[], type: UserRestrictionRecord["type"]) {
  const now = Date.now();
  return restrictions.some((restriction) => {
    if (!restriction.active || restriction.type !== type) return false;
    if (restriction.duration === "permanent") return true;
    if (!restriction.until) return false;
    const untilMs = Date.parse(restriction.until);
    return !Number.isNaN(untilMs) && untilMs > now;
  });
}
