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

async function testVectorTileAPI(c: MapController): Promise<void> {
  const url =
    "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/1/0/0.mvt?access_token=pk.eyJ1IjoibWljaGFlbG1lY2tsIiwiYSI6ImNrYWNyMnd1bjA5aHAycnByamgzZHd6bTEifQ.33Midnjfp-CccC19KMMJSQ";

  //const response = await fetch(url);
  //console.info(response);

  const test = "mapbox://michaelmeckl.ckajnwfb70hd62apmuw6m5rls-0pr4p";
  const url2 = "mapbox://mapbox.mapbox-streets-v8";

  c.addVectorData(test);
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

    //console.log("url:" + url);

    const response = await fetch(url, {
      method: "GET",
    });

    console.log(response);

    if (!response.ok) {
      throw new Error(
        `Request failed! Status ${response.status} (${response.statusText})`
      );
    }

    return response.url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

//TODO: auslagern in eigene Datei/Klasse (oder automatisch extrahieren??? -> vllt nicht so gut, da dann noch zusätzlich traffic?)
function getKeyType(val: string): string {
  switch (val) {
    case "Bar": // oder club, ...
    case "Restaurant":
    case "Cafe":
      return "amenity";

    case "University":
      return "building"; // could be amenity too if we want the whole campus

    case "Supermarket":
      return "shop";

    case "Park": // oder leisure	nature_reserve
      return "leisure";

    case "River":
      return "waterway";

    default:
      throw new Error("Unknown input value! Key couldn't be found!");
  }
}

function selectData(e: Event): void {
  e.stopPropagation();
  e.preventDefault();

  const queryInput = document.querySelector("#query-input") as HTMLInputElement;
  const value = (e.target as HTMLAnchorElement).innerText;
  const key = getKeyType(value); //TODO: flexibler! -> compund / union queries in overpass/osm möglich?
  queryInput.value = key + "=" + value;
}

function setupUI(mapController: MapController): void {
  const getDataButton = document.querySelector("#getOSM");
  if (getDataButton) {
    getDataButton.addEventListener("click", test);
  }

  //testVectorTileAPI(mapController);

  const dropdownList = document.querySelector(".dropdown-content");
  if (dropdownList) {
    dropdownList.addEventListener("click", selectData);
  }

  const showWebGLButton = document.querySelector("#showCustomData");
  if (showWebGLButton) {
    showWebGLButton.addEventListener(
      "click",
      mapController.addWebGlLayer.bind(mapController) // necessary to bind as the this context would be different in the addWebGL method otherwise
    );
  }

  const queryInput = document.querySelector("#query-input") as HTMLInputElement;
  const queryButton = document.querySelector("#query-button");
  if (queryButton && queryInput) {
    queryButton.addEventListener("click", async () => {
      // get input
      const query = queryInput.value.toLowerCase();

      //TODO: let user choose bounding box?
      //ganz Regensburg: 12.028,48.966,12.192,49.076
      //kleinerer Teil: 12.06075,48.98390,12.14537,49.03052
      const bounds = mapController.getCurrentBounds();

      let t0 = performance.now();
      // request data from osm
      const data = await fetchOsmData(bounds, query);
      let t1 = performance.now();
      console.log(
        "Fetching data took " + (t1 - t0).toFixed(3) + " milliseconds."
      );

      if (data) {
        t0 = performance.now();
        mapController.showData(data, "points");
        t1 = performance.now();
        console.log(
          "Adding data to map took " + (t1 - t0).toFixed(3) + " milliseconds."
        );

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
    mapController.setupMap(setupUI);
  } catch (error) {
    console.log(error);
  }
}

init();
