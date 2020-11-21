import { map } from "./map/mapboxConfig";

/**
 * This class is used to control performance measuring (fps) for the mapbox map.
 */
export class PerformanceMeasurer {
  private frames = 0;
  private totalTime = 0;
  private totalFrames = 0;
  private time: number | null = null;

  startMeasuring(): void {
    map.on("movestart", this.onMoveStart.bind(this));
    map.on("moveend", this.onMoveEnd.bind(this));
  }

  onMoveStart = (): void => {
    this.frames = 0;
    this.time = performance.now();
    map.on("render", this.onRender);
  };

  onMoveEnd = (): void => {
    const now = performance.now();
    const fps = this.getFPS(now);
    const fpsAvg = Math.round((1e3 * this.totalFrames) / this.totalTime) || 0;

    console.log(`FPS onMoveEnd: ${fps}\nFPS Average: ${fpsAvg}`);

    this.frames = 0;
    this.time = null;
    map.off("render", this.onRender);
  };

  onRender = (): void => {
    this.frames++;
    const now = performance.now();
    //@ts-expect-error
    if (now >= this.time + 1e3) {
      const fps = this.getFPS(now);
      const fpsAvg = Math.round((1e3 * this.totalFrames) / this.totalTime) || 0;

      console.log(`FPS onRender: ${fps}\nFPS Average: ${fpsAvg}`);

      this.frames = 0;
      this.time = now;
    }
  };

  getFPS = (now: number): number => {
    //@ts-expect-error
    this.totalTime += now - this.time;
    this.totalFrames += this.frames;
    //@ts-expect-error
    return Math.round((1e3 * this.frames) / (now - this.time)) || 0;
  };
}
