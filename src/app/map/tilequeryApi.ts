import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import mapboxgl from "mapbox-gl";
import { getTilequeryResults } from "../network/networkUtils";

const tileset = "mapbox.mapbox-streets-v8"; // tileset id
const radius = 2500; // in meters
const maxCount = 50; // the maximum amount of results to return

/**
 * This file provides access to the Tilequery API from Mapbox.
 */
export async function queryTiles(
  point: [number, number],
  r = radius,
  limit = maxCount
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
  const query = `https://api.mapbox.com/v4/${tileset}/tilequery/${point[0]},${point[1]}.json?radius=${r}&limit=${limit}&access_token=${mapboxgl.accessToken}`;
  //TODO
  //const q = "& dedupe & geometry=point &layers=poi_label";

  //* limit is max. 50

  //Query multiple maps

  //curl "https://api.mapbox.com/v4/{tileset_id_1},{tileset_id_2},{tileset_id_3}/tilequery/-122.42901,37.80633.json&access_token=YOUR_MAPBOX_ACCESS_TOKEN"

  // Return only results from the poi_label and building layers within a 30 meter radius of the specified location

  // curl "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/-122.42901,37.80633.json?radius=30&layers=poi_label,building&access_token=YOUR_MAPBOX_ACCESS_TOKEN"

  //* immer nur points als antwort: The Tilequery API does not return the full geometry of a feature. Instead, it returns the closest point ({longitude},{latitude}) of a feature.

  const result = await getTilequeryResults(query);
  console.log(result);
  return result;
}
