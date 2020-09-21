/**
 * Utility-Methods for working with Mapbox Gl.
 */
import type { GeoJSONSource } from "mapbox-gl";
import { map } from "./mapboxConfig";
import { queryAllTiles, queryGeometry, queryLayers } from "./tilequeryApi";

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

export function removeSource(sourceName: string): void {
  if (!map.getSource(sourceName)) {
    console.warn(`Couldn't remove source ${sourceName}`);
    return;
  }
  removeAllLayersForSource(map, sourceName);
  map.removeSource(sourceName);
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
