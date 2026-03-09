import {
  spawnAlgae,
  spawnDuck,
  spawnFish,
  spawnInsect,
  spawnLeopard,
  spawnTree
} from "../entities/factory";
import type { AnyAnimal, EcosystemState, TreeEntity } from "../entities/types";
import type { SeededRng } from "../utils/rng";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";
import { hasNearby } from "./query";
import {
  consumeSoilNutrientsAt,
  consumeWaterNutrientsAt,
  sunlightAtTick
} from "./resources";

const CAP_TREE = 42;
const CAP_ALGAE = 130;
const CAP_INSECT = 190;
const CAP_FISH = 90;
const CAP_DUCK = 18;
const CAP_LEOPARD = 8;

function nearbyPosition(
  parent: { x: number; y: number },
  rng: SeededRng,
  minRadius: number,
  maxRadius: number
): { x: number; y: number } {
  const angle = rng.float(0, Math.PI * 2);
  const radius = rng.float(minRadius, maxRadius);

  return {
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + Math.sin(angle) * radius
  };
}

function canTreeSpread(state: EcosystemState, tree: TreeEntity): boolean {
  return (
    tree.alive &&
    tree.spreadCooldown === 0 &&
    tree.food > tree.maxFood * 0.88 &&
    state.soilNutrients > 50
  );
}

function reproduceTrees(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.trees.length >= CAP_TREE) {
    return;
  }

  const parents = state.trees.slice();
  for (const tree of parents) {
    if (state.trees.length >= CAP_TREE) {
      return;
    }

    if (!canTreeSpread(state, tree) || !rng.chance(0.012)) {
      continue;
    }

    const candidate = nearbyPosition(tree, rng, 24, 78);
    const candidateBiome = biomeAt(world, candidate.x);
    if (candidateBiome === "lake") {
      continue;
    }

    if (candidate.x < 5 || candidate.x > world.width - 5 || candidate.y < 5 || candidate.y > world.height - 5) {
      continue;
    }

    if (hasNearby(candidate, state.trees, 18, (other) => other.alive)) {
      continue;
    }

    spawnTree(state, world, rng, candidate.x, candidate.y);
    consumeSoilNutrientsAt(state, candidate.x, candidate.y, 28);
    tree.food *= 0.82;
    tree.spreadCooldown = rng.int(260, 520);
  }
}

function reproduceAlgae(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.algae.length >= CAP_ALGAE) {
    return;
  }

  const sunlight = sunlightAtTick(state.tick);
  if (sunlight <= 0.08) {
    return;
  }

  const parents = state.algae.slice();
  for (const algae of parents) {
    if (state.algae.length >= CAP_ALGAE) {
      return;
    }

    if (!algae.alive || algae.spreadCooldown > 0 || algae.biomass < algae.maxBiomass * 0.86) {
      continue;
    }

    const solarSpawnChance = 0.007 + sunlight * 0.05;
    if (state.waterNutrients < 20 || !rng.chance(solarSpawnChance)) {
      continue;
    }

    const candidate = nearbyPosition(algae, rng, 10, 34);
    if (biomeAt(world, candidate.x) !== "lake") {
      continue;
    }

    if (candidate.y < 8 || candidate.y > world.height - 8) {
      continue;
    }

    if (hasNearby(candidate, state.algae, 10, (other) => other.alive)) {
      continue;
    }

    spawnAlgae(state, world, rng, candidate.x, candidate.y);
    consumeWaterNutrientsAt(state, candidate.x, candidate.y, 14);
    algae.biomass *= 0.8;
    algae.spreadCooldown = rng.int(80, 180);
  }
}

function resetNewbornAnimal(newborn: AnyAnimal): void {
  newborn.age = 0;
  newborn.hunger = 0;
  newborn.vx = 0;
  newborn.vy = 0;
  newborn.state = "idle";
  newborn.resting = false;
}

