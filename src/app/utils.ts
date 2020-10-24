import Benchmark from "../shared/benchmarking";

const SNACKBAR_DEFAULT_DURATION = 3000; // 3 seconds

export const enum SnackbarType {
  SUCCESS = "#14bd5a",
  ERROR = "#b61919",
  INFO = "cornflowerblue",
  DEFAULT = "darkviolet",
}

export function showSnackbar(
  message: string,
  type: SnackbarType = SnackbarType.DEFAULT,
  duration = SNACKBAR_DEFAULT_DURATION
): void {
  const snackbar = document.querySelector("#snackbar") as HTMLDivElement;
  if (!snackbar) {
    console.warn("Snackbar Div wasn't found!");
    return;
  }

  //set the snackbar's message and color and show it
  snackbar.textContent = message;
  snackbar.style.backgroundColor = type;
  snackbar.className = "show";

  // hide the snackbar after the given duration
  setTimeout(function () {
    snackbar.className = snackbar.className.replace("show", "");
  }, duration);
}

export function logMemoryUsage(): void {
  //@ts-expect-error
  console.log(performance.memory.jsHeapSizeLimit / (8 * 1024 * 1024) + " mb"); // will give you the JS heap size
  //@ts-expect-error
  console.log(performance.memory.usedJSHeapSize / (8 * 1024 * 1024) + " mb"); // how much you're currently using
}

// Returns a random integer from 0 to range - 1.
export function randomInt(range: number): number {
  return Math.floor(Math.random() * range);
}

function benchmarkTest(): void {
  Benchmark.getAverageTime(Array.from, [Array(10).keys()], "From");

  const func = function () {
    const res2 = [];
    for (let index = 0; index < 10; index++) {
      res2[index] = index;
    }
  };

  Benchmark.getAverageTime(func, [], "Simple For Loop");
}
