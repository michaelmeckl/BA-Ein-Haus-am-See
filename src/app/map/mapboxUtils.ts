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
  MultiPolygon,
  Polygon,
} from "geojson";
import { queryAllTiles, queryGeometry, queryLayers } from "./tilequeryApi";
import { bboxPolygon, circle, difference, union } from "turf";
import { polygon } from "@turf/helpers";
// TODO declare own typing for this: import { boolean_within} from "@turf/boolean-within";

type mapboxLayerType =
  | "symbol"
  | "fill"
  | "line"
  | "circle"
  | "fill-extrusion"
  | "raster"
  | "background"
  | "heatmap"
  | "hillshade"
  | undefined;

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
  var resolutions = [];
  for (let i = 0; i <= 8; ++i) {
    resolutions.push(156543.03392804097 / Math.pow(2, i * 2));
  }
  return resolutions;
}

// see https://stackoverflow.com/questions/37599561/drawing-a-circle-with-the-radius-in-miles-meters-with-mapbox-gl-js
export function getCircleRadiusForZoomLevel(zoom: number) {
  // see https://docs.mapbox.com/help/glossary/zoom-level/
  const metersPerPixel = 78271.484 / 2 ** zoom;
  const metersToPixelsAtMaxZoom = (meters: number, latitude: number) =>
    meters / metersPerPixel / Math.cos((latitude * Math.PI) / 180);
  return metersToPixelsAtMaxZoom;
}

function addIconLayer(sourceName: string): void {
  map.addLayer({
    id: sourceName + "-symbol",
    type: "symbol",
    source: sourceName,
    layout: {
      "icon-image": [
        "match",
        ["get", "amenity"],
        "bar",
        "bar-11",
        "marker-11", // other
      ],
      "icon-allow-overlap": true,
    },
  });
}

/**
 * Util - Function that returns the current viewport extent as a polygon.
 */
export function getViewportAsPolygon(): Feature<Polygon, GeoJsonProperties> {
  const bounds = map.getBounds();
  const viewportBounds = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  return bboxPolygon(viewportBounds);
}

function polyMask(mask: Feature<Polygon, GeoJsonProperties>): Feature<Polygon, GeoJsonProperties> {
  const bboxPolygon = getViewportAsPolygon();
  return difference(bboxPolygon, mask);
}

export function addWithinStyleLayer() {
  //TODO
  //"paint": {"fill-color": ["case", ["within", poylgonjson], "black", "red"]}
}

export function findAllFeaturesInCircle(allFeatures: any) {
  const centerPoint = [2, 6];
  const circleArea = circle(centerPoint, 500, { units: "meters" });
  //TODO
  //const withinGeoData = boolean_within(circleArea, allFeatures);
  //TODO add layer for the withinGeoData
}

/**
 * Find the first layer with the given type and return its id (or undefined if no layer with that type exists).
 */
export function findLayerByType(layerType: mapboxLayerType): string | undefined {
  const layers = map.getStyle().layers;

  if (layers) {
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === layerType) {
        return layers[i].id;
      }
    }
  }
  return undefined;
}

/**
 * Util-Function to add a new layer below the "waterway-label" symbol layer on the map.
 */
export function addLayer(layerProperties: {
  id: string;
  sourceName: string;
  type: mapboxLayerType;
  paintProps?: any;
  filterExpression?: any[];
}): void {
  map.addLayer(
    {
      id: layerProperties.id,
      type: layerProperties.type,
      filter: layerProperties.filterExpression,
      source: layerProperties.sourceName,
      paint: layerProperties.paintProps,
    },
    "waterway-label"
  );
}

//TODO to fix the circle overlaps:
export function getDifferenceBetweenViewportAndFeature(): void {
  //TODO
  const mask = polygon([]) as Feature<Polygon, GeoJsonProperties>;

  map.addSource("mask", {
    type: "geojson",
    data: polyMask(mask),
  });

  addLayer({
    id: "mask-layer",
    type: "fill",
    sourceName: "mask",
    paintProps: {
      "fill-color": "white",
      "fill-opacity": 0.999, //* fixes a bug that can occur sometimes
    },
  });
}

//TODO turf union all circle geometries
export function combineCircles(
  circles: Feature<Polygon>
): Feature<Polygon | MultiPolygon, GeoJsonProperties> {
  return union(...circles);
}

/**
 * Delete all layers for the source with the given ID.
 */
export function removeAllLayersForSource(sourceID: string): boolean {
  // eslint-disable-next-line no-unused-expressions
  map.getStyle().layers?.forEach((layer) => {
    if (layer.source === sourceID) {
      console.log("deleting layer:" + JSON.stringify(layer));
      map.removeLayer(layer.id);
    }
  });

  /*
    const mapLayer = map.getLayer(id);

    console.log("maplayer:" + mapLayer);

    //TODO: improve this! there can be more than one layer (and they don't have the same id name as the source but only start with it)
    if (typeof mapLayer !== "undefined") {
      // Remove map layer & source.
      map.removeLayer(id).removeSource(id);
      return true;
    }
    */

  return false;
}

export function removeSource(sourceName: string): void {
  if (!map.getSource(sourceName)) {
    console.warn(`Couldn't remove source ${sourceName}`);
    return;
  }
  removeAllLayersForSource(sourceName);
  map.removeSource(sourceName);
}

/**
 * Update the data source of a given source layer. MUST be a GeoJson layer.
 */
export function updateLayerSource(
  id: string,
  data: FeatureCollection<GeometryObject, any>
): boolean {
  if (map.getSource(id)?.type !== "geojson") {
    return false;
  }
  const result = (map.getSource(id) as GeoJSONSource).setData(data);
  return result ? true : false;
}
