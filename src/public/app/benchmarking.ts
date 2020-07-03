//import { performance } from "perf_hooks";

/**
 * Singleton-Class for measuring execution time.
 */
class Benchmark {
  private static instance: Benchmark;

  private timeStamps: Map<string, number>;
  private accuracy: number;

  // the constructor has to be explicitly marked as private
  private constructor() {
    this.timeStamps = new Map();
    this.accuracy = 3;
  }

  static getInstance(): Benchmark {
    if (!Benchmark.instance) {
      Benchmark.instance = new Benchmark();
    }

    return Benchmark.instance;
  }

  public startMeasure(actionName: string): void {
    console.time(actionName);
    /*
    const t0 = performance.now();
    this.timeStamps.set(actionName, t0);
    */
  }

  public stopMeasure(actionName: string): string | void {
    /*
    // check if this actionName exists
    if (!this.timeStamps.has(actionName)) {
      throw new Error("startMeasure() has to be called first!");
    }

    // calculate the difference between the start timestamp for the given action and the current timestamp
    const start = this.timeStamps.get(actionName) as number;
    const now = performance.now();
    const timeTaken = `${actionName} took ${(now - start).toFixed(this.accuracy)} milliseconds.`;

    // remove the this action from the timestamps map
    //this.timeStamps.delete(actionName);

    return timeTaken;
    */
    console.timeEnd(actionName);
    return "";
  }
}

export default Benchmark.getInstance();
