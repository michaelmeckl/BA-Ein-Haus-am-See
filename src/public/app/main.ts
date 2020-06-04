/* eslint-env browser */
import MapController from "./mapController";

async function fetchAccessToken(): Promise<string | null> {
  const token = await fetch("/token", {
    method: "GET",
    cache: "no-cache",
  })
    .then((response) => response.text())
    .then((data) => {
      return data;
    })
    .catch((err) => {
      console.log("Fetch problem: " + err.message);
      return null;
    });

  return token;
}

async function test(): Promise<void> {
  console.log("NOT IMPLEMENTED:\nFetching data from osm ...");
}

//TODO:
//- Laden von Daten über die Overpass API dem Anwender anzeigen, z.B. mit einem Ladebalken oder einer snackbar
//- Fehlerbehandlung, falls die Overpass API einen Timeout wegen zu großer Datenmenge erzeugt
async function fetchOsmData(
  mapBounds: string,
  query: string
): Promise<string | null> {
  try {
    console.log("sending request!");
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "/osmRequest?" + params;

    console.log("url:" + url);

    const response = await fetch(url, {
      method: "GET",
    });

    console.log(response);

    if (!response.ok) {
      throw new Error(
        `Request failed! Status ${response.status} (${response.statusText})`
      );
    }

    //TODO: is blob more efficient than url?
    //TODO: 2.only send status code in response when only url is used??
    console.log(await response.blob());

    //const answer = await response.text();
    //console.log("Answer:", answer);
    return response.url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function setupUI(mapController: MapController): void {
  const getDataButton = document.querySelector("#getOSM");
  if (getDataButton) {
    getDataButton.addEventListener("click", test);
  }

  const queryInput = document.querySelector("#query-input") as HTMLInputElement;
  const queryButton = document.querySelector("#query-button");
  if (queryButton && queryInput) {
    queryButton.addEventListener("click", async () => {
      // get input
      const query = queryInput.value;

      //TODO: let user choose bounding box?
      //ganz Regensburg: 12.028,48.966,12.192,49.076
      //kleinerer Teil: 12.06075,48.98390,12.14537,49.03052
      const bounds = mapController.getCurrentBounds();

      let t0 = performance.now();
      // request data from osm
      const data = await fetchOsmData(bounds, query);
      let t1 = performance.now();
      console.log("Fetching data took " + (t1 - t0) + " milliseconds.");

      if (data) {
        t0 = performance.now();
        mapController.showData(data, "points");
        t1 = performance.now();
        console.log("Adding data to map took " + (t1 - t0) + " milliseconds.");

        console.log("Finished adding data to map!");
      }
    });
  }
}

async function init(): Promise<void> {
  try {
    const token = await fetchAccessToken();
    if (!token) {
      throw new Error("Map couldn't be loaded: Invalid Mapbox Token provided!");
    }

    const mapController = new MapController(token, "map");

    //TODO: call this only AFTER the map has been successfully loaded?
    setupUI(mapController);
  } catch (error) {
    console.log(error);
  }
}

init();
