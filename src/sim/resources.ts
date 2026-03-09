import type { EcosystemState } from "../entities/types";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { clamp } from "../utils/math";

const DAY_LENGTH_TICKS = 1000;

export function sunlightAtTick(tick: number): number {
  const dayPhase = (tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS;
  return Math.max(0, Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2));
}

function cellIndexAt(state: EcosystemState, x: number, y: number): number {
  const grid = state.nutrientGrid;
  const col = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cellWidth)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellHeight)));
  return row * grid.cols + col;
}

function diffuseNutrients(
  values: number[],
  mask: readonly boolean[],
  cols: number,
  rows: number,
  amount: number,
  maxPerCell: number
): void {
  const next = values.slice();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (!mask[index]) {
        continue;
      }

      let sum = values[index];
      let count = 1;
      const neighbors = [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
          continue;
        }
        const nIndex = ny * cols + nx;
        if (!mask[nIndex]) {
          continue;
        }
        sum += values[nIndex];
        count += 1;
      }

      const average = sum / count;
      next[index] = clamp(values[index] + (average - values[index]) * amount, 0, maxPerCell);
    }
  }

  for (let i = 0; i < values.length; i += 1) {
    values[i] = next[i];
  }
}

export function syncNutrientTotals(state: EcosystemState): void {
  let soilTotal = 0;
  let waterTotal = 0;

  for (const value of state.nutrientGrid.soil) {
    soilTotal += value;
  }
  for (const value of state.nutrientGrid.water) {
    waterTotal += value;
  }

  state.soilNutrients = soilTotal;
  state.waterNutrients = waterTotal;
}

export function addNutrientsAt(
  state: EcosystemState,
  world: WorldMap,
  x: number,
  y: number,
  amount: number
): void {
  if (amount <= 0) {
    return;
  }

  const grid = state.nutrientGrid;
  const index = cellIndexAt(state, x, y);
  const biome = biomeAt(world, x);

  if (biome === "lake") {
    grid.water[index] = clamp(grid.water[index] + amount, 0, grid.maxPerCell);
  } else {
    grid.soil[index] = clamp(grid.soil[index] + amount, 0, grid.maxPerCell);
  }
}

export function consumeSoilNutrientsAt(
  state: EcosystemState,
  x: number,
  y: number,
  amount: number
): number {
  if (amount <= 0) {
    return 0;
  }

  const index = cellIndexAt(state, x, y);
  const cell = state.nutrientGrid.soil[index];
  const used = Math.min(amount, cell);
  state.nutrientGrid.soil[index] -= used;
  return used;
}

export function consumeWaterNutrientsAt(
  state: EcosystemState,
  x: number,
  y: number,
  amount: number
): number {
  if (amount <= 0) {
    return 0;
  }

  const index = cellIndexAt(state, x, y);
  const cell = state.nutrientGrid.water[index];
  const used = Math.min(amount, cell);
  state.nutrientGrid.water[index] -= used;
  return used;
}

export function updatePrimaryProducers(state: EcosystemState, world: WorldMap): void {
  const sunlight = sunlightAtTick(state.tick);
  const grid = state.nutrientGrid;

  // Baseline mineral renewal so movement/metabolism losses are repaid by the environment over time.
  for (let i = 0; i < grid.soil.length; i += 1) {
    if (grid.soilMask[i]) {
      grid.soil[i] = clamp(grid.soil[i] + 0.02 + sunlight * 0.008, 0, grid.maxPerCell);
    }
    if (grid.waterMask[i]) {
      grid.water[i] = clamp(grid.water[i] + 0.026 + sunlight * 0.01, 0, grid.maxPerCell);
    }
  }

  if (state.tick % 12 === 0) {
    diffuseNutrients(grid.soil, grid.soilMask, grid.cols, grid.rows, 0.08, grid.maxPerCell);
    diffuseNutrients(grid.water, grid.waterMask, grid.cols, grid.rows, 0.1, grid.maxPerCell);
  }

  for (const tree of state.trees) {
    if (!tree.alive) {
      continue;
    }

    tree.age += 1;
    tree.spreadCooldown = Math.max(0, tree.spreadCooldown - 1);

    const solarGrowth = 0.08 + sunlight * 0.38;
    // Tree energy only rises with sunlight and only drops when consumed by animals.
    tree.food = clamp(tree.food + solarGrowth, 0, tree.maxFood);
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
    const desiredNutrient = Math.min(1.45, 0.18 + growthNeed * 0.05);
    const consumed = consumeWaterNutrientsAt(state, algae.x, algae.y, desiredNutrient);
    const nutrientFactor = desiredNutrient > 0 ? consumed / desiredNutrient : 1;
    const growth = consumed * 1.75;
    const solarGrowth = (0.08 + sunlight * 0.36) * (0.5 + nutrientFactor * 0.5);
    const litter = algae.biomass * 0.0015;

    algae.biomass = clamp(algae.biomass + growth + solarGrowth - 0.018 - litter, 0, algae.maxBiomass);
    addNutrientsAt(state, world, algae.x, algae.y, litter * 0.92);
    algae.energy = algae.biomass;
    algae.hunger = clamp((1 - algae.biomass / algae.maxBiomass) * 100, 0, 100);
    algae.state = algae.biomass < algae.maxBiomass * 0.2 ? "rest" : "idle";
  }

  syncNutrientTotals(state);
}
