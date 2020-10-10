/**
 * This file provides mapbox util and helper functions to query and extract features from sources and layers.
 */
import { chunk } from "lodash";
import geojsonCoords from "@mapbox/geojson-coords";
import mapboxgl, { LngLatLike } from "mapbox-gl";
import { map } from "./mapboxConfig";

/**
 * This check is necessary for queryRenderedFeatures/querySourceFeatures, otherwise
 * (if layer is not fully loaded) it will just return an empty array.
 */
function testIfLayerLoaded(): boolean {
  //TODO
  /*
  var wasLoaded = false;
  // Fired whenever the map is drawn or redrawn (e.g. new tiles or geojson) to the screen
  map.on("render", function () {
    if (!map.loaded() || wasLoaded) return;
    wasLoaded = true;
  });
  */
  return true;
}

//TODO has to be called after layer is loaded!
export function getQueryAndRenderedFeatures(src: string, layerName: string) {
  map.on("sourcedata", (e) => {
    if (map.getSource(layerName) && map.isSourceLoaded(layerName)) {
      console.log("source loaded!");
      const features = map.querySourceFeatures(layerName);
      console.log(features);
      const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
      const everyPoint2 = map.querySourceFeatures(src, { sourceLayer: layerName });
      console.log(everyPoint);
      console.log(everyPoint2);
    }
  });
}

export function getAllRenderedFeaturesIn(bbox: [mapboxgl.PointLike, mapboxgl.PointLike]): void {
  /**
   * The geometry of the query region: either a single point or southwest and northeast points describing a
   * bounding box. Omitting this parameter (i.e. calling Map#queryRenderedFeatures with zero arguments, or
   * with only a options argument) is equivalent to passing a bounding box encompassing the entire map viewport.
   */
  const features = map.queryRenderedFeatures(bbox);

  // Get the first feature within the list if one exist
  if (features.length > 0) {
    const feature = features[0];

    // Ensure the feature has properties defined
    if (!feature.properties) {
      return;
    }

    Object.entries(feature.properties).forEach(([key, value]) => {
      console.log(key, value);
    });
  }
}

export function getAllVisibleFeatures(layerName: string): any {
  //TODO
}

export function getAllFeaturesOnMap(): any {
  //TODO
}

export function getDataforFeaturesInSelection(
  filters: Set<string>
): mapboxgl.MapboxGeoJSONFeature[] {
  console.log("Getting data for filters: ", filters.entries.toString());

  const allGeoData: mapboxgl.MapboxGeoJSONFeature[] = [];
  for (const el of filters) {
    const features = map.querySourceFeatures(el);
    allGeoData.push(...features);
  }

  //TODO clean the geojson?
  //const newData = cleanCoords(allGeoData);
  //console.log(newData);

  return allGeoData;
}

function convertToMercatorCoordinates(arr: number[][]): number[] {
  const MercatorCoordinates = arr.map((el) =>
    mapboxgl.MercatorCoordinate.fromLngLat(el as LngLatLike)
  );
  console.log("Mercator:", MercatorCoordinates);

  return MercatorCoordinates.flatMap((x) => [x.x, x.y]);
}

export function getDataFromMap(filters: Set<string>): number[] {
  const allGeoData = getDataforFeaturesInSelection(filters);
  console.log("QuerySourceFeatures: ");
  console.log(allGeoData);

  //TODO use geojson-coords() instead of the next 2 steps?
  const coordsResult = geojsonCoords(allGeoData);
  console.log("geoCoords Result: ", coordsResult);

  const testData: number[] = [].concat(
    //@ts-expect-error
    ...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))
  );
  console.log(testData);
  const newArray = chunk(testData, 2);
  console.log("newArray after lodash:", newArray);

  const customData = convertToMercatorCoordinates(newArray);
  //console.log(customData);
  return customData;
}
