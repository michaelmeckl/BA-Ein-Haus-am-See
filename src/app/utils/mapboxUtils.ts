/**
 * Utility-Methods for working with Mapbox Gl.
 */
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
import { map } from "../map/mapConfig";
import { parameterSelection } from "../main";
import { chunk } from "lodash";
import cleanCoords from "@turf/clean-coords";
import { addTurfCircle } from "../map/mapFunctions";

export function getDataforFeaturesInSelection() {
  console.log(parameterSelection.entries);

  const allGeoData: mapboxgl.MapboxGeoJSONFeature[] = [];
  for (const el of parameterSelection) {
    const features = map.querySourceFeatures(el);
    allGeoData.push(...features);
  }

  //TODO: doesn'T work
  console.log(allGeoData);
  allGeoData.forEach((li) => {
    const newData = cleanCoords(li);
    console.log(newData);
  });
  //const newData = cleanCoords(allGeoData);
  //console.log(newData);

  return allGeoData;
}

export function getDataFromMap() {
  const allGeoData = getDataforFeaturesInSelection();
  console.log("QuerySourceFeatures: ");
  console.log(allGeoData);

  //console.log(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3)));
  const testData: number[] = [].concat(
    ...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))
  );
  console.log(testData);
  const newArray = chunk(testData, 2);
  console.log("newArray after lodash:", newArray);

  //TODO: remove me later
  newArray.forEach((element) => {
    addTurfCircle(element, 0.5);
  });

  const MercatorCoordinates = newArray.map((el) => mapboxgl.MercatorCoordinate.fromLngLat(el));
  console.log("Mercator:", MercatorCoordinates);
  /*
    console.log([].concat(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))));
    console.log(allGeoData.flatMap((el) => [].concat(el.geometry.coordinates.flat(3))));

    console.log(allGeoData.flatMap((el) => [].concat(...el.geometry.coordinates.flat(3))));
    console.log(
      allGeoData.flatMap((el) =>
        [].concat(...el.geometry.coordinates.flatMap((li) => [li.x, li.y]))
      )
    );
    */

  //TODO
  /*
    allGeoData.forEach((el) => {
      console.log(el.properties?.type);
      console.log(el.geometry.coordinates);
      console.log(...el.geometry.coordinates);
    });

    for (const el of allGeoData) {
      console.log(...this.flatten(el.geometry.coordinates));
    }
    */

  //const test = mapboxgl.MercatorCoordinate.fromLngLat({geoData});

  /*
    const data = [uniSouthWest, uniSouthEast, uniNorthWest, uniNorthEast];
    const flatData = data.flatMap((x) => [x.x, x.y]);
    */

  //const customData = [uniNorthEast.x, uniNorthEast.y, uniSouthWest.x, uniSouthWest.y];
  const customData = MercatorCoordinates.flatMap((x) => [x.x, x.y]);
  console.log(customData);
  return customData;
}

function addIconLayer(map: mapboxgl.Map, sourceName: string): void {
  map.addLayer({
    id: sourceName + "-symbol",
    type: "symbol",
    source: sourceName,
    layout: {
      "icon-image": [
        "match",
        ["get", "amenity", ["get", "tags"]],
        "bar",
        "bar-11",
        "marker-11", // other
      ],
      "icon-allow-overlap": true,
    },
  });
}

/**
 * Find the first layer with the given type and return its id (or undefined if no layer with that type exists).
 */
export function findLayerByType(map: mapboxgl.Map, layerType: string): string | undefined {
  const layers = map.getStyle().layers;

  if (layers) {
    for (const layer of layers) {
      if (layer.type === layerType) {
        return layer.id;
      }
    }
  }
  return undefined;
}

/**
 * Delete all layers for the source with the given ID.
 */
export function removeAllLayersForSource(map: mapboxgl.Map, sourceID: string): boolean {
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

/**
 * Update the data source of a given source layer. MUST be a GeoJson layer.
 */
export function updateLayerSource(map: mapboxgl.Map, id: string, data: string): boolean {
  if (map.getSource(id)?.type !== "geojson") {
    return false;
  }
  const result = (map.getSource(id) as GeoJSONSource).setData(data);
  return result ? true : false;
}
