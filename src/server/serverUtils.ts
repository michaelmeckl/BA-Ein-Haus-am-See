/* eslint-env node */

//const exec = Util.promisify(childProcess.exec);

/**
 * Builds a query for the overpass api to fetch osm data as GeoJson in the given map bounds.
 */
export function buildOverpassQuery(bounds: string, userQuery: string): string {
  // output-format json, runtime of max. 25 seconds (needs to be higher for more complex queries) and global bounding box
  const querySettings = `[out:json][timeout:25][bbox:${bounds}];`;
  const output = "out geom qt;"; // use "qt" to sort by quadtile index (sorts by location and is faster than sort by id)
  const query = `${querySettings}(${userQuery});${output}`;
  //console.log(query);
  return query;
}

/**
 * TODO the code below is only needed for executing local cmd scripts! (not used right now)
 */

/*
//Returns a string identifying the operating system platform. The value is set at compile time.
//Possible values are 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'.

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
  // TODO check for correct os!
  const platform = getPlatform();
  let exampleScript: string;

  if (platform === "win32") {
    exampleScript = "docker -v";
    //TODO use cmd (or test.bat)
  } else if (platform === "linux") {
    exampleScript = "ls";
    //TODO use test.sh
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

//TODO spawn besser für memory-intensive tasks!

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
*/
