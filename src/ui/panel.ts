import type { AnyEntity, SimulationMetrics, Species } from "../entities/types";

export interface PanelCallbacks {
  onPauseToggle: () => void;
  onRestart: (seed: number) => void;
  onSpeedChange: (speed: number) => void;
  onOverlayChange: (enabled: boolean) => void;
}

const SPECIES_LABELS: Record<Species, string> = {
  tree: "Arvores",
  algae: "Algas",
  insect: "Insetos",
  fish: "Peixes",
  duck: "Patos",
  leopard: "Leopardos",
  carcass: "Carcacas"
};

export class DebugPanel {
  private readonly pauseButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly seedInput: HTMLInputElement;
  private readonly overlayToggle: HTMLInputElement;
  private readonly speedButtons: HTMLButtonElement[];
  private readonly tickValue: HTMLElement;
  private readonly speedValue: HTMLElement;
  private readonly deathsValue: HTMLElement;
  private readonly soilValue: HTMLElement;
  private readonly waterValue: HTMLElement;
  private readonly speciesBody: HTMLElement;
  private readonly selectedEntity: HTMLElement;

  constructor(callbacks: PanelCallbacks, initialSeed: number) {
    this.pauseButton = this.requireElement<HTMLButtonElement>("pause-btn");
    this.restartButton = this.requireElement<HTMLButtonElement>("restart-btn");
    this.seedInput = this.requireElement<HTMLInputElement>("seed-input");
    this.overlayToggle = this.requireElement<HTMLInputElement>("overlay-toggle");
    this.tickValue = this.requireElement<HTMLElement>("tick-value");
    this.speedValue = this.requireElement<HTMLElement>("speed-value");
    this.deathsValue = this.requireElement<HTMLElement>("deaths-value");
    this.soilValue = this.requireElement<HTMLElement>("soil-value");
    this.waterValue = this.requireElement<HTMLElement>("water-value");
    this.speciesBody = this.requireElement<HTMLElement>("species-table-body");
    this.selectedEntity = this.requireElement<HTMLElement>("selected-entity");
    this.speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".speed-btn"));

    this.seedInput.value = String(initialSeed);

    this.pauseButton.addEventListener("click", () => {
      callbacks.onPauseToggle();
    });

    this.restartButton.addEventListener("click", () => {
      const parsed = Number.parseInt(this.seedInput.value, 10);
      const seed = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      this.seedInput.value = String(seed);
      callbacks.onRestart(seed);
    });

    this.speedButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const speedRaw = Number.parseInt(button.dataset.speed ?? "1", 10);
        const speed = speedRaw === 2 || speedRaw === 5 ? speedRaw : 1;
        callbacks.onSpeedChange(speed);
      });
    });

    this.overlayToggle.addEventListener("change", () => {
      callbacks.onOverlayChange(this.overlayToggle.checked);
    });
  }

  update(
    metrics: SimulationMetrics,
    speed: number,
    paused: boolean,
    selected: AnyEntity | null
  ): void {
    this.tickValue.textContent = metrics.tick.toString();
    this.speedValue.textContent = `${speed}x`;
    this.deathsValue.textContent = metrics.totalDeaths.toString();
    this.soilValue.textContent = metrics.soilNutrients.toFixed(1);
    this.waterValue.textContent = metrics.waterNutrients.toFixed(1);
    this.pauseButton.textContent = paused ? "Continuar" : "Pausar";

    this.setActiveSpeed(speed);
    this.renderSpeciesRows(metrics);
    this.renderSelected(selected);
  }

  setOverlayEnabled(enabled: boolean): void {
    this.overlayToggle.checked = enabled;
  }

  private renderSpeciesRows(metrics: SimulationMetrics): void {
    const speciesOrder: Species[] = [
      "tree",
      "algae",
      "insect",
      "fish",
      "duck",
      "leopard",
      "carcass"
    ];

    const rows = speciesOrder
      .map((species) => {
        const item = metrics.species[species];
        return `<tr><td>${SPECIES_LABELS[species]}</td><td>${item.count}</td><td>${item.averageEnergy.toFixed(1)}</td></tr>`;
      })
      .join("");

    this.speciesBody.innerHTML = rows;
  }

  private renderSelected(entity: AnyEntity | null): void {
    if (!entity) {
      this.selectedEntity.textContent = "Clique em uma entidade no mapa.";
      return;
    }

    const animalLines =
      "energyTarget" in entity
        ? [
            `objetivo energia: ${entity.energyTarget.toFixed(1)}`,
            `retoma busca: ${entity.energyResume.toFixed(1)}`,
            `hibernando: ${entity.resting}`
          ]
        : [];

    const carcassLines =
      entity.species === "carcass"
        ? [
            `biomassa: ${entity.biomass.toFixed(1)} / ${entity.maxBiomass.toFixed(1)}`,
            `resto de comida: ${entity.isLeftover}`,
            `inicio decomposicao: tick +${entity.decomposeDelayTicks}`
          ]
        : [];

    this.selectedEntity.textContent = [
      `id: ${entity.id}`,
      `especie: ${entity.species}`,
      `estado: ${entity.state}`,
      `vivo: ${entity.alive}`,
      `energia: ${entity.energy.toFixed(1)} / ${entity.maxEnergy.toFixed(1)}`,
      `idade: ${entity.age}`,
      `fome: ${entity.hunger.toFixed(1)}`,
      `posicao: (${entity.x.toFixed(1)}, ${entity.y.toFixed(1)})`,
      `velocidade: (${entity.vx.toFixed(2)}, ${entity.vy.toFixed(2)})`,
      ...animalLines,
      ...carcassLines
    ].join("\n");
  }

  private setActiveSpeed(speed: number): void {
    this.speedButtons.forEach((button) => {
      const buttonSpeed = Number.parseInt(button.dataset.speed ?? "1", 10);
      const isActive = buttonSpeed === speed;
      button.classList.toggle("active", isActive);
    });
  }

  private requireElement<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error(`Missing UI element: #${id}`);
    }

    return node as T;
  }
}
