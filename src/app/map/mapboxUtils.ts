/**
 * Utility-Methods for working with Mapbox Gl.
 */
import bboxPolygon from "@turf/bbox-polygon";
import union from "@turf/union";
import type { Feature, GeoJsonProperties, LineString, MultiPolygon, Point, Polygon } from "geojson";
import mapboxgl, { LngLat, LngLatLike } from "mapbox-gl";
import WebWorker from "worker-loader!../worker";
import Benchmark from "../../shared/benchmarking";
import { map } from "./mapboxConfig";
import mapLayerManager from "../mapData/mapLayerManager";
import { addBufferToFeature } from "./turfUtils";

// formula based on https://wiki.openstreetmap.org/wiki/Zoom_levels
export function metersInPixel(meters: number, latitude: number, zoomLevel: number): number {
  const earthCircumference = 40075016.686;
  const latitudeRadians = latitude * (Math.PI / 180);
  // zoomlevel + 9 instead of +8 because mapbox uses 512*512 tiles, see https://docs.mapbox.com/help/glossary/zoom-level/
  const metersPerPixel =
    (earthCircumference * Math.cos(latitudeRadians)) / Math.pow(2, zoomLevel + 9);

  return meters / metersPerPixel;
}

export function getViewportBounds(): number[][] {
  const bounds = map.getBounds();
  const viewportBounds = [
    bounds.getNorthWest().toArray(),
    bounds.getNorthEast().toArray(),
    bounds.getSouthEast().toArray(),
    bounds.getSouthWest().toArray(),
  ];
  return viewportBounds;
}

export function getRadiusAndCenterOfViewport(): any {
  const centerPoint = map.getCenter();
  const northEastPoint = map.getBounds().getNorthEast();
  const radius = centerPoint.distanceTo(northEastPoint); // in meters

  return { center: centerPoint, radius: radius };
}

/**
 * Mainly used for the heatmap, but may be useful for the other approaches too.
 */
export function addLegend(): void {
  //TODO sinnvolle Werte einsetzen
  const layers = ["0-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500-1000", "1000+"];
  //prettier-ignore
  const colors = ["rgba(33,102,172,0)", "rgb(103,169,207)", "rgb(209,229,240)", "rgb(253,219,199)", "rgb(239,138,98)", "rgb(178,24,43)"];

  const legend = document.querySelector("#legend");

  if (!legend) {
    return;
  }

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const color = colors[i];
    const item = document.createElement("div");
    const key = document.createElement("span");
    key.className = "legend-key";
    key.style.backgroundColor = color;

    const value = document.createElement("span");
    value.innerHTML = layer;
    item.appendChild(key);
    item.appendChild(value);
    legend.appendChild(item);
  }
}

export function addPopupOnHover(): void {
  // Create a popup, but don't add it to the map yet.
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
  });

  map.on("mouseenter", "places", function (e) {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = "pointer";

    // @ts-expect-error
    const coordinates = e.features[0].geometry.coordinates.slice();
    // @ts-expect-error
    const description = e.features[0].properties.description;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup.setLngLat(coordinates).setHTML(description).addTo(map);
  });

  map.on("mouseleave", "places", function () {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });
}

/**
 * Util - Function that returns the current viewport extent as a polygon.
 */
//TODO vllt etwas mehr als den viewport gleich nehmen?
//* not used right now
export function getViewportAsPolygon(): Feature<Polygon, GeoJsonProperties> {
  const bounds = map.getBounds();
  const viewportBounds = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  return bboxPolygon(viewportBounds);
}

