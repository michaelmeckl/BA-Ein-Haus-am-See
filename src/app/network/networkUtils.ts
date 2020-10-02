import axios from "axios";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import osmtogeojson from "osmtogeojson";
import Benchmark from "../../shared/benchmarking";

export async function testGuide(): Promise<any> {
  try {
    Benchmark.startMeasure("Request client side");
    const url = `http://127.0.0.1:8553/v1/guide?radius=${5000}&limit=${50}&poitype=${"bar"}&lng=${12.1}&lat=${49.008}`;
    //* diese query funktioniert: (limit ist nötig, sonst ist default 50)
    // http://localhost:8553/v1/guide?radius=20000&limit=200&poitype=bar&lng=12.1&lat=49.008

    //* search bringt eher nichts
    //http://localhost:8553/v1/search?limit=100&search=park

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log("resonse:", response);
    console.log("resonse.data.results:", response.data.results);

    Benchmark.startMeasure("o2geo client");
    //TODO das ergebnis von guide ist kein json, das mit osmtogeojson in geojson umgewandelt werden könnte
    const geoJson = osmtogeojson(response.data.results);
    Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getTilequeryResults(query: string): Promise<FeatureCollection> {
  const result = await axios.get(query);
  return result.data as FeatureCollection<Geometry, GeoJsonProperties>;
}

//TODO:
//- Laden von Daten über die Overpass API dem Anwender anzeigen, z.B. mit einem Ladebalken oder einer snackbar
//- Fehlerbehandlung, falls die Overpass API einen Timeout wegen zu großer Datenmenge erzeugt

function buildOverpassQuery(bounds: string, userQuery: string): string {
  // shorthand for query instead of 3 separate ones (nwr = node, way, relation)
  const request = `nwr[${userQuery}];`;

  /*TODO: support different types and conjunctions: -> query vllt schon ganz in client bauen?
  * AND:
  nwr[${userQuery1}][${userQuery2}]...;
  * OR - different key:
  nwr[${userQuery1}];
  nwr[${userQuery2}];
  ...
  * OR - same key, different values:
  nwr[${userQuery1}];   // in the form of ["key"~"value1|value2|value3|..."] -> no whitespace between! (regex)
  */

  // output-format json, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
  const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;

  const output = "out geom qt;"; // use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)

  /*
  const output1 = "out;>;out skel qt;";;
  const output2 = "out geom qt;>;out skel qt;";
  const output3 = "out geom qt;<;out skel qt;";
  */

  const query = `${querySettings}(${request});${output}`;
  return query;
}

//TODO: use a webworker instead to load data async? better ux?
export async function fetchOsmDataFromClientVersion(
  mapBounds: string,
  query: string
): Promise<any> {
  try {
    console.log("sending request!");
    const overpassQuery = new URLSearchParams({
      data: buildOverpassQuery(mapBounds, query),
    });

    Benchmark.startMeasure("Request client side");
    // online overpass api
    const url = `https://overpass-api.de/api/interpreter?${overpassQuery}`;

    // local overpass api (docker image)
    //const url = `https://192.168.99.100:12345/api/interpreter?${overpassQuery}`;

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    //console.log(response);
    // * measure time over 50 trials with this:
    //console.log(await Benchmark.getAverageTime(osmtogeojson, [response.data]));

    Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(response.data);
    Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getStyle(url: string) {
  const response = await axios.get(url);
  console.log(response);
  return response.data;
}

export async function getPoiTypes() {
  const url = "http://192.168.178.43:8553/v1/poi_types";
  const response = await axios.get(url);
  console.log(response);
  return response.data;
}

//TODO
export async function fetchOsmData(mapBounds: string, query: string): Promise<any> {
  try {
    //TODO delete me later
    //const antwort = await axios.get("/testCmd");
    //console.log("Serverantwort: ", antwort);

    console.log("sending request!");
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    //const url = "/osmRequestPbfVersion?" + params; //TODO osmtogeojson has to be commented out to work with this
    const url = "/osmRequestCacheVersion?" + params;

    Benchmark.startMeasure("Request client side");

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log(response.data);

    Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(response.data);
    Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/*
// old fetch version
export async function fetchOsmData(mapBounds: string, query: string): Promise<string | null> {
  try {
    console.log("sending request!");
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "/osmRequest?" + params;

    Benchmark.startMeasure("Request client side");
    const response = await fetch(url, {
      method: "GET",
    });
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log(response);

    if (!response.ok) {
      throw new Error(`Request failed! Status ${response.status} (${response.statusText})`);
    }

    Benchmark.startMeasure("Get Json from response");
    const osmData = await response.json();
    console.log(Benchmark.stopMeasure("Get Json from response"));
    return osmData;
  } catch (error) {
    console.error(error);
    return null;
  }
}
*/
