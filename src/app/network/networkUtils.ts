import axios from "axios";
import * as rax from "retry-axios";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  GeometryObject,
  MultiPolygon,
  Polygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";
import Benchmark from "../../shared/benchmarking";
import geobuf from "geobuf";
import Pbf from "pbf";

// attach the retry interceptor to the global axios instance, so all requests are retried if they fail
const interceptorId = rax.attach();

//TODO mögliches Perf-Problem: man kann immer nur einen poitype gleichzeitig suchen, d.h. es müssen mehrere
//TODO  hintereinander ausgeführt werden; keine Parallelisierung wie bei Overpass API möglich!
export async function testGuide(): Promise<any> {
  try {
    Benchmark.startMeasure("Request client side");
    const url = `http://127.0.0.1:8553/v1/guide?radius=${50000}&limit=${500}&poitype=${"bar"}&lng=${12.1}&lat=${49.008}`;
    //* diese query funktioniert: (limit ist nötig, sonst ist default 50)
    // http://localhost:8553/v1/guide?radius=20000&limit=200&poitype=bar&lng=12.1&lat=49.008

    //* search bringt eher nichts
    //http://localhost:8553/v1/search?limit=100&search=park

    //TODO kann das limit auch z.B. 10000 sein?? oder gibts da ne grenze?
    //* gibt offenbar keine, z.B. radius 500km und limit 30000 geht, aber es dauert relativ lange (ca. 16s)

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log("resonse:", response);
    console.log("resonse.data.results:", response.data.results);

    Benchmark.startMeasure("o2geo client");
    //TODO das ergebnis von guide ist kein json, das mit osmtogeojson in geojson umgewandelt werden könnte
    // -> muss also zunächst noch geparst werden (wir vermutlich etwas länger dauern als omstogeojson, da nicht einfach nur json -> geojson)
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
  //const request = `nwr[${userQuery}];`;

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

  const query = `${querySettings}(${userQuery});${output}`;
  console.log(query);
  return query;
}

function buildParallelOverpassQuery(bounds: string): string {
  const request = `nwr[amenity=cafe];`;
  const request2 = `nwr[amenity=bar];`;
  const request3 = `nwr[amenity=restaurant];`;
  const request4 = `nwr[leisure=park];`;
  const request5 = `nwr[building=university];`;
  const request6 = `nwr[shop=supermarket];`;
  const request7 = `nwr[waterway=river];`;

  const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;

  const output = "out geom qt;";
  const query = `${querySettings}(${request}${request2}${request3}${request4}${request5}${request6}${request7});${output}`;
  console.log(query);
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
export async function fetchOsmData(
  mapBounds: string,
  query: string
): Promise<FeatureCollection<GeometryObject, any> | null> {
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
    console.log(url);

    Benchmark.startMeasure("Request client side");

    const response = await axios.get(url);
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log(response);

    Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(response.data);
    Benchmark.stopMeasure("o2geo client");

    return geoJson as FeatureCollection<GeometryObject, any>;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// benchmark version sequential
// langsamer als parallel um ca. 2100 ms
export async function fetchOsmDataFromClientVersionSequential(
  mapBounds: string,
  query: string
): Promise<void> {
  try {
    const queries = [
      "amenity=cafe",
      "amenity=bar",
      "amenity=restaurant",
      "leisure=park",
      "building=university",
      "shop=supermarket",
      "waterway=river",
    ];

    for (const q of queries) {
      const overpassQuery = new URLSearchParams({
        data: buildOverpassQuery(mapBounds, q),
      });
      console.log(q);
      Benchmark.startMeasure("Request client side");
      //const url = `https://overpass-api.de/api/interpreter?${overpassQuery}`;
      const url = `http://192.168.99.100:12347/api/interpreter?${overpassQuery}`;

      const response = await axios.get(url);
      console.log(response.data);
      console.log(Benchmark.stopMeasure("Request client side"));
    }
  } catch (error) {
    console.error(error);
  }
}

// benchmark version parallel (ca. 6696 ms über 30 Iterationen)
export async function fetchOsmDataFromClientVersionParallel(
  mapBounds: string,
  query: string
): Promise<void> {
  try {
    const overpassQuery = new URLSearchParams({
      data: buildParallelOverpassQuery(mapBounds),
    });

    //Benchmark.startMeasure("Request client side");
    //const url = `https://overpass-api.de/api/interpreter?${overpassQuery}`;
    const url = `http://192.168.99.100:12347/api/interpreter?${overpassQuery}`;
    const response = await axios.get(url);
    console.log(response.data);
    //console.log(Benchmark.stopMeasure("Request client side"));
    //const geoJson = osmtogeojson(response.data);
    //Benchmark.stopMeasure("o2geo client");

    //return geoJson;
  } catch (error) {
    console.error(error);
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

export async function fetchMaskData(query: string): Promise<any> {
  try {
    const params = new URLSearchParams({
      filter: query,
    });
    const url = "/getMask?" + params;

    Benchmark.startMeasure("Request get mask");

    const response = await axios({
      url: url,
      //responseType: "arraybuffer", // default is json,
      raxConfig: {
        // Retry 3 times on requests that return a response (500, etc) before giving up.  Defaults to 3.
        retry: 3,
        onRetryAttempt: (err): void => {
          const cfg = rax.getConfig(err);
          console.log(`Retrying request to /getMask! Attempt #${cfg?.currentRetryAttempt}`);
        },
      },
    });
    Benchmark.stopMeasure("Request get mask");

    console.log(response.data);
    /*
    const geoJson = osmtogeojson(response.data);
    return geoJson;
    */
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}
