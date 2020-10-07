/**
 * Utility-Methods for working with Mapbox Gl.
 */
import type { GeoJSONSource } from "mapbox-gl";
import { map } from "./mapboxConfig";
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
import { queryAllTiles, queryGeometry, queryLayers } from "./tilequeryApi";
import circle from "@turf/circle";
import * as turfHelpers from "@turf/helpers";
import bboxPolygon from "@turf/bbox-polygon";
import difference from "@turf/difference";
import union from "@turf/union";
import mask from "@turf/mask";
import { addBufferToFeature } from "./turfUtils";
import intersect from "@turf/intersect";
import mapboxgl from "mapbox-gl";
// TODO declare own typing for this: import { boolean_within} from "@turf/boolean-within";

export async function testTilequeryAPI(): Promise<void> {
  const queryResult = await queryAllTiles([12.1, 49.008], 3000, 50);
  queryResult.features.forEach((f) => {
    console.log(f.properties?.type);
  });

  const queryResultLayer = await queryLayers([12.1, 49.008], ["poi_label", "building"], 3000, 50);
  queryResultLayer.features.forEach((f) => {
    console.log("Class: ", f.properties?.class);
    console.log("Type: ", f.properties?.type);
  });

  const queryResultGeom = await queryGeometry([12.1, 49.008], "polygon", 3000, 50);
}

function getResolutions() {
  // Calculation of resolutions that match zoom levels 1, 3, 5, 7, 9, 11, 13, 15.
  const resolutions = [];
  for (let i = 0; i <= 8; ++i) {
    resolutions.push(156543.03392804097 / Math.pow(2, i * 2));
  }
  return resolutions;
}

// see https://stackoverflow.com/questions/37599561/drawing-a-circle-with-the-radius-in-miles-meters-with-mapbox-gl-js
export function getCircleRadiusForZoomLevel(zoom: number): any {
  // see https://docs.mapbox.com/help/glossary/zoom-level/
  const metersPerPixel = 78271.484 / 2 ** zoom;
  const metersToPixelsAtMaxZoom = (meters: number, latitude: number) =>
    meters / metersPerPixel / Math.cos((latitude * Math.PI) / 180);
  return metersToPixelsAtMaxZoom;
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

export function findAllFeaturesInCircle(allFeatures: any) {
  const centerPoint = [2, 6];
  const circleArea = circle(centerPoint, 500, { units: "meters" });
  //TODO
  //const withinGeoData = boolean_within(circleArea, allFeatures);
  //TODO add layer for the withinGeoData
}

/**
 * Util - Function that returns the current viewport extent as a polygon.
 */
export function getViewportAsPolygon(): Feature<Polygon, GeoJsonProperties> {
  const bounds = map.getBounds();
  const viewportBounds = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  return bboxPolygon(viewportBounds);
}

//TODO größtenteils doppelt in mapController (da mit switch, vllt effizienter?)
function convertAllFeaturesToPolygons(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): Feature<any, GeoJsonProperties>[] {
  const polygonFeatures = [];

  for (let index = 0; index < features.length; index++) {
    const feature = features[index];

    if (feature.geometry.type === "Point") {
      const circleOptions = { steps: 80, units: "meters" /*, properties: {foo: 'bar'}*/ };
      // replace all point features with circle polygon features
      polygonFeatures.push(
        circle(feature as Feature<Point, GeoJsonProperties>, 200, circleOptions)
      );
    } else if (feature.geometry.type === "LineString") {
      // replace all line features with buffered line polygon features
      polygonFeatures.push(addBufferToFeature(feature, "meters", 30)); //TODO buffer automatically makes it a polygon if i am correct
    } else if (feature.geometry.type === "Polygon") {
      const poly = addBufferToFeature(feature, "meters", 50);
      console.log(poly);
      polygonFeatures.push(poly);
    } else {
      break;
    }
  }

  return polygonFeatures;
}

function polyMask(
  mask: Feature<Polygon, GeoJsonProperties>,
  bounds: Feature<Polygon, GeoJsonProperties>
): Feature<Polygon, GeoJsonProperties> {
  const diff = difference(bounds, mask);
  console.log("Difference: ", diff);
  return diff;
}

function performUnion(features: any): Feature<any, GeoJsonProperties> {
  let unionResult: any = features[0];
  for (let index = 1; index < features.length; index++) {
    const element = features[index];
    unionResult = union(unionResult, element);
  }
  return unionResult;
}

function findIntersections(features: any): Feature<any, GeoJsonProperties>[] {
  const allIntersections: any[] = [];

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

export function combineFeatures(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): any {
  const polygonFeatures = convertAllFeaturesToPolygons(features);

  if (polygonFeatures.length === 0) {
    console.warn("No polygons created!");
    return {} as Feature<Polygon | MultiPolygon, GeoJsonProperties>;
  }

  //combine / union all circles to one polygon
  //const unionPolygons = union(...polygonFeatures);
  const unionPolygons = performUnion(polygonFeatures);
  console.log("Unioned Polygons: ", unionPolygons);

  //get all intersections and remove all null values
  const intersections = findIntersections(polygonFeatures).filter((it) => it !== null);
  console.log("Intersections: ", intersections);

  /*
  //! out of memory error im browser!
  const unionIntersections = performUnion(intersections);
  */

  //TODO
  // 1. union intersections!! (sowieso gut damit nicht so überlagert)
  // 2. nochmal mask/ difference zw. äußerem polygon und dem intersections polygon
  // 3. in hellerem grau einzeichnen

  return { unionPolygons: unionPolygons, intersections: intersections };
}

//* Idee: mit turf.bbpolygon die bounding box des viewports zu einem Polygon machen, dann mit turf.distance
//den Unterschied vom Polygon und der Bounding Box nehmen und das dann einfärben mit fill-color!
export function getDifferenceBetweenViewportAndFeature(
  features: Feature<Point | LineString | Polygon, GeoJsonProperties>[]
): void {
  const featureObject = combineFeatures([...features]);
  console.log(featureObject);

  const maske = featureObject.unionPolygons;
  const intersects: any[] = featureObject.intersections;

  const result = polyMask(maske, getViewportAsPolygon());

  /*
  map.addSource("intersect", {
    type: "geojson",
    data: mask(turfHelpers.featureCollection(intersects)),
  });

  map.addLayer({
    id: "intersect-layer",
    source: "intersect",
    type: "fill",
    paint: {
      "fill-color": "rgba(0,153,0,0.1)",
    },
  });
  */

  map.addSource("mask", {
    type: "geojson",
    data: result,
  });

  map.addLayer({
    id: "mask-layer",
    source: "mask",
    type: "fill",
    paint: {
      //"fill-outline-color": "rgba(0,0,0,0.9)",
      "fill-color": "rgba(103,103,103,0.9)",
    },
  });

  //TODO alternative mit turf mask: welche ist besser? ->  messen!
  /*
  const turfMask = mask(maske, getViewportAsPolygon());

  map.addSource("maske", {
    type: "geojson",
    data: turfMask,
  });

  map.addLayer({
    id: "mask-layer2",
    source: "maske",
    type: "fill",
    paint: {
      "fill-outline-color": "rgba(0,0,0,0.9)",
      "fill-color": "rgba(183,183,183,0.9)",
    },
  });*/
}
