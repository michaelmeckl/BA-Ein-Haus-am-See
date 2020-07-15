import Benchmark from "../../shared/benchmarking";
import osmtogeojson from "osmtogeojson";
import axios from "axios";

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
export async function fetchOsmData(mapBounds: string, query: string): Promise<any | null> {
  try {
    console.log("sending request!");
    Benchmark.startMeasure("Request client side");
    /*
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "http://localhost:8000/osmRequest?" + params;
    */

    const overpassQuery = new URLSearchParams({
      data: buildOverpassQuery(mapBounds, query),
    });
    const url = `https://overpass-api.de/api/interpreter?${overpassQuery}`;

    const response = await axios.get(url);
    /*
    const response = await fetch(url, {
      method: "GET",
    });
    const osmData = await response.json();
    */
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log(response);
    const osmData = await response.data;

    Benchmark.startMeasure("o2geo client");
    const geoJson = osmtogeojson(osmData);
    Benchmark.stopMeasure("o2geo client");

    return geoJson;
  } catch (error) {
    console.error(error);
    return null;
  }
}
