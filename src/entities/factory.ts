import type {
  AlgaeEntity,
  CarcassEntity,
  DuckEntity,
  EcosystemState,
  FishEntity,
  InsectEntity,
  LeopardEntity,
  LivingSpecies,
  NutrientGrid,
  TreeEntity
} from "./types";
import type { WorldMap } from "../world/map";
import { biomeAt, randomPointInBiome } from "../world/map";
import type { SeededRng } from "../utils/rng";

export interface InitialCounts {
  trees: number;
  algae: number;
  insects: number;
  fish: number;
  ducks: number;
  leopards: number;
}

export const DEFAULT_COUNTS: InitialCounts = {
  trees: 20,
  algae: 32,
  insects: 40,
  fish: 20,
  ducks: 6,
  leopards: 2
};

const NUTRIENT_GRID_COLS = 25;
const NUTRIENT_GRID_ROWS = 16;
const NUTRIENT_CELL_MAX = 26;

function nextId(state: EcosystemState): number {
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  return id;
}

function createNutrientGrid(world: WorldMap): NutrientGrid {
  const cols = NUTRIENT_GRID_COLS;
  const rows = NUTRIENT_GRID_ROWS;
  const cellWidth = world.width / cols;
  const cellHeight = world.height / rows;
  const size = cols * rows;

  const soil = new Array<number>(size).fill(0);
  const water = new Array<number>(size).fill(0);
  const soilMask = new Array<boolean>(size).fill(false);
  const waterMask = new Array<boolean>(size).fill(false);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const centerX = (col + 0.5) * cellWidth;
      const biome = biomeAt(world, centerX);

      if (biome === "lake") {
        waterMask[index] = true;
        water[index] = 10 + ((col * 11 + row * 7) % 6) * 0.6;
      } else {
        soilMask[index] = true;
        soil[index] = 8 + ((col * 7 + row * 13) % 5) * 0.55;
      }
    }
  }

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    maxPerCell: NUTRIENT_CELL_MAX,
    soil,
    water,
    soilMask,
    waterMask
  };
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

export function createEmptyState(seed: number, world: WorldMap): EcosystemState {
  const nutrientGrid = createNutrientGrid(world);

  return {
    tick: 0,
    seed,
    nextEntityId: 1,
    totalDeaths: 0,
    nutrientGrid,
    soilNutrients: sum(nutrientGrid.soil),
    waterNutrients: sum(nutrientGrid.water),
    trees: [],
    algae: [],
    insects: [],
    fish: [],
    ducks: [],
    leopards: [],
    carcasses: []
  };
}

export function spawnTree(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): TreeEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "forest") : { x, y };
  const maxFood = rng.float(85, 130);

  const tree: TreeEntity = {
    id: nextId(state),
    species: "tree",
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    energy: maxFood * 0.7,
    maxEnergy: maxFood,
    age: rng.int(0, 1200),
    hunger: 0,
    state: "idle",
    alive: true,
    vision: 0,
    food: maxFood * rng.float(0.45, 0.8),
    maxFood,
    nutrientDemand: rng.float(0.8, 1.35),
    spreadCooldown: rng.int(90, 220)
  };

  state.trees.push(tree);
  return tree;
}

export function spawnAlgae(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): AlgaeEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "lake") : { x, y };
  const maxBiomass = rng.float(22, 52);

  const algae: AlgaeEntity = {
    id: nextId(state),
    species: "algae",
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    energy: maxBiomass * 0.7,
    maxEnergy: maxBiomass,
    age: rng.int(0, 600),
    hunger: 0,
    state: "idle",
    alive: true,
    vision: 0,
    biomass: maxBiomass * rng.float(0.45, 0.85),
    maxBiomass,
    spreadCooldown: rng.int(45, 120)
  };

  state.algae.push(algae);
  return algae;
}

export function spawnInsect(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): InsectEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "forest") : { x, y };
  const maxEnergy = rng.float(26, 34);

  const insect: InsectEntity = {
    id: nextId(state),
    species: "insect",
    x: pos.x,
    y: pos.y,
    vx: rng.float(-0.4, 0.4),
    vy: rng.float(-0.4, 0.4),
    energy: maxEnergy * rng.float(0.45, 0.8),
    maxEnergy,
    age: rng.int(0, 90),
    hunger: rng.float(4, 16),
    state: "wander",
    alive: true,
    vision: rng.float(42, 75),
    speed: rng.float(0.9, 1.35),
    reproductionCooldown: rng.int(0, 30),
    maxAge: rng.int(850, 1100),
    wanderAngle: rng.float(0, Math.PI * 2),
    energyTarget: maxEnergy * 0.75,
    energyResume: maxEnergy * 0.46,
    resting: false
  };

  state.insects.push(insect);
  return insect;
}

