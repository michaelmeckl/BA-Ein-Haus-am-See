import type { FeatureCollection, GeometryObject } from "geojson";
import osmtogeojson from "osmtogeojson";
//import * as rax from "retry-axios";
import Benchmark from "../../shared/benchmarking";
//import axios from "axios";
import axios from "./axiosInterceptor";

// attach the retry interceptor to the global axios instance, so all requests are retried if they fail
//const interceptorId = rax.attach();

/**
 * OSM Scout Requests
 */

/*
function parseOsmScoutResponse(response: any): FeatureCollection<GeometryObject, any> {
  const allLocations = [];

  for (const element of response) {
    allLocations.push(
      point([element.lng, element.lat], {
        distance: element.distance,
        title: element.title,
        type: element.type,
      })
    );
  }
  return featureCollection(allLocations);
}

//! mögliches Perf-Problem: man kann immer nur einen poitype gleichzeitig suchen, d.h. es müssen mehrere
//! hintereinander ausgeführt werden; keine Parallelisierung wie bei Overpass API möglich!
//! außerdem erhalte ich nur point data (flüsse scheinen nicht zu gehen?)
export async function testGuide(poiType: string): Promise<any> {
  try {
    Benchmark.startMeasure("Request client side");
    const url = `http://192.168.178.45:8553/v1/guide?radius=${100000}&limit=${100000}&poitype=${poiType}&lng=${12.136}&lat=${49.402}`;
    //* limit ist nötig, sonst ist default 50

    //* gibt offenbar keine, z.B. radius 500km und limit 30000 geht, aber es dauert relativ lange (ca. 16s)

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log("resonse:", response);
    console.log("resonse.data.results:", response.data.results);

    Benchmark.startMeasure("o2geo client");
    // das ergebnis von guide ist kein json, das mit osmtogeojson in geojson umgewandelt werden könnte
    // -> muss also zunächst noch geparst werden
    const geoJson = parseOsmScoutResponse(response.data.results);
    Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    console.error(error);
    return null;
  }
}
*/

/**
 * Overpass Requests
 */
function buildOverpassQuery(bounds: string, userQuery: string): string {
  // output-format json, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
  const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;
  const output = "out geom qt;"; // use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)
  const query = `${querySettings}(${userQuery});${output}`;
  //console.log(query);
  return query;
}

export async function fetchOsmDataFromClientVersion(
  mapBounds: string,
  query: string
): Promise<any> {
  try {
    //console.log("sending request!");
    const overpassQuery = new URLSearchParams({
      data: buildOverpassQuery(mapBounds, query),
    });

    //Benchmark.startMeasure("Request client side");
    // online overpass api
    const url = `https://overpass-api.de/api/interpreter?${overpassQuery}`;

    // local overpass api (docker image)
    //const url = `https://192.168.99.100:12345/api/interpreter?${overpassQuery}`;

    const response = await axios.get(url, { timeout: 7000 });
    //console.log(Benchmark.stopMeasure("Request client side"));

    //console.log(response);
    // * measure time over 50 trials with this:
    //console.log(await Benchmark.getAverageTime(osmtogeojson, [response.data]));

    //Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(response.data);
    //Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    //console.error(error);
    return null;
  }
}

export async function fetchOsmDataFromServer(
  mapBounds: string,
  query: string
): Promise<FeatureCollection<GeometryObject, any> | null> {
  try {
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "/osmRequestCache?" + params;

    //Benchmark.startMeasure("Request client side");

    // set a timeout of 7 seconds
    const response = await axios.get(url, { timeout: 7000 });
    //console.log(Benchmark.stopMeasure("Request client side"));

    //console.log(response);

    //Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(response.data);
    //Benchmark.stopMeasure("o2geo client");

    return geoJson as FeatureCollection<GeometryObject, any>;
  } catch (error) {
    //console.error(error);
    return null;
  }
}
