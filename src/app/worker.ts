/*
import circle from "@turf/circle";
import union from "@turf/union";
*/
/*
import Benchmark from "../../shared/benchmarking";
import { addBufferToFeature } from "./turfUtils";
*/
const ctx: Worker = self as any;

// Post data to parent thread
ctx.postMessage({ foo: "foo" });

// Respond to message from parent thread
ctx.addEventListener("message", (event) => console.log(event));

/*
function convertAllFeaturesToPolygons(features, bufferSize = 100) {
  console.log("in worker convert features");
  const polygonFeatures = [];

  for (let index = 0; index < features.length; index++) {
    const feature = features[index];

    if (feature.geometry.type === "Point") {
      //! turf can add properties mit turf.point([...], {additional Props hierher})
      const circleOptions = {
        steps: 80,
        units: "meters"
      };
      // replace all point features with circle polygon features
      polygonFeatures.push(
        circle(feature, bufferSize, circleOptions)
      );
      console.log("after turf circle in worker");
    } else if (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") {
      // add a buffer to all lines and polygons
      // This also replaces all line features with buffered polygon features as turf.buffer() returns
      // Polygons (or Multipolygons).
      polygonFeatures.push(addBufferToFeature(feature, "meters", bufferSize));
    } else {
      break;
    }
  }

  return polygonFeatures;
}

function performUnion(features) {
  let unionResult = features[0];
  for (let index = 1; index < features.length; index++) {
    const element = features[index];
    unionResult = union(unionResult, element);
  }
  return unionResult;
}

export async function calculateMaskAndIntersections(features) {
  console.log("in worker calculate Mask");

  Benchmark.startMeasure("convertAllFeaturesToPolygons");
  const polygonFeatures = convertAllFeaturesToPolygons(features, 150);
  Benchmark.stopMeasure("convertAllFeaturesToPolygons");

  if (polygonFeatures.length === 0) {
    console.warn("No polygons created!");
    return {};
  }

  Benchmark.startMeasure("performUnion");
  //combine / union all circles to one polygon
  const unionPolygons = performUnion(polygonFeatures);
  //TODO
  //const unionPolygons = await fetchMaskData(polygonFeatures);
  //console.log("MaskData: ", maskData);

  Benchmark.stopMeasure("performUnion");

  //TODO
  // 1. union intersections!! (sowieso gut damit nicht so überlagert)
  // 2. nochmal mask/ difference zw. äußerem polygon und dem intersections polygon
  // 3. in hellerem grau einzeichnen

  return {
    unionPolygons: unionPolygons
  };
}
*/

/*
ctx.onmessage = function (e) {
  console.log("Worker: Message received from main script");
  //const workerResult = calculateMaskAndIntersections(e.data);
  const workerResult = "hello from worker";
  postMessage(workerResult);
};

//export default self;
export default null as any;
*/

/*
export default class WebpackWorker extends Worker {
  constructor() {
    super("");
  }
}

ctx.addEventListener("message", (event) => {
  console.log(event);
  setTimeout(
    () =>
      ctx.postMessage({
        foo: "boo",
      }),
    5000
  );
});
*/

//export default null as any;
