import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import mapboxgl from "mapbox-gl";
import { getTilequeryResults } from "../network/networkUtils";

const tileset = "mapbox.mapbox-streets-v8"; // tileset id
const tilequeryApiString = `https://api.mapbox.com/v4/${tileset}/tilequery/`;
const radius = 2500; // in meters
const maxCount = 50; // the maximum amount of results to return

type GeometryTypes = "point" | "linestring" | "polygon";

/**
 * This file provides access to the Tilequery API from Mapbox.
 */
export async function queryAllTiles(
  point: [number, number],
  r = radius,
  limit = maxCount
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  //* 2 Probleme mit TilequeryAPI:
  //* - limit kann maximal 50 sein
  //* - immer nur points als antwort: The Tilequery API does not return the full geometry of a feature. Instead, it returns the closest point ({longitude},{latitude}) of a feature.
  const query = `${tilequeryApiString}${point[0]},${point[1]}.json?radius=${r}&limit=${limit}&dedupe&access_token=${mapboxgl.accessToken}`;

  const result = await getTilequeryResults(query);
  console.log(result);
  return result;
}

export async function queryLayers(
  point: [number, number],
  layers: string | string[],
  r = radius,
  limit = maxCount
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  let layerString = "";
  if (typeof layers === "string") {
    layerString = layers;
  } else {
    layerString = layers.join();
  }

  const query = `${tilequeryApiString}${point[0]},${point[1]}.json?radius=${r}&limit=${limit}&layers=${layerString}&access_token=${mapboxgl.accessToken}`;
  const result = await getTilequeryResults(query);
  console.log(result);
  return result;
}

export async function queryGeometry(
  point: [number, number],
  geometryType: GeometryTypes,
  r = radius,
  limit = maxCount
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  const query = `${tilequeryApiString}${point[0]},${point[1]}.json?radius=${r}&limit=${limit}&geometry=${geometryType}&access_token=${mapboxgl.accessToken}`;

  const result = await getTilequeryResults(query);
  console.log(result);
  return result;
}

//*Query multiple maps/tilesets with:
//"https://api.mapbox.com/v4/{tileset_id_1},{tileset_id_2},{tileset_id_3}/tilequery/..."