export function convertAllFeaturesToPolygons(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[],
  bufferSize = 500
): Feature<Polygon | MultiPolygon, GeoJsonProperties>[] {
  const polygonFeatures: Feature<Polygon | MultiPolygon, GeoJsonProperties>[] = [];

  Benchmark.startMeasure("adding buffer to all features");

  for (let index = 0; index < features.length; index++) {
    const feature = features[index];
    // add a buffer to all points, lines and polygons; this operation returns only polygons / multipolygons
    polygonFeatures.push(addBufferToFeature(feature, bufferSize, "meters"));

    /*
    if (feature.geometry.type === "Point") {
      // replace all point features with circle polygon features
      const circleOptions = { steps: 80, units: "meters"};
      polygonFeatures.push(circle(feature as Feature<Point, GeoJsonProperties>, bufferSize, circleOptions));
    } else if (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon") {
      // add a buffer to all lines and polygons
      // This also replaces all line features with buffered polygon features as turf.buffer() returns
      // Polygons (or Multipolygons).
      polygonFeatures.push(addBufferToFeature(feature, bufferSize, "meters"));
    } else {
      break;
    }*/
  }
  Benchmark.stopMeasure("adding buffer to all features");

  return polygonFeatures;
}

function performUnion(features: any): Feature<any, GeoJsonProperties> {
  let unionResult: any = features[0];
  for (let index = 1; index < features.length; index++) {
    const element = features[index];
    unionResult = union(unionResult, element);
  }
  return unionResult;
}

export async function calculateMaskAndIntersections(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): Promise<any> {
  Benchmark.startMeasure("convertAllFeaturesToPolygons");
  const polygonFeatures = convertAllFeaturesToPolygons(features, 150);
  Benchmark.stopMeasure("convertAllFeaturesToPolygons");

  if (polygonFeatures.length === 0) {
    console.warn("No polygons created!");
    return {} as Feature<Polygon | MultiPolygon, GeoJsonProperties>;
  }

  Benchmark.startMeasure("performUnion");
  //combine / union all circles to one polygon
  const unionPolygons = performUnion(polygonFeatures);
  Benchmark.stopMeasure("performUnion");

  return { unionPolygons: unionPolygons };
}

export function showMask(mask: any): void {
  console.log("in showMask: ", mask);
  mapLayerManager.removeAllLayersForSource("maske");

  if (map.getSource("maske")) {
    // the source already exists, only update the data
    console.log(`Source ${"maske"} is already used! Updating it!`);
    mapLayerManager.updateSource("maske", mask);
  } else {
    // source doesn't exist yet, create a new one
    mapLayerManager.addNewGeojsonSource("maske", mask, false);
  }

  const currentLat = map.getCenter().lat;

  map.addLayer({
    id: "mask-layer",
    source: "maske",
    type: "fill",
    paint: {
      //"fill-outline-color": "rgba(0,0,0,0.0)",
      "fill-color": "rgba(105,105,105,0.7)",
    },
  });

  //add a small blur effect on the outline
  map.addLayer({
    id: "mask-layer-outline",
    source: "maske",
    type: "line",
    paint: {
      "line-color": "rgba(233,233,233,0.3)",
      //FIXME if the line width is too big (>20 ca.) artifacts start to appear on some edges?? because of polygon?
      //prettier-ignore
      "line-width": [
        // this makes the line-width in meters stay relative to the current zoom level:
        "interpolate",
        ["exponential", 2], ["zoom"],
        10, /*["*", 10, ["^", 2, -16]],*/ metersInPixel(20, currentLat, 10),
        24, /*["*", 150, ["^", 2, 8]]*/ metersInPixel(100, currentLat, 24),
      ],
      //prettier-ignore
      "line-blur": ["interpolate", ["linear"], ["zoom"],
          10, 0,
          16, 15,
          24, 30,
      ],
    },
  });
}

let webWorker: Worker | undefined;

function stopWorker(): void {
  webWorker?.terminate();
  // set to undefined so it can be used again afterwards
  webWorker = undefined;
}

