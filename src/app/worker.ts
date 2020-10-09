import buffer from "@turf/buffer";
import circle from "@turf/circle";
import mask from "@turf/mask";
import union from "@turf/union";
import geobuf from "geobuf";
import Pbf from "pbf";
import Benchmark from "../shared/benchmarking";

const ctx: Worker = self as any;

function convertAllFeaturesToPolygons(features: string | any[], bufferSize = 100): any[] {
  const polygonFeatures = [];

  for (let index = 0; index < features.length; index++) {
    const feature = features[index];

    if (feature.geometry.type === "Point") {
      //! turf can add properties mit turf.point([...], {additional Props hierher})
      const circleOptions = {
        steps: 80,
        units: "meters",
      };
      // replace all point features with circle polygon features
      //@ts-expect-error
      polygonFeatures.push(circle(feature, bufferSize, circleOptions));
      console.log("after turf circle in worker");
    } else if (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") {
      // add a buffer to all lines and polygons
      // This also replaces all line features with buffered polygon features as turf.buffer() returns
      // Polygons (or Multipolygons).
      //@ts-expect-error
      polygonFeatures.push(buffer(feature, bufferSize, { units: "meters" }));
    } else {
      break;
    }
  }

  return polygonFeatures;
}

function performUnion(features: string | any[]) {
  let unionResult = features[0];
  for (let index = 1; index < features.length; index++) {
    const element = features[index];
    unionResult = union(unionResult, element);
  }
  return unionResult;
}

export async function calculateMaskAndIntersections(features: any) {
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
    unionPolygons: unionPolygons,
  };
}

// Respond to message from parent thread
ctx.addEventListener("message", async (event) => {
  //console.log("in worker onmessage: ", event);
  Benchmark.startMeasure("calculateMaskAndIntersections");
  const featureObject = await calculateMaskAndIntersections(event.data);
  Benchmark.stopMeasure("calculateMaskAndIntersections");

  const maske = featureObject.unionPolygons;
  //const intersects: any[] = featureObject.intersections;

  Benchmark.startMeasure("turf-mask-auto");
  const resultGeo = mask(maske);
  Benchmark.stopMeasure("turf-mask-auto");

  // return result to main thread
  /*
  Benchmark.startMeasure("encode geobuf");
  const workerResult = geobuf.encode(resultGeo, new Pbf());
  Benchmark.stopMeasure("encode geobuf");
  */
  ctx.postMessage(resultGeo);
});

/*
export default class WebpackWorker extends Worker {
  constructor() {
    super("");
  }
}
*/

//export default null as any;
