export interface LoopHooks {
  updateTick: () => void;
  renderFrame: () => void;
  isPaused: () => boolean;
  getSpeed: () => number;
}

export class FixedTickLoop {
  private frameHandle: number | null = null;
  private lastTimestamp = 0;
  private accumulator = 0;

  private readonly tickMs: number;

  constructor(
    tickRate: number,
    private readonly hooks: LoopHooks
  ) {
    this.tickMs = 1000 / tickRate;
  }

  start(): void {
    if (this.frameHandle !== null) {
      return;
    }

    this.lastTimestamp = performance.now();
    const run = (timestamp: number): void => {
      const delta = Math.min(250, timestamp - this.lastTimestamp);
      this.lastTimestamp = timestamp;

      if (!this.hooks.isPaused()) {
        this.accumulator += delta * this.hooks.getSpeed();

        let safety = 0;
        while (this.accumulator >= this.tickMs && safety < 35) {
          this.hooks.updateTick();
          this.accumulator -= this.tickMs;
          safety += 1;
        }
      }

      this.hooks.renderFrame();
      this.frameHandle = window.requestAnimationFrame(run);
    };

    this.frameHandle = window.requestAnimationFrame(run);
  }

  stop(): void {
    if (this.frameHandle === null) {
      return;
    }

    window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
  }
}
