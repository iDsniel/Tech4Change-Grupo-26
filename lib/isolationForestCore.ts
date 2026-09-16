export type IsolationForestOptions = {
  trees?: number;
  subsampleSize?: number;
};

export type IsolationForestScore = {
  score: number;
  percentile: number;
  sampleSize: number;
  trees: number;
};

type Vector = number[];
type IsolationNode =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: IsolationNode; right: IsolationNode };

export const DEFAULT_ISOLATION_TREES = 96;
export const DEFAULT_ISOLATION_SUBSAMPLE = 16;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function harmonic(number: number) {
  let total = 0;
  for (let value = 1; value <= number; value += 1) total += 1 / value;
  return total;
}

function averagePathLength(size: number) {
  if (size <= 1) return 0;
  if (size === 2) return 1;
  return 2 * harmonic(size - 1) - (2 * (size - 1)) / size;
}

function sampleWithoutReplacement<T>(items: T[], size: number, random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, size);
}

function buildTree(points: Vector[], depth: number, maxDepth: number, random: () => number): IsolationNode {
  if (depth >= maxDepth || points.length <= 1) return { leaf: true, size: points.length };

  const candidates: Array<{ feature: number; min: number; max: number }> = [];
  const featureCount = points[0]?.length ?? 0;
  for (let feature = 0; feature < featureCount; feature += 1) {
    const values = points.map((point) => point[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max > min) candidates.push({ feature, min, max });
  }

  if (candidates.length === 0) return { leaf: true, size: points.length };
  const selected = candidates[Math.floor(random() * candidates.length)];
  const split = selected.min + random() * (selected.max - selected.min);
  const left = points.filter((point) => point[selected.feature] < split);
  const right = points.filter((point) => point[selected.feature] >= split);
  if (left.length === 0 || right.length === 0) return { leaf: true, size: points.length };

  return {
    leaf: false,
    feature: selected.feature,
    split,
    left: buildTree(left, depth + 1, maxDepth, random),
    right: buildTree(right, depth + 1, maxDepth, random)
  };
}

function pathLength(node: IsolationNode, point: Vector, depth = 0): number {
  if (node.leaf) return depth + (node.size > 1 ? averagePathLength(node.size) : 0);
  return pathLength(point[node.feature] < node.split ? node.left : node.right, point, depth + 1);
}

function buildForest(training: Vector[], seed: number, trees: number, subsampleSize: number) {
  const sampleSize = Math.min(subsampleSize, training.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));
  const forest: IsolationNode[] = [];
  for (let tree = 0; tree < trees; tree += 1) {
    const random = seededRandom((seed + Math.imul(tree + 1, 2654435761)) >>> 0);
    const sample = sampleWithoutReplacement(training, sampleSize, random);
    forest.push(buildTree(sample, 0, maxDepth, random));
  }
  return { forest, sampleSize };
}

function anomalyScore(forest: IsolationNode[], sampleSize: number, point: Vector) {
  const normalizer = averagePathLength(sampleSize);
  if (normalizer === 0) return 0.5;
  const meanPath = forest.reduce((total, tree) => total + pathLength(tree, point), 0) / forest.length;
  return 2 ** (-meanPath / normalizer);
}

export function scoreIsolationForest(
  training: Vector[],
  current: Vector,
  seedKey: string,
  options: IsolationForestOptions = {}
): IsolationForestScore {
  if (!training.length) throw new Error("Isolation Forest requires baseline vectors.");
  const width = current.length;
  if (!width || training.some((row) => row.length !== width || row.some((value) => !Number.isFinite(value))) || current.some((value) => !Number.isFinite(value))) {
    throw new Error("Isolation Forest received an invalid feature vector.");
  }

  const trees = options.trees ?? DEFAULT_ISOLATION_TREES;
  const subsampleSize = options.subsampleSize ?? DEFAULT_ISOLATION_SUBSAMPLE;
  const { forest, sampleSize } = buildForest(training, hashString(seedKey), trees, subsampleSize);
  const peerScores = training.map((point) => anomalyScore(forest, sampleSize, point));
  const score = anomalyScore(forest, sampleSize, current);
  const percentile = peerScores.filter((peerScore) => peerScore <= score).length / Math.max(1, peerScores.length);
  return { score, percentile, sampleSize, trees };
}
