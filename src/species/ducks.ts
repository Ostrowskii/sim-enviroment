import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, killAnimal } from "../sim/mortality";
import { advanceAnimal, applyWander, steerAway, steerTowards } from "../sim/motion";
import { findNearest } from "../sim/query";

export function updateDucks(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng
): void {
  for (const duck of state.ducks) {
    if (!duck.alive) {
      continue;
    }

    const aliveAfterUpkeep = applyAnimalUpkeep(state, world, rng, duck, {
      baseCost: 0.18,
      hungerGrowth: 0.14,
      oldAgeWindow: 440
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    const nearbyLeopard = findNearest(
      duck,
      state.leopards,
      duck.vision * 0.78,
      (leopard) => leopard.alive
    );

    if (nearbyLeopard && distance(duck, nearbyLeopard) < 95) {
      duck.state = "flee";
      steerAway(duck, nearbyLeopard.x, nearbyLeopard.y, 0.48, 1.25);
      steerTowards(duck, world.transitionEndX + 45, duck.y, 0.22, 1.05);
    } else {
      const fishTarget = findNearest(duck, state.fish, duck.vision + 25, (fish) => fish.alive);
      const fishDistance = fishTarget ? distance(duck, fishTarget) : Number.POSITIVE_INFINITY;
      const shouldHuntFish = Boolean(fishTarget) && (duck.hunger > 70 || fishDistance < 18);

      if (shouldHuntFish && fishTarget) {
        duck.state = "hunt";
        if (fishDistance < 7) {
          killAnimal(state, world, rng, fishTarget, "predation", 0.26);
          duck.energy = clamp(duck.energy + 17, 0, duck.maxEnergy);
          duck.hunger = Math.max(0, duck.hunger - 26);
          duck.state = "eat";
        } else {
          steerTowards(duck, fishTarget.x, fishTarget.y, 0.2, 1.02);
        }
      } else {
        const insectTarget = findNearest(
          duck,
          state.insects,
          duck.vision,
          (insect) => insect.alive
        );

        if (insectTarget) {
          const insectDistance = distance(duck, insectTarget);
          duck.state = "seek_food";
          if (insectDistance < 9) {
            killAnimal(state, world, rng, insectTarget, "predation", 0.2);
            duck.energy = clamp(duck.energy + 11, 0, duck.maxEnergy);
            duck.hunger = Math.max(0, duck.hunger - 16);
            duck.state = "eat";
          } else {
            steerTowards(duck, insectTarget.x, insectTarget.y, 0.3, 1.1);
          }
        } else {
          const algaeTarget = findNearest(
            duck,
            state.algae,
            duck.vision,
            (algae) => algae.alive && algae.biomass > 2
          );

          if (algaeTarget) {
            const algaeDistance = distance(duck, algaeTarget);
            duck.state = "seek_food";

            if (algaeDistance < 9) {
              const available = Math.max(0, algaeTarget.biomass - 0.6);
              const eaten = Math.min(4.8, available);
              if (eaten <= 0) {
                duck.state = "wander";
                applyWander(duck, rng, 0.5);
                duck.energy = clamp(duck.energy, 0, duck.maxEnergy);
                duck.hunger = clamp(duck.hunger, 0, 140);
                advanceAnimal(duck, world, 0.91);
                continue;
              }

              algaeTarget.biomass -= eaten;
              algaeTarget.energy = algaeTarget.biomass;

              duck.energy = clamp(duck.energy + eaten * 2.2, 0, duck.maxEnergy);
              duck.hunger = Math.max(0, duck.hunger - eaten * 9);
              duck.state = "eat";
            } else {
              steerTowards(duck, algaeTarget.x, algaeTarget.y, 0.26, 1.05);
            }
          } else {
            duck.state = "wander";
            applyWander(duck, rng, 0.8);

            if (duck.hunger > 32) {
              steerTowards(duck, world.transitionEndX + 30, duck.y, 0.08, 1);
            }
          }
        }
      }
    }

    const biome = biomeAt(world, duck.x);
    if (biome === "forest") {
      duck.hunger += 0.06;
    }

    duck.energy = clamp(duck.energy, 0, duck.maxEnergy);
    duck.hunger = clamp(duck.hunger, 0, 140);

    advanceAnimal(duck, world, 0.91);
  }
}
