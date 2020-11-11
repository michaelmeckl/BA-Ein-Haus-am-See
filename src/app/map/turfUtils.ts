import buffer from "@turf/buffer";
import type { Feature, GeoJsonProperties, Geometry, MultiPolygon, Polygon } from "geojson";

//TODO
/*
const aliens = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ID: 1, isAlien: "yes" },
      geometry: { type: "Point", coordinates: [-104.4580078125, 33.687781758439364] },
    },
  ],
};

function spatialJoin(sourceGeoJSON: any[], filterFeature: any): any[] {
  // Loop through all the features in the source geojson and return the ones that
  // are inside the filter feature (buffered radius) and are confirmed landing sites
  // prettier-ignore
  const joined = sourceGeoJSON.filter((feature: { properties: { isAlien: string } }) => {
       return booleanPointInPolygon(feature, filterFeature) && feature.properties.isAlien === "yes";
  });

  return joined;
}

function testGettingNearbyFeatures(sourceName: string) {
  const searchRadius = 1200;
  //const featuresInBuffer = spatialJoin(features, searchRadius);
  const featuresInBuffer = spatialJoin((aliens as unknown) as any[], searchRadius);
  (map.getSource("alien-truth") as any).setData(turf.featureCollection(featuresInBuffer));
}
*/

type turfUnits = "meters" | "kilometers";

// this uses an older turf buffer version (@4.7.3 instead of @5.1.5) because of incorrect measurements
// in the new version; track issue at https://github.com/Turfjs/turf/issues/1484
export function addBufferToFeature(
  element: Feature<Geometry, GeoJsonProperties>,
  bufferSize = 100,
  units: turfUnits = "meters"
): Feature<Polygon | MultiPolygon, GeoJsonProperties> {
  //const newElement = buffer(element as Feature<Polygon, GeoJsonProperties>, 50, "meters");
  return buffer(element, bufferSize, units);
}
