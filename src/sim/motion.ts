import type { AnyAnimal } from "../entities/types";
import { clampToWorld, nearestLandX } from "../world/map";
import type { WorldMap } from "../world/map";
import { lerp, normalize } from "../utils/math";
import type { SeededRng } from "../utils/rng";

interface Steerable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

export function steerTowards(
  entity: Steerable,
  tx: number,
  ty: number,
  responsiveness: number,
  speedMultiplier = 1
): void {
  const dir = normalize(tx - entity.x, ty - entity.y);
  const desiredVx = dir.x * entity.speed * speedMultiplier;
  const desiredVy = dir.y * entity.speed * speedMultiplier;

  entity.vx = lerp(entity.vx, desiredVx, responsiveness);
  entity.vy = lerp(entity.vy, desiredVy, responsiveness);
}

export function steerAway(
  entity: Steerable,
  tx: number,
  ty: number,
  responsiveness: number,
  speedMultiplier = 1
): void {
  steerTowards(entity, entity.x - (tx - entity.x), entity.y - (ty - entity.y), responsiveness, speedMultiplier);
}

export function applyWander(entity: AnyAnimal, rng: SeededRng, force = 1): void {
  entity.wanderAngle += rng.float(-0.38, 0.38);
  const drift = rng.float(0.12, 0.35) * force;

  entity.vx += Math.cos(entity.wanderAngle) * drift;
  entity.vy += Math.sin(entity.wanderAngle) * drift;
}

export function advanceAnimal(
  entity: AnyAnimal,
  world: WorldMap,
  friction = 0.92
): void {
  entity.vx *= friction;
  entity.vy *= friction;

  entity.x += entity.vx;
  entity.y += entity.vy;

  const clamped = clampToWorld(world, entity.x, entity.y);
  entity.x = clamped.x;
  entity.y = clamped.y;
}

export function keepFishInLake(entity: AnyAnimal, world: WorldMap): void {
  if (entity.x < world.forestEndX + 8) {
    steerTowards(entity, world.transitionEndX + 30, entity.y, 0.45, 1.4);
  }
}

export function keepLeopardOnLand(entity: AnyAnimal, world: WorldMap): void {
  if (entity.x > world.transitionEndX - 8) {
    steerTowards(entity, nearestLandX(world), entity.y, 0.45, 1.2);
  }
}
