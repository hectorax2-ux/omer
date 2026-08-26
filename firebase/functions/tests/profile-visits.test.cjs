const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const {
  PROFILE_VISIT_DEDUPLICATION_MS,
  resolveProfileVisitIdentity,
  shouldCountProfileVisit
} = require("../lib/profile-visit-core.js");

test("counts the first real profile visit", () => {
  assert.equal(shouldCountProfileVisit(undefined, 1_000), true);
});

test("deduplicates rapid visits and permits a later return", () => {
  assert.equal(shouldCountProfileVisit(1_000, 1_000 + PROFILE_VISIT_DEDUPLICATION_MS - 1), false);
  assert.equal(shouldCountProfileVisit(1_000, 1_000 + PROFILE_VISIT_DEDUPLICATION_MS), true);
});

test("visible visits expose only the intended display identity", () => {
  assert.deepEqual(resolveProfileVisitIdentity("visible", "visitor-a", {
    displayName: "Ada",
    username: "ada",
    photoURL: "https://example.test/ada.jpg",
    email: "private@example.test"
  }), {
    visitorUid: "visitor-a",
    visitorName: "Ada",
    visitorUsername: "ada",
    visitorPhotoURL: "https://example.test/ada.jpg"
  });
});

test("anonymous visits produce no client identity payload", () => {
  assert.equal(resolveProfileVisitIdentity("anonymous", "visitor-a", {
    displayName: "Ada",
    username: "ada",
    photoURL: "https://example.test/ada.jpg"
  }), null);
});

test("Firestore rules keep signals opaque and identities premium-owner only", () => {
  const rules = readFileSync(join(__dirname, "..", "..", "firestore.rules"), "utf8");
  assert.match(rules, /match \/profileVisitSignals\/\{signalId\}/);
  assert.match(rules, /match \/profileVisitSummaries\/\{ownerUid\}\/visitors\/\{viewId\}[\s\S]*allow read: if isSelf\(ownerUid\) \|\| admin\(\)/);
  assert.match(rules, /match \/profileVisitViews\/\{ownerUid\}\/visitors\/\{viewId\}[\s\S]*isSelf\(ownerUid\) && isPremiumUser\(\)/);
  assert.match(rules, /match \/profileVisits\/\{visitId\}[\s\S]*allow create: if false/);
});
