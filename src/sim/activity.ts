import type { AnimalSpecies, AnyAnimal, EcosystemState } from "../entities/types";
import { clamp } from "../utils/math";
import type { SeededRng } from "../utils/rng";

export interface ActivityModelConfig {
  restBias: number;
  forageThreshold: number;
}

export function foodPressure(animal: AnyAnimal): number {
  const energyDeficit = clamp(
    (animal.energyTarget - animal.energy) / Math.max(1, animal.energyTarget),
    0,
    1
  );
  const hungerPressure = clamp(animal.hunger / 120, 0, 1);
  return clamp(energyDeficit * 0.62 + hungerPressure * 0.38, 0, 1);
}

export function updateRestingState(
  animal: AnyAnimal,
  pressure: number,
  threatened: boolean,
  config: ActivityModelConfig,
  rng: SeededRng
): void {
  if (threatened) {
    animal.resting = false;
    return;
  }

  const reserve = clamp(
    (animal.energy - animal.energyResume) / Math.max(1, animal.maxEnergy - animal.energyResume),
    0,
    1
  );
  const satiety = clamp(1 - animal.hunger / 120, 0, 1);

  if (animal.resting) {
    const wakePressure = clamp(pressure * 1.35 + (1 - satiety) * 0.25, 0, 1);
    const wakeChance = clamp(0.04 + wakePressure * 0.52, 0.04, 0.9);
    if (rng.chance(wakeChance)) {
      animal.resting = false;
    }
    return;
  }

  const readiness = clamp(reserve * 0.7 + satiety * 0.3, 0, 1);
  const enterChance = clamp(
    config.restBias * (0.24 + readiness * 0.76) * (1 - pressure * 0.65),
    0.01,
    0.95
  );

  if (rng.chance(enterChance)) {
    animal.resting = true;
  }
}

export function shouldForage(
  animal: AnyAnimal,
  pressure: number,
  config: ActivityModelConfig,
  rng: SeededRng
): boolean {
  if (animal.energy <= animal.energyResume || animal.hunger >= 94) {
    return true;
  }

  if (animal.resting) {
    return false;
  }

  const urgency = clamp((pressure - config.forageThreshold + 0.2) / 0.62, 0, 1);
  return rng.chance(urgency);
}

export function recordActivityTick(
  state: EcosystemState,
  species: AnimalSpecies,
  currentState: AnyAnimal["state"]
): void {
  const stats = state.activityStats[species];
  stats.totalTicks += 1;

  if (currentState === "rest") {
    stats.restTicks += 1;
    return;
  }

  if (currentState === "seek_food" || currentState === "hunt") {
    stats.forageTicks += 1;
  }
}
