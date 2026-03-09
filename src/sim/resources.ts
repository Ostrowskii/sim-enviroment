import type { EcosystemState } from "../entities/types";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { clamp } from "../utils/math";

const SOIL_NUTRIENT_MAX = 3200;
const WATER_NUTRIENT_MAX = 3200;

export function addNutrientsAt(
  state: EcosystemState,
  world: WorldMap,
  x: number,
  amount: number
): void {
  if (amount <= 0) {
    return;
  }

  const biome = biomeAt(world, x);
  if (biome === "lake") {
    state.waterNutrients = clamp(state.waterNutrients + amount, 0, WATER_NUTRIENT_MAX);
  } else {
    state.soilNutrients = clamp(state.soilNutrients + amount, 0, SOIL_NUTRIENT_MAX);
  }
}

export function consumeSoilNutrients(state: EcosystemState, amount: number): number {
  const used = Math.min(amount, state.soilNutrients);
  state.soilNutrients -= used;
  return used;
}

export function consumeWaterNutrients(state: EcosystemState, amount: number): number {
  const used = Math.min(amount, state.waterNutrients);
  state.waterNutrients -= used;
  return used;
}

export function updatePrimaryProducers(state: EcosystemState): void {
  // Very small baseline mineral input to prevent nutrient deadlocks.
  state.soilNutrients = clamp(state.soilNutrients + 0.08, 0, SOIL_NUTRIENT_MAX);
  state.waterNutrients = clamp(state.waterNutrients + 0.1, 0, WATER_NUTRIENT_MAX);

  for (const tree of state.trees) {
    if (!tree.alive) {
      continue;
    }

    tree.age += 1;
    tree.spreadCooldown = Math.max(0, tree.spreadCooldown - 1);

    const growthNeed = Math.max(0, tree.maxFood - tree.food);
    const desiredNutrient = Math.min(tree.nutrientDemand, 0.16 + growthNeed * 0.03);
    const consumed = consumeSoilNutrients(state, desiredNutrient);
    const growth = consumed * 1.4;

    tree.food = clamp(tree.food + growth - 0.03, 0, tree.maxFood);
    tree.energy = tree.food;
    tree.hunger = clamp((1 - tree.food / tree.maxFood) * 100, 0, 100);
    tree.state = tree.food < tree.maxFood * 0.25 ? "rest" : "idle";
  }

  for (const algae of state.algae) {
    if (!algae.alive) {
      continue;
    }

    algae.age += 1;
    algae.spreadCooldown = Math.max(0, algae.spreadCooldown - 1);

    const growthNeed = Math.max(0, algae.maxBiomass - algae.biomass);
    const desiredNutrient = Math.min(1.15, 0.12 + growthNeed * 0.035);
    const consumed = consumeWaterNutrients(state, desiredNutrient);
    const growth = consumed * 1.3;

    algae.biomass = clamp(algae.biomass + growth - 0.02, 0, algae.maxBiomass);
    algae.energy = algae.biomass;
    algae.hunger = clamp((1 - algae.biomass / algae.maxBiomass) * 100, 0, 100);
    algae.state = algae.biomass < algae.maxBiomass * 0.2 ? "rest" : "idle";
  }

  state.soilNutrients = clamp(state.soilNutrients, 0, SOIL_NUTRIENT_MAX);
  state.waterNutrients = clamp(state.waterNutrients, 0, WATER_NUTRIENT_MAX);
}
