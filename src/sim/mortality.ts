import { spawnCarcass } from "../entities/factory";
import type { AnyAnimal, EcosystemState } from "../entities/types";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { addNutrientsAt } from "./resources";

export interface UpkeepConfig {
  baseCost: number;
  hungerGrowth: number;
  oldAgeWindow: number;
}

export function applyAnimalUpkeep(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  animal: AnyAnimal,
  config: UpkeepConfig
): boolean {
  if (!animal.alive) {
    return false;
  }

  animal.age += 1;
  animal.hunger += config.hungerGrowth;
  animal.reproductionCooldown = Math.max(0, animal.reproductionCooldown - 1);

  const movementCost = Math.hypot(animal.vx, animal.vy) * 0.06;
  const hungerCost = animal.hunger * 0.0028;
  const totalCost = config.baseCost + movementCost + hungerCost;

  animal.energy -= totalCost;
  addNutrientsAt(state, world, animal.x, totalCost * 0.38);

  const starvation = animal.energy <= 0 || animal.hunger >= 120;
  const oldAge = animal.age > animal.maxAge;
  const oldAgeChance = oldAge
    ? Math.min(0.9, (animal.age - animal.maxAge + 1) / config.oldAgeWindow)
    : 0;

  if (starvation || (oldAge && rng.chance(oldAgeChance))) {
    killAnimal(state, world, rng, animal, starvation ? "starvation" : "age", 1);
    return false;
  }

  return true;
}

export function killAnimal(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  animal: AnyAnimal,
  _reason: "predation" | "starvation" | "age",
  carcassScale: number
): void {
  if (!animal.alive) {
    return;
  }

  animal.alive = false;
  animal.state = "dead";
  animal.vx = 0;
  animal.vy = 0;

  state.totalDeaths += 1;

  const biomass =
    (animal.maxEnergy * 0.42 + Math.max(0, animal.energy) * 0.5 + 5) * carcassScale;

  spawnCarcass(
    state,
    animal.species,
    animal.x,
    animal.y,
    biomass,
    animal.x >= world.transitionEndX,
    rng
  );
}
