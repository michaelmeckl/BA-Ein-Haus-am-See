//import { performance } from "perf_hooks";

//TODO using performance.now() might be a little bit more accurate, but it works a little bit different on the
// node server than on the client, which might make measurements inaccurate?? -> Test more with this!

const NUMBER_OF_EXECUTIONS = 50;
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

  public stopMeasure(actionName: string): number {
    /*
    // check if this actionName exists
    if (!this.timeStamps.has(actionName)) {
      throw new Error("startMeasure() has to be called first!");
    }

    // calculate the difference between the start timestamp for the given action and the current timestamp
    const start = this.timeStamps.get(actionName) as number;
    const now = performance.now();
    const timeTaken = (now - start).toFixed(this.accuracy);
    console.log(`${actionName} took ${timeTaken} milliseconds.`;);

    // remove the this action from the timestamps map
    //this.timeStamps.delete(actionName);

    return timeTaken;
    */
    console.timeEnd(actionName);
    return 0;
  }

  //TODO performance.now() only when the others use it too!
  // but performance.now() is necessary as console.time() doesn't return its value
  public async getAverageTime(
    fn: (...args: any[]) => any,
    args: any[],
    n = NUMBER_OF_EXECUTIONS
  ): Promise<number> {
    const times: number[] = [];

    for (let index = 0; index < n; index++) {
      const start = performance.now();
      await fn(...args);
      const taken = performance.now() - start;
      console.log(taken + " ms");
      times.push(taken);
    }

    const average = times.reduce((prev, curr) => prev + curr, 0) / times.length;
    console.log(`Average time taken over ${n} executions: ${average} milliseconds`);
    return average;
  }
}

export default Benchmark.getInstance();
