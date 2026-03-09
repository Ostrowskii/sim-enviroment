import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt, nearestLandX } from "../world/map";
import { applyAnimalUpkeep, eatFromCarcass } from "../sim/mortality";
import { advanceAnimal, applyWander, steerAway, steerTowards } from "../sim/motion";
import { findNearest } from "../sim/query";
import {
  foodPressure,
  recordActivityTick,
  shouldForage,
  updateRestingState
} from "../sim/activity";

const INSECT_ACTIVITY = {
  restBias: 0.2,
  forageThreshold: 0.29
};

export function updateInsects(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng
): void {
  for (const insect of state.insects) {
    if (!insect.alive) {
      continue;
    }

    const aliveAfterUpkeep = applyAnimalUpkeep(state, world, rng, insect, {
      baseCost: 0.018,
      moveCostFactor: 0.016,
      hungerGrowth: 0.012,
      oldAgeWindow: 220
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const biome = biomeAt(world, insect.x);
    const nearbyDuck = findNearest(
      insect,
      state.ducks,
      insect.vision * 0.52,
      (duck) => duck.alive
    );
    const threatened =
      Boolean(nearbyDuck) &&
      biome !== "lake" &&
      distance(insect, nearbyDuck as { x: number; y: number }) < insect.vision * 0.4;
    const pressure = foodPressure(insect);

    updateRestingState(insect, pressure, threatened, INSECT_ACTIVITY, rng);

    if (insect.resting && biome !== "lake") {
      insect.state = "rest";
      insect.vx *= 0.45;
      insect.vy *= 0.45;
      insect.energy = clamp(insect.energy, 0, insect.maxEnergy);
      insect.hunger = clamp(insect.hunger, 0, 140);
      recordActivityTick(state, "insect", insect.state);
      advanceAnimal(insect, world, 0.9);
      continue;
    }

    const needFood = shouldForage(insect, pressure, INSECT_ACTIVITY, rng);

    if (nearbyDuck && biome !== "lake") {
      insect.resting = false;
      insect.state = "flee";
      steerAway(insect, nearbyDuck.x, nearbyDuck.y, 0.44, 1.28);
    } else if (!needFood) {
      insect.state = "wander";
      applyWander(insect, rng, 0.22);
    } else {
      const targetTree = findNearest(
        insect,
        state.trees,
        insect.vision,
        (tree) => tree.alive && tree.food > 3
      );
      const landCarcass = findNearest(
        insect,
        state.carcasses,
        insect.vision * 0.85,
        (carcass) => !carcass.aquatic && carcass.biomass > 0.9
      );
      const shouldScavenge = Boolean(landCarcass) && (insect.hunger > 44 || !targetTree);

      if (shouldScavenge && landCarcass) {
        const carcassDistance = distance(insect, landCarcass);
        insect.state = "seek_food";

        if (carcassDistance < 8) {
          eatFromCarcass(insect, landCarcass, 1.1, 2.3, 14);
          insect.state = "eat";
          applyWander(insect, rng, 0.08);
        } else {
          steerTowards(insect, landCarcass.x, landCarcass.y, 0.34, 1.08);
        }
      } else if (targetTree) {
        const treeDistance = distance(insect, targetTree);
        if (treeDistance < 10) {
          const availableFood = Math.max(0, targetTree.food - 7.5);
          const eaten = Math.min(1.3, availableFood);
          if (eaten > 0) {
            targetTree.food -= eaten;
            targetTree.energy = targetTree.food;
            insect.energy = clamp(insect.energy + eaten * 2.8, 0, insect.maxEnergy);
            insect.hunger = Math.max(0, insect.hunger - eaten * 18);
            insect.state = "eat";
            applyWander(insect, rng, 0.1);
          } else {
            insect.state = "wander";
            applyWander(insect, rng, 0.24);
          }
        } else {
          insect.state = "seek_food";
          steerTowards(insect, targetTree.x, targetTree.y, 0.33, 1.06);
        }
      } else {
        insect.state = "wander";
        applyWander(insect, rng, 0.6);
      }
    }

    if (biome === "lake") {
      insect.resting = false;
      insect.state = "flee";
      steerTowards(insect, nearestLandX(world), insect.y, 0.5, 1.25);
      insect.energy -= 0.1;
      insect.hunger += 0.0025;
    }

    insect.energy = clamp(insect.energy, 0, insect.maxEnergy);
    insect.hunger = clamp(insect.hunger, 0, 140);

    recordActivityTick(state, "insect", insect.state);
    advanceAnimal(insect, world, 0.9);
  }
}
