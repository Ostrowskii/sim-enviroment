import type { AnyEntity, EcosystemState } from "../entities/types";
import type { WorldMap } from "../world/map";
import { biomeAt } from "../world/map";

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: WorldMap
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available.");
    }

    this.ctx = ctx;
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.canvas.width = Math.max(320, Math.floor(width));
    this.canvas.height = Math.max(240, Math.floor(height));
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } | null {
    const { scale, offsetX, offsetY } = this.transform;
    if (scale <= 0) {
      return null;
    }

    const worldX = (screenX - offsetX) / scale;
    const worldY = (screenY - offsetY) / scale;

    const inside =
      worldX >= 0 && worldX <= this.world.width && worldY >= 0 && worldY <= this.world.height;

    return inside ? { x: worldX, y: worldY } : null;
  }

  render(
    state: Readonly<EcosystemState>,
    entities: readonly AnyEntity[],
    selectedEntity: AnyEntity | null,
    overlayEnabled: boolean
  ): void {
    this.updateTransform();

    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawBackdrop();

    for (const entity of entities) {
      if (entity.species !== "carcass" && !entity.alive) {
        continue;
      }

      this.drawEntity(entity);
    }

    if (overlayEnabled && selectedEntity) {
      this.drawSelectionOverlay(selectedEntity);
    }

    this.drawHud(state);
  }

  private updateTransform(): void {
    const scale = Math.min(
      this.canvas.width / this.world.width,
      this.canvas.height / this.world.height
    );

    const offsetX = (this.canvas.width - this.world.width * scale) / 2;
    const offsetY = (this.canvas.height - this.world.height * scale) / 2;

    this.transform = { scale, offsetX, offsetY };
  }

  private drawBackdrop(): void {
    const { ctx } = this;
    const { scale, offsetX, offsetY } = this.transform;

    const worldW = this.world.width * scale;
    const worldH = this.world.height * scale;

    ctx.fillStyle = "#122017";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Forest
    ctx.fillStyle = "#2b4f32";
    ctx.fillRect(0, 0, this.world.forestEndX, this.world.height);

    // Transition gradient
    const transitionGradient = ctx.createLinearGradient(
      this.world.forestEndX,
      0,
      this.world.transitionEndX,
      0
    );
    transitionGradient.addColorStop(0, "#4c7448");
    transitionGradient.addColorStop(1, "#5a8b86");
    ctx.fillStyle = transitionGradient;
    ctx.fillRect(
      this.world.forestEndX,
      0,
      this.world.transitionEndX - this.world.forestEndX,
      this.world.height
    );

    // Lake
    ctx.fillStyle = "#2d6f94";
    ctx.fillRect(
      this.world.transitionEndX,
      0,
      this.world.width - this.world.transitionEndX,
      this.world.height
    );

    // Shoreline accent
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(this.world.transitionEndX, 0);
    ctx.lineTo(this.world.transitionEndX, this.world.height);
    ctx.stroke();

    // Subtle map texture
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    for (let y = 16; y < this.world.height; y += 24) {
      for (let x = 16; x < this.world.width; x += 24) {
        const size = (Math.sin(x * 0.07 + y * 0.05) + 1.2) * 1.4;
        ctx.fillRect(x, y, size, size);
      }
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, worldW, worldH);
  }

  private drawEntity(entity: AnyEntity): void {
    const { ctx } = this;
    const p = this.worldToScreen(entity.x, entity.y);

    switch (entity.species) {
      case "tree": {
        const canopyRadius = (8 + (entity.food / entity.maxFood) * 7) * this.transform.scale;
        ctx.fillStyle = "#5a3b24";
        ctx.fillRect(p.x - 2, p.y + 4, 4, 8);
        ctx.fillStyle = "#2fb04f";
        ctx.beginPath();
        ctx.arc(p.x, p.y, canopyRadius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "algae": {
        const r = (2.5 + (entity.biomass / entity.maxBiomass) * 3.2) * this.transform.scale;
        ctx.fillStyle = "#3ed36d";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "insect": {
        const r = 2.2 * this.transform.scale;
        ctx.fillStyle = "#1b1b1b";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        this.drawFacingLine(entity, "#f9f0a0", 6);
        break;
      }
      case "fish": {
        this.drawOrientedEllipse(entity, 8, 4.5, "#4ac3ff", "#d5f0ff");
        break;
      }
      case "duck": {
        this.drawOrientedEllipse(entity, 9, 6, "#f5f5ee", "#efcc52");
        break;
      }
      case "leopard": {
        this.drawOrientedEllipse(entity, 10, 6.5, "#d59045", "#2a1a0a");
        break;
      }
      case "carcass": {
        const r = (4 + Math.min(1, entity.biomass / entity.maxBiomass) * 8) * this.transform.scale;
        ctx.fillStyle = "#6e2c21";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }

  private drawOrientedEllipse(
    entity: AnyEntity,
    width: number,
    height: number,
    bodyColor: string,
    accentColor: string
  ): void {
    const { ctx } = this;
    const p = this.worldToScreen(entity.x, entity.y);
    const angle = Math.atan2(entity.vy, entity.vx);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Number.isFinite(angle) ? angle : 0);

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      width * this.transform.scale,
      height * this.transform.scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(width * this.transform.scale * 0.5, 0, 2.2 * this.transform.scale, 0, Math.PI * 2);
    ctx.fill();

    if (entity.species === "leopard") {
      ctx.fillStyle = "#26180b";
      ctx.beginPath();
      ctx.arc(-2 * this.transform.scale, -1.5 * this.transform.scale, 1.3 * this.transform.scale, 0, Math.PI * 2);
      ctx.arc(1.5 * this.transform.scale, 1.5 * this.transform.scale, 1.2 * this.transform.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFacingLine(entity: AnyEntity, color: string, length: number): void {
    const { ctx } = this;
    const p = this.worldToScreen(entity.x, entity.y);
    const angle = Math.atan2(entity.vy, entity.vx);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
      p.x + Math.cos(angle) * length * this.transform.scale,
      p.y + Math.sin(angle) * length * this.transform.scale
    );
    ctx.stroke();
  }

  private drawSelectionOverlay(entity: AnyEntity): void {
    const { ctx } = this;
    const p = this.worldToScreen(entity.x, entity.y);

    const radius = Math.max(8, entity.vision) * this.transform.scale;
    ctx.strokeStyle = "rgba(255, 246, 170, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(15, 15, 15, 0.75)";
    ctx.fillRect(p.x - 44, p.y - 30, 88, 18);
    ctx.fillStyle = "#f8f0ae";
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entity.state, p.x, p.y - 17);
    ctx.textAlign = "left";
  }

  private drawHud(state: Readonly<EcosystemState>): void {
    const { ctx } = this;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(12, 12, 230, 52);

    ctx.fillStyle = "#d2f4d9";
    ctx.font = "13px Trebuchet MS, sans-serif";
    ctx.fillText(`Tick: ${state.tick}`, 24, 34);

    const biomeLabel = biomeAt(this.world, this.world.width * 0.2);
    ctx.fillText(`Observer Mode (${biomeLabel} side)`, 24, 54);
  }

  private worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.transform.offsetX + x * this.transform.scale,
      y: this.transform.offsetY + y * this.transform.scale
    };
  }
}
