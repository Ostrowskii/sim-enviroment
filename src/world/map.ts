import type { Biome } from "../entities/types";
import { clamp } from "../utils/math";
import type { SeededRng } from "../utils/rng";

export interface WorldMap {
  width: number;
  height: number;
  forestEndX: number;
  transitionEndX: number;
  shorelineX: number;
}

const FOREST_RATIO = 0.45;
const TRANSITION_RATIO = 0.17;

export function createWorldMap(width: number, height: number): WorldMap {
  const forestEndX = width * FOREST_RATIO;
  const transitionEndX = width * (FOREST_RATIO + TRANSITION_RATIO);

  return {
    width,
    height,
    forestEndX,
    transitionEndX,
    shorelineX: transitionEndX
  };
}

export function biomeAt(world: WorldMap, x: number): Biome {
  if (x < world.forestEndX) {
    return "forest";
  }

  if (x < world.transitionEndX) {
    return "transition";
  }

  return "lake";
}

export function isWaterBiome(biome: Biome): boolean {
  return biome === "lake";
}

export function isLandBiome(biome: Biome): boolean {
  return biome !== "lake";
}

export function clampToWorld(
  world: WorldMap,
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: clamp(x, 0, world.width),
    y: clamp(y, 0, world.height)
  };
}

export function randomPointInBiome(
  world: WorldMap,
  rng: SeededRng,
  biome: Biome
): { x: number; y: number } {
  const y = rng.float(8, world.height - 8);

  if (biome === "forest") {
    return { x: rng.float(8, world.forestEndX - 8), y };
  }

  if (biome === "transition") {
    return { x: rng.float(world.forestEndX + 8, world.transitionEndX - 8), y };
  }

  return { x: rng.float(world.transitionEndX + 8, world.width - 8), y };
}

export function nearestLandX(world: WorldMap): number {
  return world.transitionEndX - 12;
}
