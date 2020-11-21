import buffer from "@turf/buffer";
import type { Feature, GeoJsonProperties, Geometry, MultiPolygon, Polygon } from "geojson";

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
