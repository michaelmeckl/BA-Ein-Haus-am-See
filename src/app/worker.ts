import type { Feature, GeoJsonProperties, LineString, MultiPolygon, Point, Polygon } from "geojson";
import Benchmark from "../shared/benchmarking";

const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener("message", async (event) => {
  //console.log("in worker onmessage: ", event);
  // return result to main thread
  //ctx.postMessage(resultGeo);
});

/*
export default class WebpackWorker extends Worker {
  constructor() {
    super("");
  }
}
*/

//export default null as any;
