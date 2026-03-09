import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, killAnimal } from "../sim/mortality";
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
      baseCost: 0.42,
      hungerGrowth: 0.18,
      oldAgeWindow: 700
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const duckTarget = findNearest(
      leopard,
      state.ducks,
      leopard.vision,
      (duck) => duck.alive && biomeAt(world, duck.x) !== "lake"
    );

    if (duckTarget) {
      const preyDistance = distance(leopard, duckTarget);
      leopard.state = "hunt";

      if (preyDistance < 13) {
        killAnimal(state, world, rng, duckTarget, "predation", 0.45);
        leopard.energy = clamp(leopard.energy + 52, 0, leopard.maxEnergy);
        leopard.hunger = Math.max(0, leopard.hunger - 48);
        leopard.state = "eat";
      } else {
        steerTowards(leopard, duckTarget.x, duckTarget.y, 0.24, 1.16);
      }
    } else if (leopard.energy > leopard.maxEnergy * 0.68 && leopard.hunger < 18) {
      leopard.state = "rest";
      leopard.vx *= 0.7;
      leopard.vy *= 0.7;
    } else {
      leopard.state = "wander";
      applyWander(leopard, rng, 0.72);
      if (leopard.x > world.forestEndX + 70) {
        steerTowards(leopard, world.forestEndX - 24, leopard.y, 0.08, 1);
      }
    }

    keepLeopardOnLand(leopard, world);

    leopard.energy = clamp(leopard.energy, 0, leopard.maxEnergy);
    leopard.hunger = clamp(leopard.hunger, 0, 140);

    advanceAnimal(leopard, world, 0.9);
  }
}
