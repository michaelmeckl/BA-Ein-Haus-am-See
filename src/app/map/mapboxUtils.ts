/**
 * Utility-Methods for working with Mapbox Gl.
 */
import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import union from "@turf/union";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  GeometryObject,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
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

/**
 * Get the current bounding box, in order:
 * southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude.
 * @return string representation of the bounds in the above order
 */
export function getViewportBoundsString(additionalDistance?: number): string {
  const currBounds = map.getBounds();
  let southLat = currBounds.getSouth();
  let westLng = currBounds.getWest();
  let northLat = currBounds.getNorth();
  let eastLng = currBounds.getEast();
  //console.log(currBounds);

  if (additionalDistance) {
    const bufferedBBox = bbox(
      addBufferToFeature(bboxPolygon([westLng, southLat, eastLng, northLat]), additionalDistance)
    );
    //console.log(bufferedBBox);

    southLat = bufferedBBox[1];
    westLng = bufferedBBox[0];
    northLat = bufferedBBox[3];
    eastLng = bufferedBBox[2];
  }

  return `${southLat},${westLng},${northLat},${eastLng}`;
}

//TODO
/*
  getBBoxForBayern(): string {
    const mittelpunktOberpfalz = point([12.136, 49.402]);
    const radiusOberpfalz = 100; //km

    const mittelpunktBayern = point([11.404, 48.946]);
    const radiusBayern = 200; //km

    //@ts-expect-error
    const centerPoint = circle(mittelpunktOberpfalz, radiusOberpfalz, { units: "kilometers" });

    const bboxExtent = bbox(centerPoint);
    //console.log("Bbox: ", bboxExtent);

    const bboxExtent2 = bbpolygon(bboxExtent);

    return `${bboxExtent[1]},${bboxExtent[0]},${bboxExtent[3]},${bboxExtent[2]}`;
  }

  showCurrentViewportCircle(): void {
    const { center, radius } = mapboxUtils.getRadiusAndCenterOfViewport();
    //@ts-expect-error
    const viewportCirclePolygon = circle([center.lng, center.lat], radius, { units: "meters" });

    mapLayerManager.addNewGeojsonSource("viewportCircle", viewportCirclePolygon);
    const newLayer: Layer = {
      id: "viewportCircleLayer",
      source: "viewportCircle",
      type: "fill",
      paint: {
        "fill-color": "rgba(255, 255, 0, 0.15)",
      },
    };
    mapLayerManager.addNewLayer(newLayer, true);
  }
  */

export function getRadiusAndCenterOfViewport(): any {
  const centerPoint = map.getCenter();
  const northEastPoint = map.getBounds().getNorthEast();
  const radius = centerPoint.distanceTo(northEastPoint); // in meters

  return { center: centerPoint, radius: radius };
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

    //TODO hier erst simplify?
  }
  Benchmark.stopMeasure("adding buffer to all features");

  return polygonFeatures;
}

export function flattenMultiGeometry(
  data: FeatureCollection<GeometryObject, any>
): (
  | Feature<Point, GeoJsonProperties>
  | Feature<LineString, GeoJsonProperties>
  | Feature<Polygon, GeoJsonProperties>
)[] {
  const currentPoints: Set<Feature<Point, GeoJsonProperties>> = new Set();
  const currentWays: Set<Feature<LineString, GeoJsonProperties>> = new Set();
  const currentPolygons: Set<Feature<Polygon, GeoJsonProperties>> = new Set();

  for (let index = 0; index < data.features.length; index++) {
    const element = data.features[index];

    switch (element.geometry.type) {
      case "Point":
        currentPoints.add(element as Feature<Point, GeoJsonProperties>);
        break;

      case "MultiPoint":
        for (const coordinate of element.geometry.coordinates) {
          const point = {
            geometry: { type: "Point", coordinates: coordinate },
            properties: { ...element.properties },
            type: "Feature",
          } as Feature<Point, GeoJsonProperties>;

          currentPoints.add(point);
        }
        break;

      case "LineString": {
        currentWays.add(element as Feature<LineString, GeoJsonProperties>);
        break;
      }
      case "MultiLineString":
        for (const coordinate of element.geometry.coordinates) {
          const way = {
            geometry: { type: "LineString", coordinates: coordinate },
            properties: { ...element.properties },
            type: "Feature",
          } as Feature<LineString, GeoJsonProperties>;

          currentWays.add(way);
        }
        break;

      case "Polygon": {
        currentPolygons.add(element as Feature<Polygon, GeoJsonProperties>);
        break;
      }
      case "MultiPolygon":
        for (const coordinate of element.geometry.coordinates) {
          // construct a new polygon for every coordinate array in the multipolygon
          const polygon = {
            geometry: { type: "Polygon", coordinates: coordinate },
            properties: { ...element.properties },
            type: "Feature",
          } as Feature<Polygon, GeoJsonProperties>;

          currentPolygons.add(polygon);
        }
        break;
      case "GeometryCollection":
        break;

      default:
        throw new Error("Unknown geojson geometry type in data!");
    }
  }

  const allFeatures = [...currentPoints, ...currentWays, ...currentPolygons];
  //console.log("allFeatures: ", allFeatures);
  return allFeatures;
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
    mapLayerManager.updateGeojsonSource("maske", mask);
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
