import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, eatFromCarcass, feedFromPrey } from "../sim/mortality";
import {
  advanceAnimal,
  applyWander,
  keepFishInLake,
  steerAway,
  steerTowards
} from "../sim/motion";
import { findNearest } from "../sim/query";
import {
  foodPressure,
  recordActivityTick,
  shouldForage,
  updateRestingState
} from "../sim/activity";

const FISH_ACTIVITY = {
  restBias: 0.4,
  forageThreshold: 0.42
};

export function updateFish(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  for (const fish of state.fish) {
    if (!fish.alive) {
      continue;
    }

    const aliveAfterUpkeep = applyAnimalUpkeep(state, world, rng, fish, {
      baseCost: 0.04,
      moveCostFactor: 0.02,
      hungerGrowth: 0.035,
      oldAgeWindow: 350
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const nearbyDuck = findNearest(
      fish,
      state.ducks,
      fish.vision * 0.85,
      (duck) => duck.alive
    );
    const threatened =
      Boolean(nearbyDuck) &&
      distance(fish, nearbyDuck as { x: number; y: number }) < fish.vision * 0.66;
    const pressure = foodPressure(fish);
    updateRestingState(fish, pressure, threatened, FISH_ACTIVITY, rng);

    if (fish.resting && !threatened) {
      fish.state = "rest";
      fish.vx *= 0.48;
      fish.vy *= 0.48;
      keepFishInLake(fish, world);
      fish.energy = clamp(fish.energy, 0, fish.maxEnergy);
      fish.hunger = clamp(fish.hunger, 0, 140);
      recordActivityTick(state, "fish", fish.state);
      advanceAnimal(fish, world, 0.93);
      continue;
    }

    const algaeFood = findNearest(
      fish,
      state.algae,
      fish.vision * 1.35,
      (algae) => algae.alive && algae.biomass > 1.1
    );
    const insectPrey = findNearest(
      fish,
      state.insects,
      fish.vision,
      (insect) => insect.alive && biomeAt(world, insect.x) === "lake"
    );
    const aquaticCarcass = findNearest(
      fish,
      state.carcasses,
      fish.vision * 1.1,
      (carcass) => carcass.aquatic && carcass.biomass > 1.2
    );

    if (nearbyDuck && threatened) {
      fish.resting = false;
      fish.state = "flee";
      steerAway(fish, nearbyDuck.x, nearbyDuck.y, 0.4, 1.24);
      keepFishInLake(fish, world);
      fish.energy = clamp(fish.energy, 0, fish.maxEnergy);
      fish.hunger = clamp(fish.hunger, 0, 140);
      recordActivityTick(state, "fish", fish.state);
      advanceAnimal(fish, world, 0.93);
      continue;
    }

    const needFood = shouldForage(fish, pressure, FISH_ACTIVITY, rng);

    if (!needFood) {
      fish.state = "wander";
      applyWander(fish, rng, 0.14);
      keepFishInLake(fish, world);
      fish.energy = clamp(fish.energy, 0, fish.maxEnergy);
      fish.hunger = clamp(fish.hunger, 0, 140);
      recordActivityTick(state, "fish", fish.state);
      advanceAnimal(fish, world, 0.93);
      continue;
    }

    if (aquaticCarcass && fish.hunger > 58) {
      const carcassDistance = distance(fish, aquaticCarcass);
      fish.state = "seek_food";

      if (carcassDistance < 9) {
        eatFromCarcass(fish, aquaticCarcass, 2.4, 2.2, 10.5);
        fish.state = "eat";
      } else {
        steerTowards(fish, aquaticCarcass.x, aquaticCarcass.y, 0.28, 1.04);
      }
    } else if (algaeFood && (fish.hunger > 24 || !insectPrey)) {
      const algaeDistance = distance(fish, algaeFood);
      fish.state = "seek_food";

      if (algaeDistance < 8) {
        const available = Math.max(0, algaeFood.biomass - 0.6);
        const eaten = Math.min(3.8, available);
        if (eaten > 0) {
          algaeFood.biomass -= eaten;
          algaeFood.energy = algaeFood.biomass;
          fish.energy = clamp(fish.energy + eaten * 2.95, 0, fish.maxEnergy);
          fish.hunger = Math.max(0, fish.hunger - eaten * 11.5);
          fish.state = "eat";
        } else {
          fish.state = "wander";
          applyWander(fish, rng, 0.16);
        }
      } else {
        steerTowards(fish, algaeFood.x, algaeFood.y, 0.3, 1.1);
      }
    } else if (insectPrey) {
      const preyDistance = distance(fish, insectPrey);
      fish.state = "hunt";

      if (preyDistance < 8) {
        feedFromPrey(state, world, rng, fish, insectPrey, {
          hungerReliefPerEnergy: 1.15,
          leftoverDelayTicks: 167
        });
        fish.state = "eat";
      } else {
        steerTowards(fish, insectPrey.x, insectPrey.y, 0.3, 1.12);
      }
    } else if (algaeFood) {
      const algaeDistance = distance(fish, algaeFood);
      fish.state = "seek_food";

      if (algaeDistance < 8) {
        const available = Math.max(0, algaeFood.biomass - 0.7);
        const eaten = Math.min(2.8, available);
        if (eaten > 0) {
          algaeFood.biomass -= eaten;
          algaeFood.energy = algaeFood.biomass;
          fish.energy = clamp(fish.energy + eaten * 2.65, 0, fish.maxEnergy);
          fish.hunger = Math.max(0, fish.hunger - eaten * 9.6);
          fish.state = "eat";
        } else {
          fish.state = "wander";
          applyWander(fish, rng, 0.14);
        }
      } else {
        steerTowards(fish, algaeFood.x, algaeFood.y, 0.26, 1.06);
      }
    } else {
      fish.state = "wander";
      applyWander(fish, rng, 0.28);
    }

    keepFishInLake(fish, world);

    if (biomeAt(world, fish.x) !== "lake") {
      fish.energy -= 0.04;
      fish.hunger += 0.012;
    }

    fish.energy = clamp(fish.energy, 0, fish.maxEnergy);
    fish.hunger = clamp(fish.hunger, 0, 140);

    recordActivityTick(state, "fish", fish.state);
    advanceAnimal(fish, world, 0.93);
  }
}
