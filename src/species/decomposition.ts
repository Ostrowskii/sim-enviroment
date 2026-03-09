import type { EcosystemState } from "../entities/types";
import type { WorldMap } from "../world/map";
import { addNutrientsAt } from "../sim/resources";

export function updateDecomposition(state: EcosystemState, world: WorldMap): void {
  const remaining = [];

  for (const carcass of state.carcasses) {
    carcass.age += 1;

    const decay = Math.min(
      carcass.biomass,
      carcass.decayRate + carcass.maxBiomass * 0.018
    );

    carcass.biomass -= decay;
    carcass.energy = carcass.biomass;
    carcass.hunger = carcass.maxBiomass > 0 ? (1 - carcass.biomass / carcass.maxBiomass) * 100 : 100;

    addNutrientsAt(state, world, carcass.x, decay * 0.9);

    if (carcass.biomass > 0.5) {
      remaining.push(carcass);
    }
  }

  state.carcasses = remaining;
}
