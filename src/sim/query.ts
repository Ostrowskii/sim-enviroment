import type { AnyEntity } from "../entities/types";
import { distanceSquared } from "../utils/math";

export function findNearest<T extends AnyEntity>(
  origin: { x: number; y: number },
  candidates: readonly T[],
  maxDistance: number,
  predicate?: (candidate: T) => boolean
): T | null {
  const maxDistanceSq = maxDistance * maxDistance;
  let best: T | null = null;
  let bestDistanceSq = maxDistanceSq;

  for (const candidate of candidates) {
    if (predicate && !predicate(candidate)) {
      continue;
    }

    const d2 = distanceSquared(origin, candidate);
    if (d2 <= bestDistanceSq) {
      bestDistanceSq = d2;
      best = candidate;
    }
  }

  return best;
}

export function hasNearby<T extends AnyEntity>(
  origin: { x: number; y: number },
  candidates: readonly T[],
  radius: number,
  predicate?: (candidate: T) => boolean
): boolean {
  return findNearest(origin, candidates, radius, predicate) !== null;
}
