/* eslint-env node */
import Benchmark from "../shared/benchmarking";
import osmtogeojson from "osmtogeojson";
import xmldom from "xmldom";
import Util from "util";
import os from "os";
import childProcess from "child_process";
import axios from "axios";
import querystring from "querystring";
import type { GeoJsonObject } from "geojson";

const exec = Util.promisify(childProcess.exec);

/**
 * Builds a query for the overpass api to fetch osm data as GeoJson in the given map bounds.
 */
export function buildOverpassQuery(bounds: string, userQuery: string): string {
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
    nwr[${userQuery1}];   // in the form of ["key"~"^value1|value2|value3|...$"] -> no whitespace between! (regex)
    */

  // TODO: what is the best output format: xml or json?
  // output-format json, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
  const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;

  // use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)
  const output = "out geom qt;";
  /*
    const output1 = "out;>;out skel qt;";;
    const output2 = "out geom qt;>;out skel qt;";
    const output3 = "out geom qt;<;out skel qt;";
    */

  const query = `${querySettings}(${userQuery});${output}`;
  return query;
}

export async function performOverpassRequest(params: string): Promise<GeoJsonObject | Document> {
  Benchmark.startMeasure("Overpass API Request");
  const response = await axios.get(`https://overpass-api.de/api/interpreter?${params}`);
  //const response = await axios.get(`http://192.168.99.101:12345/api/interpreter?${params}`);
  console.log(Benchmark.stopMeasure("Overpass API Request"));

  //console.log(response.data);
  const contentType = response.headers["content-type"];

  if (contentType.endsWith("json")) {
    return response.data as GeoJsonObject;
  } else if (contentType.endsWith("xml")) {
    const parser = new xmldom.DOMParser();
    return parser.parseFromString(response.data);
  }
  throw new Error("Content type not supported!");
}

export async function getDataFromOSM(query: string): Promise<any> {
  const encodedQuery = querystring.stringify({ data: query });
  console.log(encodedQuery);

  Benchmark.startMeasure("Requesting and parsing data from overpass");
  const data = await performOverpassRequest(encodedQuery);
  console.log(Benchmark.stopMeasure("Requesting and parsing data from overpass"));

  Benchmark.startMeasure("OsmtoGeojson");
  const geoJson = osmtogeojson(data);
  console.log(Benchmark.stopMeasure("OsmtoGeojson"));

  return geoJson;
}

/**
 * Returns a string identifying the operating system platform. The value is set at compile time.
 * Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.
 */
function getPlatform(): string {
  return os.platform();
}

export async function executeOSMFilter(path: string): Promise<string | null> {
  const platform = getPlatform();
  let script: string;

  if (platform === "win32") {
    //script = `${path}/assets/osmconvert.exe ${path}/assets/ny_extract.osm.pbf --drop-author -o=${path}/assets/new.osm.pbf`;
    script = `dir "${path}/assets"`;
  } else if (platform === "linux") {
    script = "ls";
  } else {
    console.error("Only Windows and Linux are supported at the moment!");
    return null;
  }

  try {
    const { stdout, stderr } = await exec(script);

    // the *entire* stdout and stderr (buffered)
    console.log("stdout: " + stdout);
    console.log("stderr: " + stderr);
    return stdout;
  } catch (error) {
    // node couldn't execute the command
    console.log("exec error: " + error);
    return null;
  }
}

// executes command line scripts
export async function executeScript(script: string): Promise<void> {
  // TODO: check for correct os!
  const platform = getPlatform();
  let exampleScript: string;

  if (platform === "win32") {
    exampleScript = "docker -v";
    //TODO: use cmd (or test.bat)
  } else if (platform === "linux") {
    exampleScript = "ls";
    //TODO: use test.sh
  } else {
    console.error("Only Windows and Linux are supported at the moment!");
    return;
  }

  try {
    const { stdout, stderr } = await exec(script);

    // the *entire* stdout and stderr (buffered)
    console.log("stdout: " + stdout);
    console.log("stderr: " + stderr);
  } catch (error) {
    // node couldn't execute the command
    console.log("exec error: " + error);
    return;
  }
}

//TODO: spawn besser für memory-intensive tasks!

export async function executeFile(command: string): Promise<void> {
  const script = exec("sh test.sh /myDir");

  script.child.on("data", (data) => {
    console.log(data);
  });

  script.child.on("error", (error) => {
    console.log(error);
  });

  console.log((await script).stdout);
}
