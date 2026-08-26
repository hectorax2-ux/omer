const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CHANCE_WEEKLY_HIGH_SCORE_LIMIT,
  CHANCE_WEEKLY_JACKPOT_LIMIT,
  applyChanceWeeklyQuota,
  drawChanceScore
} = require("../lib/chance-card-core.js");

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test("chance score boundaries keep 80+ outcomes rare", () => {
  assert.equal(drawChanceScore(sequence(0, 0)).score, 1);
  assert.equal(drawChanceScore(sequence(0.72, 0)).score, 51);
  assert.equal(drawChanceScore(sequence(0.92, 0)).score, 71);
  assert.equal(drawChanceScore(sequence(0.97, 0)).score, 81);
  assert.equal(drawChanceScore(sequence(0.995, 0)).score, 93);
  assert.equal(drawChanceScore(sequence(0.9985, 0)).score, 98);
});

test("98-100 scores are capped at two per server week", () => {
  const jackpot = { score: 100, tier: "jackpot", rangeMin: 98 };
  const allowed = applyChanceWeeklyQuota(jackpot, 0, CHANCE_WEEKLY_JACKPOT_LIMIT - 1, () => 0.99);
  assert.equal(allowed.score, 100);
  assert.equal(allowed.incrementJackpot, 1);

  const downgraded = applyChanceWeeklyQuota(jackpot, 0, CHANCE_WEEKLY_JACKPOT_LIMIT, () => 0.99);
  assert.equal(downgraded.score, 97);
  assert.equal(downgraded.incrementHigh, 1);
  assert.equal(downgraded.incrementJackpot, 0);
});

test("93-97 scores fall back below 93 after the weekly high quota", () => {
  const high = { score: 97, tier: "high", rangeMin: 93 };
  const result = applyChanceWeeklyQuota(high, CHANCE_WEEKLY_HIGH_SCORE_LIMIT, 0, () => 0.99);
  assert.equal(result.score, 92);
  assert.equal(result.incrementHigh, 0);
});
