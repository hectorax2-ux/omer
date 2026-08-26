export const CHANCE_WEEKLY_HIGH_SCORE_LIMIT = 8;
export const CHANCE_WEEKLY_JACKPOT_LIMIT = 2;

export type ChanceScoreTier = "common" | "uncommon" | "rare" | "high" | "jackpot";

type ChanceScoreRange = {
  tier: ChanceScoreTier;
  min: number;
  max: number;
  weight: number;
};

// 80 and below: 97%, 81-92: 2.5%, 93-97: 0.35%, 98-100: 0.15%.
// Weekly server quotas provide a hard ceiling when the number of players grows.
export const CHANCE_SCORE_RANGES: ChanceScoreRange[] = [
  { tier: "common", min: 1, max: 50, weight: 72_000 },
  { tier: "uncommon", min: 51, max: 70, weight: 20_000 },
  { tier: "rare", min: 71, max: 80, weight: 5_000 },
  { tier: "high", min: 81, max: 92, weight: 2_500 },
  { tier: "high", min: 93, max: 97, weight: 350 },
  { tier: "jackpot", min: 98, max: 100, weight: 150 }
];

export function drawChanceScore(random: () => number) {
  const total = CHANCE_SCORE_RANGES.reduce((sum, range) => sum + range.weight, 0);
  const cursor = clampRandom(random()) * total;
  const selected = CHANCE_SCORE_RANGES.reduce<{ selected: ChanceScoreRange | null; remaining: number }>((state, range) => {
    if (state.selected) return state;
    if (state.remaining < range.weight) return { selected: range, remaining: state.remaining };
    return { selected: null, remaining: state.remaining - range.weight };
  }, { selected: null, remaining: cursor }).selected ?? CHANCE_SCORE_RANGES[0];
  return {
    score: scoreWithinRange(selected.min, selected.max, random),
    tier: selected.tier,
    rangeMin: selected.min
  };
}

export function applyChanceWeeklyQuota(
  draw: ReturnType<typeof drawChanceScore>,
  highScoreCount: number,
  jackpotCount: number,
  random: () => number
) {
  if (draw.rangeMin >= 98 && jackpotCount < CHANCE_WEEKLY_JACKPOT_LIMIT) {
    return { score: draw.score, tier: "jackpot" as const, incrementHigh: 0, incrementJackpot: 1 };
  }
  if (draw.rangeMin >= 98 && highScoreCount < CHANCE_WEEKLY_HIGH_SCORE_LIMIT) {
    return { score: scoreWithinRange(93, 97, random), tier: "high" as const, incrementHigh: 1, incrementJackpot: 0 };
  }
  if (draw.rangeMin >= 93 && highScoreCount < CHANCE_WEEKLY_HIGH_SCORE_LIMIT) {
    return { score: draw.score, tier: "high" as const, incrementHigh: 1, incrementJackpot: 0 };
  }
  if (draw.rangeMin >= 93) {
    return { score: scoreWithinRange(81, 92, random), tier: "high" as const, incrementHigh: 0, incrementJackpot: 0 };
  }
  return { score: draw.score, tier: draw.tier, incrementHigh: 0, incrementJackpot: 0 };
}

function scoreWithinRange(min: number, max: number, random: () => number) {
  return min + Math.floor(clampRandom(random()) * (max - min + 1));
}

function clampRandom(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 0.9999999999999999);
}
