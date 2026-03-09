export type Biome = "forest" | "transition" | "lake";

export type Species =
  | "tree"
  | "algae"
  | "insect"
  | "fish"
  | "duck"
  | "leopard"
  | "carcass";

export type LivingSpecies = Exclude<Species, "carcass">;

export type BehaviorState =
  | "idle"
  | "wander"
  | "seek_food"
  | "eat"
  | "rest"
  | "flee"
  | "hunt"
  | "dead";

export interface EntityBase {
  id: number;
  species: Species;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  maxEnergy: number;
  age: number;
  hunger: number;
  state: BehaviorState;
  alive: boolean;
  vision: number;
}

export interface TreeEntity extends EntityBase {
  species: "tree";
  food: number;
  maxFood: number;
  nutrientDemand: number;
  spreadCooldown: number;
}

export interface AlgaeEntity extends EntityBase {
  species: "algae";
  biomass: number;
  maxBiomass: number;
  spreadCooldown: number;
}

export interface AnimalEntity extends EntityBase {
  species: "insect" | "fish" | "duck" | "leopard";
  speed: number;
  reproductionCooldown: number;
  maxAge: number;
  wanderAngle: number;
  energyTarget: number;
  energyResume: number;
  resting: boolean;
}

export interface InsectEntity extends AnimalEntity {
  species: "insect";
}

export interface FishEntity extends AnimalEntity {
  species: "fish";
}

export interface DuckEntity extends AnimalEntity {
  species: "duck";
}

export interface LeopardEntity extends AnimalEntity {
  species: "leopard";
}

export interface CarcassEntity extends EntityBase {
  species: "carcass";
  sourceSpecies: LivingSpecies;
  biomass: number;
  maxBiomass: number;
  decayRate: number;
  aquatic: boolean;
  decomposeDelayTicks: number;
  isLeftover: boolean;
}

export interface NutrientGrid {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  maxPerCell: number;
  soil: number[];
  water: number[];
  soilMask: boolean[];
  waterMask: boolean[];
}

export type AnyAnimal = InsectEntity | FishEntity | DuckEntity | LeopardEntity;

export type AnyEntity =
  | TreeEntity
  | AlgaeEntity
  | InsectEntity
  | FishEntity
  | DuckEntity
  | LeopardEntity
  | CarcassEntity;

export interface EcosystemState {
  tick: number;
  seed: number;
  nextEntityId: number;
  totalDeaths: number;
  nutrientGrid: NutrientGrid;
  soilNutrients: number;
  waterNutrients: number;
  trees: TreeEntity[];
  algae: AlgaeEntity[];
  insects: InsectEntity[];
  fish: FishEntity[];
  ducks: DuckEntity[];
  leopards: LeopardEntity[];
  carcasses: CarcassEntity[];
}

export interface SpeciesMetrics {
  count: number;
  averageEnergy: number;
}

export interface SimulationMetrics {
  tick: number;
  totalDeaths: number;
  soilNutrients: number;
  waterNutrients: number;
  species: Record<Species, SpeciesMetrics>;
}
