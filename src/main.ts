import "./style.css";
import { FixedTickLoop } from "./game/loop";
import { Renderer } from "./render/renderer";
import { EcosystemSimulation } from "./sim/simulation";
import { DebugPanel } from "./ui/panel";

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 620;
const BASE_TICK_RATE = 10;
const DEFAULT_SEED = 1337;

const canvas = document.getElementById("world-canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Canvas #world-canvas was not found.");
}

let simulation = new EcosystemSimulation({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  tickRate: BASE_TICK_RATE,
  seed: DEFAULT_SEED
});

const renderer = new Renderer(canvas, simulation.world);

let paused = false;
let speed = 1;
let overlayEnabled = false;
let selectedEntityId: number | null = null;

const panel = new DebugPanel(
  {
    onPauseToggle: () => {
      paused = !paused;
    },
    onRestart: (seed) => {
      simulation.restart(seed);
      selectedEntityId = null;
      paused = false;
    },
    onSpeedChange: (nextSpeed) => {
      speed = nextSpeed;
    },
    onOverlayChange: (enabled) => {
      overlayEnabled = enabled;
    }
  },
  DEFAULT_SEED
);
panel.setOverlayEnabled(false);

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (event.clientY - rect.top) * (canvas.height / rect.height);

  const worldPoint = renderer.screenToWorld(sx, sy);
  if (!worldPoint) {
    selectedEntityId = null;
    return;
  }

  const closest = simulation.findClosestEntity(worldPoint.x, worldPoint.y, 20);
  selectedEntityId = closest ? closest.id : null;
});

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});
renderer.resize(window.innerWidth, window.innerHeight);

const loop = new FixedTickLoop(BASE_TICK_RATE, {
  updateTick: () => {
    simulation.step();
  },
  renderFrame: () => {
    let selectedEntity = selectedEntityId !== null ? simulation.findEntityById(selectedEntityId) : null;

    if (!selectedEntity && selectedEntityId !== null) {
      selectedEntityId = null;
      selectedEntity = null;
    }

    const entities = simulation.getAllEntities();

    renderer.render(simulation.state, entities, selectedEntity, overlayEnabled);
    panel.update(simulation.getMetrics(), speed, paused, selectedEntity);
  },
  isPaused: () => paused,
  getSpeed: () => speed
});

loop.start();
