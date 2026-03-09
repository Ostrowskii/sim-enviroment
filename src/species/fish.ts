import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, killAnimal } from "../sim/mortality";
import {
  advanceAnimal,
  applyWander,
  keepFishInLake,
  steerTowards
} from "../sim/motion";
import { findNearest } from "../sim/query";

export function updateFish(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  for (const fish of state.fish) {
    if (!fish.alive) {
      continue;
    }

    const aliveAfterUpkeep = applyAnimalUpkeep(state, world, rng, fish, {
      baseCost: 0.23,
      hungerGrowth: 0.3,
      oldAgeWindow: 320
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const algaeFood = findNearest(
      fish,
      state.algae,
      fish.vision * 1.25,
      (algae) => algae.alive && algae.biomass > 0.8
    );

    const insectPrey = findNearest(
      fish,
      state.insects,
      fish.vision,
      (insect) => insect.alive && biomeAt(world, insect.x) === "lake"
    );

    const shouldPreferAlgae = Boolean(algaeFood) && (fish.hunger > 14 || !insectPrey);

    if (shouldPreferAlgae && algaeFood) {
      const algaeDistance = distance(fish, algaeFood);
      fish.state = "seek_food";

      if (algaeDistance < 8) {
        const eaten = Math.min(3.4, algaeFood.biomass);
        algaeFood.biomass -= eaten;
        algaeFood.energy = algaeFood.biomass;

        fish.energy = clamp(fish.energy + eaten * 2.8, 0, fish.maxEnergy);
        fish.hunger = Math.max(0, fish.hunger - eaten * 12);
        fish.state = "eat";
      } else {
        steerTowards(fish, algaeFood.x, algaeFood.y, 0.3, 1.08);
      }
    } else if (insectPrey) {
      const preyDistance = distance(fish, insectPrey);
      fish.state = "hunt";

      if (preyDistance < 8) {
        killAnimal(state, world, rng, insectPrey, "predation", 0.3);
        fish.energy = clamp(fish.energy + 11, 0, fish.maxEnergy);
        fish.hunger = Math.max(0, fish.hunger - 22);
        fish.state = "eat";
      } else {
        steerTowards(fish, insectPrey.x, insectPrey.y, 0.28, 1.12);
      }
    } else if (algaeFood) {
      const algaeDistance = distance(fish, algaeFood);
      fish.state = "seek_food";

      if (algaeDistance < 8) {
        const eaten = Math.min(2.6, algaeFood.biomass);
        algaeFood.biomass -= eaten;
        algaeFood.energy = algaeFood.biomass;

        fish.energy = clamp(fish.energy + eaten * 2.5, 0, fish.maxEnergy);
        fish.hunger = Math.max(0, fish.hunger - eaten * 10);
        fish.state = "eat";
      } else {
        steerTowards(fish, algaeFood.x, algaeFood.y, 0.24, 1.04);
      }
    } else {
      fish.state = "wander";
      applyWander(fish, rng, 0.85);
    }

    keepFishInLake(fish, world);

    if (biomeAt(world, fish.x) !== "lake") {
      fish.energy -= 0.08;
      fish.hunger += 0.12;
    }

    fish.energy = clamp(fish.energy, 0, fish.maxEnergy);
    fish.hunger = clamp(fish.hunger, 0, 140);

    advanceAnimal(fish, world, 0.93);
  }
}
