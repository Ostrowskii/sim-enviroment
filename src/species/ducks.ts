import type { EcosystemState } from "../entities/types";
import { clamp, distance } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { applyAnimalUpkeep, eatFromCarcass, feedFromPrey } from "../sim/mortality";
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
      baseCost: 0.055,
      moveCostFactor: 0.03,
      hungerGrowth: 0.09,
      oldAgeWindow: 520
    });

    if (!aliveAfterUpkeep) {
      continue;
    }

    if (duck.resting) {
      if (duck.energy <= duck.energyResume || duck.hunger > 44) {
        duck.resting = false;
      } else {
        duck.state = "rest";
        duck.vx *= 0.58;
        duck.vy *= 0.58;
        duck.energy = clamp(duck.energy, 0, duck.maxEnergy);
        duck.hunger = clamp(duck.hunger, 0, 140);
        advanceAnimal(duck, world, 0.91);
        continue;
      }
    }

    if (!duck.resting && duck.energy >= duck.energyTarget && duck.hunger < 16) {
      duck.resting = true;
      duck.state = "rest";
      duck.vx *= 0.62;
      duck.vy *= 0.62;
      duck.energy = clamp(duck.energy, 0, duck.maxEnergy);
      duck.hunger = clamp(duck.hunger, 0, 140);
      advanceAnimal(duck, world, 0.91);
      continue;
    }

    const nearbyLeopard = findNearest(
      duck,
      state.leopards,
      duck.vision * 0.8,
      (leopard) => leopard.alive
    );

    if (nearbyLeopard && distance(duck, nearbyLeopard) < 102) {
      duck.state = "flee";
      steerAway(duck, nearbyLeopard.x, nearbyLeopard.y, 0.5, 1.26);
      steerTowards(duck, world.transitionEndX + 45, duck.y, 0.24, 1.08);
    } else {
      const needFood = duck.energy <= duck.energyResume || duck.hunger > 46;
      const fishTarget = findNearest(duck, state.fish, duck.vision + 28, (fish) => fish.alive);
      const insectTarget = findNearest(duck, state.insects, duck.vision, (insect) => insect.alive);
      const algaeTarget = findNearest(
        duck,
        state.algae,
        duck.vision * 0.95,
        (algae) => algae.alive && algae.biomass > 2.2
      );
      const carcassTarget = findNearest(
        duck,
        state.carcasses,
        duck.vision,
        (carcass) => carcass.biomass > 1.6
      );

      if (!needFood) {
        duck.state = "wander";
        applyWander(duck, rng, 0.35);
        if (biomeAt(world, duck.x) === "forest") {
          steerTowards(duck, world.transitionEndX + 24, duck.y, 0.12, 1);
        }
      } else if (fishTarget) {
        const fishDistance = distance(duck, fishTarget);
        duck.state = "hunt";
        if (fishDistance < 7) {
          feedFromPrey(state, world, rng, duck, fishTarget, {
            hungerReliefPerEnergy: 1.35,
            leftoverDelayTicks: 167
          });
          duck.state = "eat";
        } else {
          steerTowards(duck, fishTarget.x, fishTarget.y, 0.22, 1.05);
        }
      } else if (insectTarget) {
        const insectDistance = distance(duck, insectTarget);
        duck.state = "seek_food";
        if (insectDistance < 9) {
          feedFromPrey(state, world, rng, duck, insectTarget, {
            hungerReliefPerEnergy: 1.1,
            leftoverDelayTicks: 167
          });
          duck.state = "eat";
        } else {
          steerTowards(duck, insectTarget.x, insectTarget.y, 0.3, 1.08);
        }
      } else if (carcassTarget && duck.hunger > 62) {
        const carcassDistance = distance(duck, carcassTarget);
        duck.state = "seek_food";

        if (carcassDistance < 9) {
          eatFromCarcass(duck, carcassTarget, 2.8, 2.3, 10.5);
          duck.state = "eat";
        } else {
          steerTowards(duck, carcassTarget.x, carcassTarget.y, 0.24, 1.03);
        }
      } else if (algaeTarget) {
        const algaeDistance = distance(duck, algaeTarget);
        duck.state = "seek_food";

        if (algaeDistance < 9) {
          const available = Math.max(0, algaeTarget.biomass - 0.8);
          const eaten = Math.min(5.2, available);
          if (eaten > 0) {
            algaeTarget.biomass -= eaten;
            algaeTarget.energy = algaeTarget.biomass;
            duck.energy = clamp(duck.energy + eaten * 2.45, 0, duck.maxEnergy);
            duck.hunger = Math.max(0, duck.hunger - eaten * 9.8);
            duck.state = "eat";
          } else {
            duck.state = "wander";
            applyWander(duck, rng, 0.55);
          }
        } else {
          steerTowards(duck, algaeTarget.x, algaeTarget.y, 0.26, 1.04);
        }
      } else {
        duck.state = "wander";
        applyWander(duck, rng, 0.7);
        if (duck.hunger > 40) {
          steerTowards(duck, world.transitionEndX + 30, duck.y, 0.11, 1);
        }
      }
    }

    const biome = biomeAt(world, duck.x);
    if (biome === "forest") {
      duck.hunger += 0.02;
    }

    duck.energy = clamp(duck.energy, 0, duck.maxEnergy);
    duck.hunger = clamp(duck.hunger, 0, 140);

    advanceAnimal(duck, world, 0.91);
  }
}