export function spawnFish(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): FishEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "lake") : { x, y };
  const maxEnergy = rng.float(48, 68);

  const fish: FishEntity = {
    id: nextId(state),
    species: "fish",
    x: pos.x,
    y: pos.y,
    vx: rng.float(-0.35, 0.35),
    vy: rng.float(-0.35, 0.35),
    energy: maxEnergy * rng.float(0.5, 0.8),
    maxEnergy,
    age: rng.int(0, 280),
    hunger: rng.float(4, 14),
    state: "wander",
    alive: true,
    vision: rng.float(64, 95),
    speed: rng.float(1.1, 1.55),
    reproductionCooldown: rng.int(40, 120),
    maxAge: rng.int(2200, 2900),
    wanderAngle: rng.float(0, Math.PI * 2),
    energyTarget: maxEnergy * 0.74,
    energyResume: maxEnergy * 0.45,
    resting: false
  };

  state.fish.push(fish);
  return fish;
}

export function spawnDuck(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): DuckEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "transition") : { x, y };
  const maxEnergy = rng.float(126, 170);

  const duck: DuckEntity = {
    id: nextId(state),
    species: "duck",
    x: pos.x,
    y: pos.y,
    vx: rng.float(-0.25, 0.25),
    vy: rng.float(-0.25, 0.25),
    energy: maxEnergy * rng.float(0.55, 0.85),
    maxEnergy,
    age: rng.int(0, 500),
    hunger: rng.float(3, 12),
    state: "wander",
    alive: true,
    vision: rng.float(86, 130),
    speed: rng.float(1.05, 1.45),
    reproductionCooldown: rng.int(80, 220),
    maxAge: rng.int(3400, 4300),
    wanderAngle: rng.float(0, Math.PI * 2),
    energyTarget: maxEnergy * 0.8,
    energyResume: maxEnergy * 0.52,
    resting: false
  };

  state.ducks.push(duck);
  return duck;
}

export function spawnLeopard(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng,
  x?: number,
  y?: number
): LeopardEntity {
  const pos = x === undefined || y === undefined ? randomPointInBiome(world, rng, "forest") : { x, y };
  const maxEnergy = rng.float(230, 300);

  const leopard: LeopardEntity = {
    id: nextId(state),
    species: "leopard",
    x: pos.x,
    y: pos.y,
    vx: rng.float(-0.2, 0.2),
    vy: rng.float(-0.2, 0.2),
    energy: maxEnergy * rng.float(0.6, 0.85),
    maxEnergy,
    age: rng.int(0, 650),
    hunger: rng.float(2, 10),
    state: "wander",
    alive: true,
    vision: rng.float(110, 170),
    speed: rng.float(1.25, 1.75),
    reproductionCooldown: rng.int(240, 500),
    maxAge: rng.int(5200, 6800),
    wanderAngle: rng.float(0, Math.PI * 2),
    energyTarget: maxEnergy * 0.82,
    energyResume: maxEnergy * 0.5,
    resting: false
  };

  state.leopards.push(leopard);
  return leopard;
}

export interface CarcassSpawnOptions {
  decomposeDelayTicks?: number;
  isLeftover?: boolean;
}

export function spawnCarcass(
  state: EcosystemState,
  sourceSpecies: LivingSpecies,
  x: number,
  y: number,
  biomass: number,
  aquatic: boolean,
  rng: SeededRng,
  options?: CarcassSpawnOptions
): CarcassEntity {
  const safeBiomass = Math.max(1, biomass);

  const carcass: CarcassEntity = {
    id: nextId(state),
    species: "carcass",
    sourceSpecies,
    x,
    y,
    vx: 0,
    vy: 0,
    energy: safeBiomass,
    maxEnergy: safeBiomass,
    age: 0,
    hunger: 0,
    state: "dead",
    alive: false,
    vision: 0,
    biomass: safeBiomass,
    maxBiomass: safeBiomass,
    decayRate: rng.float(0.16, 0.42),
    aquatic,
    decomposeDelayTicks: Math.max(0, Math.floor(options?.decomposeDelayTicks ?? 0)),
    isLeftover: options?.isLeftover ?? false
  };

  state.carcasses.push(carcass);
  return carcass;
}

export function createInitialState(
  world: WorldMap,
  rng: SeededRng,
  seed: number,
  counts: InitialCounts = DEFAULT_COUNTS
): EcosystemState {
  const state = createEmptyState(seed, world);

  for (let i = 0; i < counts.trees; i += 1) {
    spawnTree(state, world, rng);
  }

  for (let i = 0; i < counts.algae; i += 1) {
    spawnAlgae(state, world, rng);
  }

  for (let i = 0; i < counts.insects; i += 1) {
    if (state.trees.length > 0 && rng.chance(0.7)) {
      const anchorTree = state.trees[rng.int(0, state.trees.length - 1)];
      spawnInsect(
        state,
        world,
        rng,
        anchorTree.x + rng.float(-40, 40),
        anchorTree.y + rng.float(-40, 40)
      );
    } else {
      spawnInsect(state, world, rng);
    }
  }

  for (let i = 0; i < counts.fish; i += 1) {
    spawnFish(state, world, rng);
  }

  for (let i = 0; i < counts.ducks; i += 1) {
    spawnDuck(state, world, rng);
  }

  for (let i = 0; i < counts.leopards; i += 1) {
    spawnLeopard(state, world, rng);
  }

  for (const insect of state.insects) {
    const biome = biomeAt(world, insect.x);
    if (biome === "lake") {
      insect.x = world.forestEndX + rng.float(4, 16);
    }
  }

  return state;
}
