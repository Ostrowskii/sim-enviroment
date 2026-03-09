import { spawnCarcass } from "../entities/factory";
import type { AnyAnimal, CarcassEntity, EcosystemState } from "../entities/types";
import { clamp } from "../utils/math";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { addNutrientsAt } from "./resources";

const HUNGER_ENERGY_COST_FACTOR = 0.00045;
const MOVEMENT_ENERGY_COST_MULTIPLIER = 0.35;
const ACTIVE_ENERGY_DRAIN_MULTIPLIER = 0.42;

export interface UpkeepConfig {
  baseCost: number;
  moveCostFactor: number;
  hungerGrowth: number;
  oldAgeWindow: number;
  restEnergyMultiplier?: number;
  restHungerMultiplier?: number;
}

export interface KillOptions {
  spawnCarcass?: boolean;
  decomposeDelayTicks?: number;
  isLeftover?: boolean;
}

export interface PredationConfig {
  hungerReliefPerEnergy: number;
  leftoverDelayTicks?: number;
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
  const restEnergyMultiplier = config.restEnergyMultiplier ?? 0.2;
  const restHungerMultiplier = config.restHungerMultiplier ?? 0.55;
  const hungerMultiplier = animal.resting ? restHungerMultiplier : 1;
  animal.hunger += config.hungerGrowth * hungerMultiplier;
  animal.reproductionCooldown = Math.max(0, animal.reproductionCooldown - 1);

  const movementCost =
    Math.hypot(animal.vx, animal.vy) * config.moveCostFactor * MOVEMENT_ENERGY_COST_MULTIPLIER;
  const hungerCost = animal.hunger * HUNGER_ENERGY_COST_FACTOR;
  const activeCost = config.baseCost + movementCost + hungerCost;
  const scaledActiveCost = activeCost * ACTIVE_ENERGY_DRAIN_MULTIPLIER;
  const totalCost = animal.resting ? scaledActiveCost * restEnergyMultiplier : scaledActiveCost;

  animal.energy -= totalCost;
  addNutrientsAt(state, world, animal.x, animal.y, totalCost * 0.5);

  const starvation = animal.energy <= 0 || animal.hunger >= 140;
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
  carcassScale: number,
  options?: KillOptions
): void {
  if (!animal.alive) {
    return;
  }

  animal.alive = false;
  animal.state = "dead";
  animal.vx = 0;
  animal.vy = 0;

  state.totalDeaths += 1;

  if (options?.spawnCarcass === false) {
    return;
  }

  const biomass =
    (animal.maxEnergy * 0.5 + Math.max(0, animal.energy) * 0.55 + 6) * Math.max(0, carcassScale);

  if (biomass <= 0) {
    return;
  }

  spawnCarcass(
    state,
    animal.species,
    animal.x,
    animal.y,
    biomass,
    biomeAt(world, animal.x) === "lake",
    rng,
    {
      decomposeDelayTicks: options?.decomposeDelayTicks ?? 167,
      isLeftover: options?.isLeftover ?? false
    }
  );
}

export function feedFromPrey(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  predator: AnyAnimal,
  prey: AnyAnimal,
  config: PredationConfig
): void {
  if (!predator.alive || !prey.alive) {
    return;
  }

  const preyEnergy = Math.max(0, prey.energy);

  killAnimal(state, world, rng, prey, "predation", 0, {
    spawnCarcass: false
  });

  const room = Math.max(0, predator.maxEnergy - predator.energy);
  const absorbed = Math.min(room, preyEnergy);
  const leftover = Math.max(0, preyEnergy - absorbed);

  predator.energy = clamp(predator.energy + absorbed, 0, predator.maxEnergy);
  predator.hunger = Math.max(0, predator.hunger - absorbed * config.hungerReliefPerEnergy);

  if (leftover > 0.6) {
    spawnCarcass(
      state,
      prey.species,
      prey.x,
      prey.y,
      leftover,
      biomeAt(world, prey.x) === "lake",
      rng,
      {
        decomposeDelayTicks: config.leftoverDelayTicks ?? 167,
        isLeftover: true
      }
    );
  }
}

export function eatFromCarcass(
  eater: AnyAnimal,
  carcass: CarcassEntity,
  biteSize: number,
  energyPerBiomass: number,
  hungerReliefPerBiomass: number
): number {
  if (biteSize <= 0 || carcass.biomass <= 0) {
    return 0;
  }

  const eaten = Math.min(biteSize, carcass.biomass);
  carcass.biomass -= eaten;
  carcass.energy = carcass.biomass;

  eater.energy = clamp(eater.energy + eaten * energyPerBiomass, 0, eater.maxEnergy);
  eater.hunger = Math.max(0, eater.hunger - eaten * hungerReliefPerBiomass);
  return eaten;
}
