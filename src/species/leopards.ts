import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, eatFromCarcass, feedFromPrey } from "../sim/mortality";
import {
  advanceAnimal,
  applyWander,
  keepLeopardOnLand,
  steerTowards
} from "../sim/motion";
import { findNearest } from "../sim/query";

export function updateLeopards(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng
): void {
  for (const leopard of state.leopards) {
    if (!leopard.alive) {
      continue;
    }

    const aliveAfterUpkeep = applyAnimalUpkeep(state, world, rng, leopard, {
      baseCost: 0.085,
      moveCostFactor: 0.045,
      hungerGrowth: 0.08,
      oldAgeWindow: 850
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    if (leopard.resting) {
      if (leopard.energy <= leopard.energyResume || leopard.hunger > 40) {
        leopard.resting = false;
      } else {
        leopard.state = "rest";
        leopard.vx *= 0.56;
        leopard.vy *= 0.56;
        keepLeopardOnLand(leopard, world);
        leopard.energy = clamp(leopard.energy, 0, leopard.maxEnergy);
        leopard.hunger = clamp(leopard.hunger, 0, 140);
        advanceAnimal(leopard, world, 0.9);
        continue;
      }
    }

    if (!leopard.resting && leopard.energy >= leopard.energyTarget && leopard.hunger < 14) {
      leopard.resting = true;
      leopard.state = "rest";
      leopard.vx *= 0.62;
      leopard.vy *= 0.62;
      keepLeopardOnLand(leopard, world);
      leopard.energy = clamp(leopard.energy, 0, leopard.maxEnergy);
      leopard.hunger = clamp(leopard.hunger, 0, 140);
      advanceAnimal(leopard, world, 0.9);
      continue;
    }

    const needFood = leopard.energy <= leopard.energyResume || leopard.hunger > 36;
    const duckTarget = findNearest(
      leopard,
      state.ducks,
      leopard.vision * 0.82,
      (duck) => duck.alive && biomeAt(world, duck.x) !== "lake"
    );
    const landCarcass = findNearest(
      leopard,
      state.carcasses,
      leopard.vision,
      (carcass) => !carcass.aquatic && carcass.biomass > 2
    );

    if (!needFood) {
      leopard.state = "wander";
      applyWander(leopard, rng, 0.3);
    } else if (landCarcass && (state.ducks.length <= 2 || leopard.hunger > 65)) {
      const carcassDistance = distance(leopard, landCarcass);
      leopard.state = "seek_food";

      if (carcassDistance < 10) {
        eatFromCarcass(leopard, landCarcass, 4.6, 2.5, 7.6);
        leopard.state = "eat";
      } else {
        steerTowards(leopard, landCarcass.x, landCarcass.y, 0.24, 1.04);
      }
    } else if (duckTarget && state.ducks.length > 1) {
      const preyDistance = distance(leopard, duckTarget);
      leopard.state = "hunt";

      if (preyDistance < 8.5) {
        feedFromPrey(state, world, rng, leopard, duckTarget, {
          hungerReliefPerEnergy: 1.0,
          leftoverDelayTicks: 167
        });
        leopard.state = "eat";
      } else {
        steerTowards(leopard, duckTarget.x, duckTarget.y, 0.2, 1.04);
      }
    } else if (landCarcass) {
      const carcassDistance = distance(leopard, landCarcass);
      leopard.state = "seek_food";
      if (carcassDistance < 10) {
        eatFromCarcass(leopard, landCarcass, 4.2, 2.25, 7.2);
        leopard.state = "eat";
      } else {
        steerTowards(leopard, landCarcass.x, landCarcass.y, 0.22, 1.03);
      }
    } else {
      leopard.state = "wander";
      applyWander(leopard, rng, 0.64);
      if (leopard.x > world.forestEndX + 70) {
        steerTowards(leopard, world.forestEndX - 24, leopard.y, 0.1, 1);
      }
    }

    keepLeopardOnLand(leopard, world);

    leopard.energy = clamp(leopard.energy, 0, leopard.maxEnergy);
    leopard.hunger = clamp(leopard.hunger, 0, 140);

    advanceAnimal(leopard, world, 0.9);
  }
}
