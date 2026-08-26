const test = require("node:test");
const assert = require("node:assert/strict");
const {
  countExactTimelinePositions,
  dailyPercentileScore,
  normalizeArtistBirthYear,
  normalizeArtworkYear,
  orderTimelineItems,
  remainingTimelineGames,
  resolveTimelineCompletionElapsed,
  resolveTimelineCalendar,
  scoreTimelineGame,
  timelineDailyLimit
} = require("../lib/timeline-game-core.js");

test("normalizes exact and circa artwork years while rejecting ranges", () => {
  assert.equal(normalizeArtworkYear(1889), 1889);
  assert.equal(normalizeArtworkYear("1889"), 1889);
  assert.equal(normalizeArtworkYear("c. 1889"), 1889);
  assert.equal(normalizeArtworkYear("1889-06-01"), 1889);
  assert.equal(normalizeArtworkYear("1889-1890"), null);
  assert.equal(normalizeArtworkYear("unknown"), null);
});

test("extracts the explicit birth year from artist life years", () => {
  assert.equal(normalizeArtistBirthYear(1840, "1840–1926"), 1840);
  assert.equal(normalizeArtistBirthYear(undefined, "1840–1926"), 1840);
  assert.equal(normalizeArtistBirthYear(undefined, "c. 1445 — 1510"), 1445);
  assert.equal(normalizeArtistBirthYear(undefined, "unknown"), null);
});

test("orders in both directions and scores exact positions only", () => {
  const items = [{ id: "b", year: 1900 }, { id: "a", year: 1800 }, { id: "c", year: 2000 }];
  assert.deepEqual(orderTimelineItems(items, "oldest-first").map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(orderTimelineItems(items, "newest-first").map((item) => item.id), ["c", "b", "a"]);
  assert.equal(countExactTimelinePositions(["a", "b", "c", "d"], ["a", "c", "b", "d"]), 2);
});

test("applies the authoritative time and timeout formulas", () => {
  assert.equal(scoreTimelineGame(10, 10).finalScore, 900);
  assert.equal(scoreTimelineGame(8, 20).finalScore, 600);
  assert.deepEqual(scoreTimelineGame(10, 60), {
    correctPositions: 10,
    accuracyScore: 1000,
    timePenalty: 300,
    normalScore: 700,
    timedOut: false,
    finalScore: 700
  });
  assert.deepEqual(scoreTimelineGame(10, 90), {
    correctPositions: 10,
    accuracyScore: 1000,
    timePenalty: 300,
    normalScore: 700,
    timedOut: true,
    finalScore: 350
  });
  assert.equal(scoreTimelineGame(0, 500).finalScore, 0);
});

test("uses server time with an IANA timezone for day reset", () => {
  const calendar = resolveTimelineCalendar(new Date("2026-08-09T20:30:00.000Z"), "Asia/Tashkent");
  assert.equal(calendar.dayKey, "2026-08-10");
  assert.equal(calendar.monthKey, "2026-08");
  assert.equal(new Date(calendar.resetAtMs).toISOString(), "2026-08-10T19:00:00.000Z");
});

test("normalizes daily ranks into a fair percentile", () => {
  assert.equal(dailyPercentileScore(1, 1000), 99.9);
  assert.equal(dailyPercentileScore(10, 1000), 99);
  assert.equal(dailyPercentileScore(100, 10000), 99);
  assert.equal(dailyPercentileScore(1, 100), 99);
  assert.equal(dailyPercentileScore(1, 10000), 99.99);
  assert.equal(dailyPercentileScore(1000, 1000), 0);
  assert.equal(dailyPercentileScore(1, 1), 100);
});

test("keeps free and premium daily rights independent from client claims", () => {
  assert.equal(timelineDailyLimit(false), 2);
  assert.equal(timelineDailyLimit(true), 5);
  assert.equal(remainingTimelineGames(1, false), 1);
  assert.equal(remainingTimelineGames(5, true), 0);
});

test("freezes completion time while accepting normal result upload latency", () => {
  assert.equal(resolveTimelineCompletionElapsed(18, 23), 18);
  assert.equal(resolveTimelineCompletionElapsed(59, 61), 59);
  assert.equal(resolveTimelineCompletionElapsed(10, 140), 140);
  assert.equal(resolveTimelineCompletionElapsed(30, 20), 20);
  assert.equal(resolveTimelineCompletionElapsed(Number.NaN, 25), 25);
});
