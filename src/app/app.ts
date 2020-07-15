/* eslint-env browser */
import MapController from "./mapController";
import Benchmark from "../shared/benchmarking";
import { fetchOsmData } from "./utils/networkUtils";
import { Config } from "../shared/config";

export const parameterSelection: Set<string> = new Set();

const LIST_TEMPLATE = document.querySelector("#li-template")?.innerHTML.trim();

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

function selectData(e: Event, mapController: MapController): void {
  e.stopPropagation();
  e.preventDefault();

  const queryInput = document.querySelector("#query-input") as HTMLInputElement;
  const value = (e.target as HTMLAnchorElement).innerText;
  const key = getKeyType(value); //TODO: flexibler machen!
  const query = key + "=" + value;
  queryInput.value = query;

  const selectionBox = document.querySelector(".selection-box") as HTMLDivElement;
  const list = document.querySelector("#selection-list") as HTMLUListElement;

  //TODO: actually the visible features on the map should be shown in the box (not what is clicked!)

  // check if that list element already exists to prevent adding it twice
  for (const el of list.getElementsByTagName("li")) {
    if (el.textContent?.trim() === query) {
      return;
    }
  }

  const containerElement = document.createElement("div");
  containerElement.innerHTML = LIST_TEMPLATE as string;
  const listEl = containerElement.firstChild as ChildNode;
  // get the close button for the list element
  const closeButton = containerElement.firstChild?.childNodes[1] as ChildNode;

  // add the selected data to the list element and append the list element
  listEl.appendChild(document.createTextNode(query));
  list.appendChild(listEl);

  parameterSelection.add(query.toLowerCase());

  // remove the list element when its close button is clicked
  closeButton.addEventListener("click", function (this: ChildNode) {
    const listElement = this.parentElement as Node;
    list.removeChild(listElement);
    parameterSelection.delete(query.toLowerCase());

    // remove data from the map as well
    const textContent = listElement.textContent?.trim();
    if (textContent) {
      mapController.removeData(textContent.toLowerCase());
    }

    // check if there are other list elements, if not hide selection box
    if (list.children.length === 0) {
      selectionBox.classList.add(Config.CSS_HIDDEN);
    }
  });

  // show selection box
  selectionBox.classList.remove(Config.CSS_HIDDEN);
}

function setupUI(mapController: MapController): void {
  const getDataButton = document.querySelector("#getOSM");
  if (getDataButton) {
    getDataButton.addEventListener("click", test);
  }

  //testVectorTileAPI(mapController);
  /*
  mapController.addVectorData(
    "http://localhost:8080/data/countries/{z}/{x}/{y}.pbf"
  );
  */

  const dropdownList = document.querySelector(".dropdown-content");
  if (dropdownList) {
    dropdownList.addEventListener("click", function (ev) {
      selectData(ev, mapController);
    });
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
      const bounds = mapController.getViewportBounds();

      Benchmark.startMeasure("Fetching data from osm");
      // request data from osm
      const data = await fetchOsmData(bounds, query);
      console.log(Benchmark.stopMeasure("Fetching data from osm"));

      if (data) {
        const t0 = performance.now();
        mapController.showData(data, query);
        const t1 = performance.now();
        console.log("Adding data to map took " + (t1 - t0).toFixed(3) + " milliseconds.");

        console.log("Finished adding data to map!");
      }
    });
  }
}

async function init(): Promise<void> {
  try {
    const mapController = new MapController("map");
    mapController.setupMap(setupUI);
  } catch (error) {
    console.log(error);
  }
}

init();
