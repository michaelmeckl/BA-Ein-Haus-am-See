import buffer from "@turf/buffer";
import circle from "@turf/circle";
import intersect from "@turf/intersect";
import mask from "@turf/mask";
import union from "@turf/union";
import geobuf from "geobuf";
import Pbf from "pbf";
import type { Feature, GeoJsonProperties, LineString, MultiPolygon, Point, Polygon } from "geojson";
import Benchmark from "../shared/benchmarking";

const ctx: Worker = self as any;

function convertAllFeaturesToPolygons(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[],
  bufferSize = 100
): Feature<Polygon | MultiPolygon, GeoJsonProperties>[] {
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
      polygonFeatures.push(buffer(feature, bufferSize, "meters"));
    } else {
      break;
    }
  }

  return polygonFeatures;
}

function performUnion(features: any[]): Feature<any, GeoJsonProperties> {
  let unionResult = features[0];
  for (let index = 1; index < features.length; index++) {
    const element = features[index];
    unionResult = union(unionResult, element);
  }
  return unionResult;
}

function findIntersections(
  features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]
): Feature<any, GeoJsonProperties>[] {
  const allIntersections: Feature<any, GeoJsonProperties>[] = [];

  /*
  //* create a lookup object to improve performance from O(m*n) to O(m+n)
  // see https://bytes.com/topic/javascript/insights/699379-optimize-loops-compare-two-arrays
  const lookup: any = {};

  for (const key in features) {
    if (Object.prototype.hasOwnProperty.call(features, key)) {
      lookup[features[key]] = features[key];
    }
  }

  for (const i in features) {
    if (typeof lookup[list1[i]] !== "undefined") {
        alert("found " + list1[i] + " in both lists");
        break;
      }
  }
  */

  //TODO make this more efficient than O(m^2)!
  for (const feature1 of features) {
    for (const feature2 of features) {
      if (feature1 !== feature2) {
        allIntersections.push(intersect(feature1, feature2));
      }
    }
  }

  return allIntersections;
}

export async function calculateMaskAndIntersections(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): Promise<any> {
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

  Benchmark.startMeasure("findIntersections");
  //get all intersections and remove all null values
  const intersections = findIntersections(polygonFeatures).filter((it) => it !== null);
  console.log("Intersections: ", intersections);
  Benchmark.stopMeasure("findIntersections");

  //TODO
  // 1. union intersections!! (sowieso gut damit nicht so überlagert)
  // 2. nochmal mask/ difference zw. äußerem polygon und dem intersections polygon
  // 3. in hellerem grau einzeichnen

  /*
  //! out of memory error im browser!
  const unionIntersections = performUnion(intersections);
  */

  return {
    unionPolygons: unionPolygons,
    intersections: intersections,
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
