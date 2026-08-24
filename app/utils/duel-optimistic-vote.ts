export type DuelVoteCounts = Record<string, number>;

export type OptimisticDuelVote = {
  selectedOptionId: string;
  previousOptionId?: string;
  baseCounts: DuelVoteCounts;
  displayCounts: DuelVoteCounts;
  writeComplete: boolean;
};

export function buildDuelVoteCounts(optionAId: string, optionBId: string, votesA: number, votesB: number): DuelVoteCounts {
  return {
    [optionAId]: Math.max(0, votesA),
    [optionBId]: Math.max(0, votesB)
  };
}

export function createOptimisticDuelVote(baseCounts: DuelVoteCounts, selectedOptionId: string, previousOptionId?: string): OptimisticDuelVote {
  const displayCounts = { ...baseCounts };
  if (previousOptionId && previousOptionId !== selectedOptionId) {
    displayCounts[previousOptionId] = Math.max(0, (displayCounts[previousOptionId] ?? 0) - 1);
  }
  if (previousOptionId !== selectedOptionId) {
    displayCounts[selectedOptionId] = (displayCounts[selectedOptionId] ?? 0) + 1;
  }
  return { selectedOptionId, previousOptionId, baseCounts, displayCounts, writeComplete: false };
}

export function calculateDuelPercentages(counts: DuelVoteCounts, optionAId: string, optionBId: string, selectedOptionId?: string) {
  const votesA = Math.max(0, counts[optionAId] ?? 0);
  const votesB = Math.max(0, counts[optionBId] ?? 0);
  const total = votesA + votesB;
  if (total <= 0) {
    return {
      [optionAId]: selectedOptionId === optionAId ? 100 : 0,
      [optionBId]: selectedOptionId === optionBId ? 100 : 0
    };
  }
  const percentA = Math.round(votesA / total * 100);
  return { [optionAId]: percentA, [optionBId]: 100 - percentA };
}

export function serverSnapshotIncludesOptimisticVote(serverCounts: DuelVoteCounts, optimisticVote: OptimisticDuelVote) {
  if (!optimisticVote.writeComplete) return false;
  if ((serverCounts[optimisticVote.selectedOptionId] ?? 0) > (optimisticVote.baseCounts[optimisticVote.selectedOptionId] ?? 0)) return true;
  if (!optimisticVote.previousOptionId || optimisticVote.previousOptionId === optimisticVote.selectedOptionId) return false;
  return (serverCounts[optimisticVote.previousOptionId] ?? 0) < (optimisticVote.baseCounts[optimisticVote.previousOptionId] ?? 0);
}