function reproduceInsects(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.insects.length >= CAP_INSECT) {
    return;
  }

  const parents = state.insects.slice();
  for (const insect of parents) {
    if (state.insects.length >= CAP_INSECT) {
      return;
    }

    if (!insect.alive || insect.reproductionCooldown > 0 || insect.age < 60 || insect.energy < 20) {
      continue;
    }

    if (!rng.chance(0.03)) {
      continue;
    }

    const childPos = nearbyPosition(insect, rng, 4, 14);
    const child = spawnInsect(state, world, rng, childPos.x, childPos.y);
    resetNewbornAnimal(child);
    child.energy = child.maxEnergy * 0.55;

    insect.energy -= 6.8;
    insect.hunger += 6;
    insect.reproductionCooldown = rng.int(60, 100);
  }
}

function reproduceFish(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.fish.length >= CAP_FISH) {
    return;
  }

  const parents = state.fish.slice();
  for (const fish of parents) {
    if (state.fish.length >= CAP_FISH) {
      return;
    }

    if (!fish.alive || fish.reproductionCooldown > 0 || fish.age < 140 || fish.energy < 28) {
      continue;
    }

    if (!rng.chance(0.03)) {
      continue;
    }

    const childPos = nearbyPosition(fish, rng, 6, 20);
    if (biomeAt(world, childPos.x) !== "lake") {
      continue;
    }

    const child = spawnFish(state, world, rng, childPos.x, childPos.y);
    resetNewbornAnimal(child);
    child.energy = child.maxEnergy * 0.5;

    fish.energy -= 11;
    fish.hunger += 6;
    fish.reproductionCooldown = rng.int(110, 190);
  }
}

function reproduceDucks(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.ducks.length >= CAP_DUCK) {
    return;
  }

  const parents = state.ducks.slice();
  for (const duck of parents) {
    if (state.ducks.length >= CAP_DUCK) {
      return;
    }

    if (
      !duck.alive ||
      duck.reproductionCooldown > 0 ||
      duck.age < 130 ||
      duck.energy < duck.maxEnergy * 0.62
    ) {
      continue;
    }

    if (!rng.chance(0.018)) {
      continue;
    }

    const childPos = nearbyPosition(duck, rng, 8, 24);
    const child = spawnDuck(state, world, rng, childPos.x, childPos.y);
    resetNewbornAnimal(child);
    child.energy = child.maxEnergy * 0.48;

    duck.energy -= duck.maxEnergy * 0.1;
    duck.hunger += 4;
    duck.reproductionCooldown = rng.int(180, 320);
  }
}

function reproduceLeopards(state: EcosystemState, world: WorldMap, rng: SeededRng): void {
  if (state.leopards.length >= CAP_LEOPARD) {
    return;
  }

  const parents = state.leopards.slice();
  for (const leopard of parents) {
    if (state.leopards.length >= CAP_LEOPARD) {
      return;
    }

    if (
      !leopard.alive ||
      leopard.reproductionCooldown > 0 ||
      leopard.age < 620 ||
      leopard.energy < leopard.maxEnergy * 0.66
    ) {
      continue;
    }

    if (!rng.chance(0.0045)) {
      continue;
    }

    const childPos = nearbyPosition(leopard, rng, 12, 36);
    if (biomeAt(world, childPos.x) === "lake") {
      continue;
    }

    const child = spawnLeopard(state, world, rng, childPos.x, childPos.y);
    resetNewbornAnimal(child);
    child.energy = child.maxEnergy * 0.45;

    leopard.energy -= leopard.maxEnergy * 0.1;
    leopard.hunger += 6;
    leopard.reproductionCooldown = rng.int(650, 980);
  }
}

export function runReproductionCycle(
  state: EcosystemState,
  world: WorldMap,
  rng: SeededRng
): void {
  reproduceTrees(state, world, rng);
  reproduceAlgae(state, world, rng);
  reproduceInsects(state, world, rng);
  reproduceFish(state, world, rng);
  reproduceDucks(state, world, rng);
  reproduceLeopards(state, world, rng);
}
