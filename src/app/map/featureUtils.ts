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
function testIfSourceLoaded(sourceName: string): boolean {
  //TODO
  /*
  var wasLoaded = false;
  // Fired whenever the map is drawn or redrawn (e.g. new tiles or geojson) to the screen
  map.on("render", function () {
    if (!map.loaded() || wasLoaded) return;
    wasLoaded = true;
  });
  */
  return map.getSource(sourceName) && map.isSourceLoaded(sourceName);
}

/**
 * * .properties und .geometry (.coordinates und .type) sind bei beiden vorhanden
 * * bei rendered features kann auch die source, bei sourceFeatures das tile ausgelesen werden
 */

// * can be used to filter all current layers in the viewport (or another area) for layers or a certain type
// * e.g. all features with type or class == park is possible, but it doesn't seem to be very complete (not suitable for query!)
export function getAllRenderedFeatures(
  bbox?: [mapboxgl.PointLike, mapboxgl.PointLike] | [number, number] | mapboxgl.Point,
  layers?: string[],
  filter?: any[]
): void {
  console.log("getting queryRenderedFeatures:");
  /**
   * The geometry of the query region: either a single point or southwest and northeast points describing a
   * bounding box. Omitting this parameter (i.e. calling Map#queryRenderedFeatures with zero arguments, or
   * with only a options argument) is equivalent to passing a bounding box encompassing the entire map viewport.
   */
  const features = map.queryRenderedFeatures(bbox, {
    layers: layers,
    filter: filter,
  });

  console.log("Features: ", features);

  /*
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
  */
}

// * should be used to filter own existing geojson or vector sources on the map (e.g. a specific layer or
// * all points from a layer with a specific property)
/**
 * Source Id can be either the id of a vector tile or of a geojson source.
 * Filter looks like: filter:['==', 'my_attribute', value ]
 */
export function getAllSourceFeatures(sourceID: string, sourceLayer?: string, filter?: any[]): void {
  console.log("getting querySourceFeatures:");
  /**
   * In contrast to Map#queryRenderedFeatures, this function returns all features matching the
   * query parameters, whether or not they are rendered by the current style (i.e. visible).
   */
  const features = map.querySourceFeatures(sourceID, {
    sourceLayer: sourceLayer,
    filter: filter,
  });

  console.log("Features: ", features);
}

export function getMapFeaturesForFilters(filters: Set<string>): mapboxgl.MapboxGeoJSONFeature[] {
  console.log("Getting data for filters: ", filters);

  const allGeoData: mapboxgl.MapboxGeoJSONFeature[] = [];
  for (const el of filters) {
    const features = map.querySourceFeatures(el);
    allGeoData.push(...features);
  }

  return allGeoData;
}

function convertToMercatorCoordinates(arr: number[][]): number[] {
  const MercatorCoordinates = arr.map((el) =>
    mapboxgl.MercatorCoordinate.fromLngLat(el as LngLatLike)
  );
  //console.log("Mercator:", MercatorCoordinates);

  return MercatorCoordinates.flatMap((x) => [x.x, x.y]);
}

export function getDataFromMap(filters: Set<string>): number[] {
  const allGeoData = getMapFeaturesForFilters(filters);
  console.log("QuerySourceFeatures: ");
  console.log(allGeoData);

  const allCoordinates: number[] = [].concat(
    //@ts-expect-error
    ...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))
  );
  //console.log(allCoordinates);

  // divide the coords in pairs of two with lodash
  const pointCoords = chunk(allCoordinates, 2);
  //console.log("newArray after lodash:", pointCoords);

  const customData = convertToMercatorCoordinates(pointCoords);
  //console.log(customData);
  return customData;
}
