# Ecosystem Observer Prototype

Single-player 2D ecosystem simulation built with **TypeScript + HTML5 Canvas + Vite**.
The player starts as observer-only: no intervention, just watch the ecosystem evolve.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open the local URL shown by Vite.

## GitHub Pages

- This repo includes a workflow at `.github/workflows/deploy-pages.yml`.
- Every push to `main` builds the app and deploys `dist` to GitHub Pages.
- For this repository, `vite.config.ts` uses `base: "/sim-enviroment/"`.

## Simulation Rules (MVP)

- World biomes:
  - Forest on the left
  - Lake on the right
  - Soft transition zone in the middle
- Tick-based simulation (default `10 ticks/s`) with deterministic seeded RNG.
- Resource loop:
  - Trees consume soil nutrients and produce edible biomass.
  - Algae consume water nutrients and regrow biomass.
  - Insects eat trees.
  - Fish eat algae and insects in water.
  - Ducks prioritize fish, then insects, then algae.
  - Leopards hunt ducks on land.
  - Dead animals become carcasses.
  - Carcasses decompose and return nutrients to soil/water.
- Population dynamics include hunger, energy, age, reproduction, starvation, predation, and old-age death.

## Controls

- Pause / Resume
- Speed: `1x`, `2x`, `5x`
- Restart simulation
- Seed input (restart with same seed for similar outcomes)
- Optional debug overlay:
  - Selected entity vision radius
  - Selected entity state label
  - Entity info panel on click

## Project Structure (summary)

- `src/main.ts`: app wiring (simulation + renderer + UI + input)
- `src/game/`: fixed tick loop
- `src/render/`: canvas rendering
- `src/world/`: biome map and bounds helpers
- `src/entities/`: shared types and entity creation
- `src/species/`: species behavior and decomposition updates
- `src/sim/`: resources, query helpers, mortality, reproduction, simulation orchestrator
- `src/ui/`: debug/control panel logic
- `src/utils/`: RNG and math utilities

## Notes

- `vibinet` dependency is intentionally kept installed for future online work, but not used in this single-player prototype.
