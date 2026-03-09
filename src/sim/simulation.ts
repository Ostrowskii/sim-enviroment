import { createInitialState } from "../entities/factory";
import type {
  AnyEntity,
  EcosystemState,
  SimulationMetrics,
  Species
} from "../entities/types";
import { distanceSquared } from "../utils/math";
import { SeededRng } from "../utils/rng";
import { updateDecomposition } from "../species/decomposition";
import { updateDucks } from "../species/ducks";
import { updateFish } from "../species/fish";
import { updateInsects } from "../species/insects";
import { updateLeopards } from "../species/leopards";
import { createWorldMap, type WorldMap } from "../world/map";
import { runReproductionCycle } from "./reproduction";
import { updatePrimaryProducers } from "./resources";

export interface SimulationOptions {
  width: number;
  height: number;
  tickRate: number;
  seed: number;
}

const SPECIES_ORDER: Species[] = [
  "tree",
  "algae",
  "insect",
  "fish",
  "duck",
  "leopard",
  "carcass"
];

export class EcosystemSimulation {
  readonly tickRate: number;
  readonly world: WorldMap;

  private rng: SeededRng;
  private _state: EcosystemState;

  constructor(options: SimulationOptions) {
    this.tickRate = options.tickRate;
    this.world = createWorldMap(options.width, options.height);
    this.rng = new SeededRng(options.seed);
    this._state = createInitialState(this.world, this.rng, options.seed);
  }

  get state(): Readonly<EcosystemState> {
    return this._state;
  }

  step(): void {
    this._state.tick += 1;

    updatePrimaryProducers(this._state);
    updateInsects(this._state, this.world, this.rng);
    updateFish(this._state, this.world, this.rng);
    updateDucks(this._state, this.world, this.rng);
    updateLeopards(this._state, this.world, this.rng);
    updateDecomposition(this._state, this.world);
    runReproductionCycle(this._state, this.world, this.rng);

    this.cleanupDeadAnimals();
  }

  restart(seed: number): void {
    const safeSeed = Math.floor(Math.abs(seed)) || 1;
    this.rng = new SeededRng(safeSeed);
    this._state = createInitialState(this.world, this.rng, safeSeed);
  }

  getAllEntities(): AnyEntity[] {
    return [
      ...this._state.trees,
      ...this._state.algae,
      ...this._state.insects,
      ...this._state.fish,
      ...this._state.ducks,
      ...this._state.leopards,
      ...this._state.carcasses
    ];
  }

  findClosestEntity(x: number, y: number, radius: number): AnyEntity | null {
    const entities = this.getAllEntities();
    const maxDistSq = radius * radius;

    let closest: AnyEntity | null = null;
    let closestDist = maxDistSq;

    for (const entity of entities) {
      if (!entity.alive && entity.species !== "carcass") {
        continue;
      }

      const d2 = distanceSquared({ x, y }, entity);
      if (d2 <= closestDist) {
        closestDist = d2;
        closest = entity;
      }
    }

    return closest;
  }

  findEntityById(id: number): AnyEntity | null {
    for (const entity of this.getAllEntities()) {
      if (entity.id === id) {
        return entity;
      }
    }

    return null;
  }

  getMetrics(): SimulationMetrics {
    const speciesData: SimulationMetrics["species"] = {
      tree: { count: this._state.trees.length, averageEnergy: averageEnergy(this._state.trees) },
      algae: { count: this._state.algae.length, averageEnergy: averageEnergy(this._state.algae) },
      insect: { count: this._state.insects.length, averageEnergy: averageEnergy(this._state.insects) },
      fish: { count: this._state.fish.length, averageEnergy: averageEnergy(this._state.fish) },
      duck: { count: this._state.ducks.length, averageEnergy: averageEnergy(this._state.ducks) },
      leopard: {
        count: this._state.leopards.length,
        averageEnergy: averageEnergy(this._state.leopards)
      },
      carcass: {
        count: this._state.carcasses.length,
        averageEnergy: averageEnergy(this._state.carcasses)
      }
    };

    return {
      tick: this._state.tick,
      totalDeaths: this._state.totalDeaths,
      soilNutrients: this._state.soilNutrients,
      waterNutrients: this._state.waterNutrients,
      species: speciesData
    };
  }

  speciesOrder(): Species[] {
    return SPECIES_ORDER;
  }

  private cleanupDeadAnimals(): void {
    this._state.insects = this._state.insects.filter((entity) => entity.alive);
    this._state.fish = this._state.fish.filter((entity) => entity.alive);
    this._state.ducks = this._state.ducks.filter((entity) => entity.alive);
    this._state.leopards = this._state.leopards.filter((entity) => entity.alive);
    this._state.trees = this._state.trees.filter((entity) => entity.alive);
    this._state.algae = this._state.algae.filter((entity) => entity.alive);
  }
}

function averageEnergy<T extends { energy: number }>(items: readonly T[]): number {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, entity) => sum + entity.energy, 0);
  return total / items.length;
}
