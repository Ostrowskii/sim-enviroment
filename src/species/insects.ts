import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt, nearestLandX } from "../world/map";
import { applyAnimalUpkeep } from "../sim/mortality";
import { advanceAnimal, applyWander, steerAway, steerTowards } from "../sim/motion";
import { findNearest } from "../sim/query";

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
      baseCost: 0.18,
      hungerGrowth: 0.38,
      oldAgeWindow: 180
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const biome = biomeAt(world, insect.x);
    const nearbyDuck = findNearest(
      insect,
      state.ducks,
      insect.vision * 0.5,
      (duck) => duck.alive
    );

    if (nearbyDuck && biome !== "lake") {
      insect.state = "flee";
      steerAway(insect, nearbyDuck.x, nearbyDuck.y, 0.42, 1.25);
    } else {
      const targetTree = findNearest(
        insect,
        state.trees,
        insect.vision,
        (tree) => tree.alive && tree.food > 2.5
      );

      if (targetTree) {
        const treeDistance = distance(insect, targetTree);
        if (treeDistance < 10) {
          const eaten = Math.min(1.5, targetTree.food);
          targetTree.food -= eaten;
          targetTree.energy = targetTree.food;

          insect.energy = clamp(insect.energy + eaten * 2.2, 0, insect.maxEnergy);
          insect.hunger = Math.max(0, insect.hunger - eaten * 20);
          insect.state = "eat";

          applyWander(insect, rng, 0.15);
        } else {
          insect.state = "seek_food";
          steerTowards(insect, targetTree.x, targetTree.y, 0.34, 1.08);
        }
      } else if (insect.energy > insect.maxEnergy * 0.75 && insect.hunger < 10) {
        insect.state = "rest";
        insect.vx *= 0.7;
        insect.vy *= 0.7;
      } else {
        insect.state = "wander";
        applyWander(insect, rng, 1);
      }
    }

    if (biome === "lake") {
      insect.state = "flee";
      steerTowards(insect, nearestLandX(world), insect.y, 0.48, 1.22);
      insect.energy -= 0.2;
      insect.hunger += 0.45;
    }

    insect.energy = clamp(insect.energy, 0, insect.maxEnergy);
    insect.hunger = clamp(insect.hunger, 0, 140);

    advanceAnimal(insect, world, 0.9);
  }
}