//perf results: 720 ms, 845 ms, 1030 ms, 980 ms, 760 ms => avg: 867 ms
// with geobuf a little bit better, but not much (ca. 30-40 ms)
function setupWebWorker(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): void {
  if (typeof Worker !== "undefined") {
    if (typeof webWorker === "undefined") {
      //worker = new Worker("../worker.js", { type: "module" });
      webWorker = new WebWorker();
    }

    Benchmark.startMeasure("showing mask data");
    webWorker.postMessage(features);

    webWorker.onmessage = (event) => {
      console.log("worker result: ", event.data);

      showMask(event.data);
      Benchmark.stopMeasure("showing mask data");
      stopWorker();
    };
    webWorker.onerror = (ev) => {
      console.error("Worker error: ", ev);
      stopWorker();
    };
  } else {
    console.warn("No Web Worker support!");
  }
}

//Idee: mit turf.bbpolygon die bounding box des viewports zu einem Polygon machen, dann mit turf.distance
//den Unterschied vom Polygon und der Bounding Box nehmen und das dann einfärben mit fill-color!
export async function showDifferenceBetweenViewportAndFeature(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): Promise<any> {
  //setupWebWorker(features);

  // perf-results without web worker: 304 ms, 611 ms, 521 ms, 247 ms, 962ms => avg: 529 ms
  Benchmark.startMeasure("showing mask data");

  Benchmark.startMeasure("calculateMaskAndIntersections");
  const featureObject = await calculateMaskAndIntersections([...features]);
  Benchmark.stopMeasure("calculateMaskAndIntersections");

  /*
  const maske = featureObject.unionPolygons;

  Benchmark.startMeasure("turf-mask-auto");
  const result = mask(maske);
  Benchmark.stopMeasure("turf-mask-auto");

  showMask(result);
  Benchmark.stopMeasure("showing mask data");
  */
}

/**
 * Util-Function to convert LngLat coordinates to pixel coordinates on the screen.
 */
export function convertToPixelCoord(coord: LngLatLike): mapboxgl.Point {
  return map.project(coord);
}

/**
 * Util-Function to convert pixel coordinates to LngLat coordinates.
 */
export function convertToLatLngCoord(point: mapboxgl.PointLike): LngLat {
  return map.unproject(point);
}

export function getPixelCoordinates(
  features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]
): mapboxgl.Point[] {
  const pixelCoords: mapboxgl.Point[] = [];

  for (const feature of features) {
    const coords = feature.geometry.coordinates;
    for (const coord of coords) {
      // check if this is a multidimensional array
      if (Array.isArray(coords[0])) {
        for (const coordPart of coord) {
          pixelCoords.push(convertToPixelCoord(coordPart as LngLatLike));
        }
      } else {
        pixelCoords.push(convertToPixelCoord((coord as unknown) as LngLatLike));
      }
    }
  }

  console.log("pixelCoords: ", pixelCoords);

  return pixelCoords;
}

export function convertToMercatorCoordinates(arr: number[][]): number[] {
  const MercatorCoordinates = arr.map((el) =>
    mapboxgl.MercatorCoordinate.fromLngLat(el as LngLatLike)
  );
  //console.log("Mercator:", MercatorCoordinates);
  return MercatorCoordinates.flatMap((x) => [x.x, x.y]);
}

export function getMercatorCoordinates(
  features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]
): mapboxgl.MercatorCoordinate[] {
  const mercatorCoords: mapboxgl.MercatorCoordinate[] = [];

  console.log(features);

  for (const feature of features) {
    const coords = feature.geometry.coordinates;

    for (const coord of coords) {
      // check if this is a multidimensional array
      if (Array.isArray(coords[0])) {
        for (const coordPart of coord) {
          mercatorCoords.push(
            mapboxgl.MercatorCoordinate.fromLngLat({ lng: coordPart[0], lat: coordPart[1] })
          );
        }
      } else {
        const mapCoord = ({ lng: coord[0], lat: coord[1] } as unknown) as LngLatLike;
        mercatorCoords.push(mapboxgl.MercatorCoordinate.fromLngLat(mapCoord));
      }
    }
  }

  console.log("mercatorCoords: ", mercatorCoords);

  return mercatorCoords;
}
