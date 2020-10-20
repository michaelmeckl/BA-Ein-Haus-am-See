import buffer from "@turf/buffer";
import nearestPoint from "@turf/nearest-point";
import shortestPath from "@turf/shortest-path";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { GeoJSONSource } from "mapbox-gl";
import { map } from "./mapboxConfig";

type turfUnits = "meters" | "kilometers";

//called in map.on("click")
export function getNearestPointOfLayer(e: mapboxgl.MapMouseEvent, layerName: string): void {
  const mapFeatures = map.queryRenderedFeatures(e.point, { layers: [layerName] });
  if (!mapFeatures.length) {
    return;
  }

  const nearest = nearestPoint(e.point, mapFeatures);

  if (nearest !== null) {
    (map.getSource("nearest-hospital") as GeoJSONSource).setData({
      type: "FeatureCollection",
      // @ts-expect-error
      features: [nearest],
    });

    map.addLayer({
      id: "nearest-hospital",
      type: "circle",
      source: "nearest-hospital",
      paint: {
        "circle-radius": 12,
        "circle-color": "#486DE0",
      },
    });
  }
}

// this uses an older turf buffer version (@4.7.3 instead of @5.1.5) because of incorrect measurements
// in the new version; track issue at https://github.com/Turfjs/turf/issues/1484
export function addBufferToFeature(
  element: Feature<Geometry, GeoJsonProperties>,
  bufferSize = 100,
  units: turfUnits = "meters"
): Feature<any> {
  //const newElement = buffer(element as Feature<Polygon, GeoJsonProperties>, 50, "meters");
  return buffer(element, bufferSize, units);
}

function addTurfPath(start: any, end: any): void {
  const options = {
    resolution: 100,
  };
  const path = shortestPath(start, end, options);
  const sourceLine = "turfShortestPath";

  map.addSource(sourceLine, {
    type: "geojson",
    data: path,
  });
  map.addLayer({
    id: "line",
    type: "line",
    source: sourceLine,
    paint: {
      "line-color": "#66dddd",
    },
  });
}
