/* eslint-env browser */
import MapController from "./map/mapController";
import Benchmark from "../shared/benchmarking";
import { fetchOsmData } from "./utils/networkUtils";
import { Config } from "../shared/config";
import OsmTags from "./model/osmTagCollection";

export const parameterSelection: Set<string> = new Set();

// const enum inlines the elements at runtime, so the whole enum isn't needed at runtime
const enum HtmlElements {
  LIST_TEMPLATE_ID = "#li-template",
  // heading buttons
  SHOW_LOCATIONS_BUTTON_ID = "#showLocations",
  SHOW_CUSTOM_DATA_ID = "#showCustomData",
  // api controls
  QUERY_INPUT_ID = "#query-input",
  QUERY_BUTTON_ID = "#query-button",
  SELECTION_LIST_ID = "#selection-list",
  SELECTION_BOX_CLASS = ".selection-box",
  DROPDOWN_CONTENT_CLASS = ".dropdown-content",
  // sidebar
  CLOSE_SIDEBAR_BUTTON_CLASS = ".closeSidebar",
  // container elements
  SIDEBAR = "sidebar",
  MAP_CONTAINER = "mapContainer",
  MAP = "map",
}

const LIST_TEMPLATE = document.querySelector(HtmlElements.LIST_TEMPLATE_ID)?.innerHTML.trim();

/*
async function testVectorTileAPI(c: MapController): Promise<void> {
  const url =
    "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/1/0/0.mvt?access_token=pk.eyJ1IjoibWljaGFlbG1lY2tsIiwiYSI6ImNrYWNyMnd1bjA5aHAycnByamgzZHd6bTEifQ.33Midnjfp-CccC19KMMJSQ";

  //const response = await fetch(url);
  //console.info(response);

  const test = "mapbox://michaelmeckl.ckajnwfb70hd62apmuw6m5rls-0pr4p";
  const url2 = "mapbox://mapbox.mapbox-streets-v8";

  c.addVectorData(test);
}
*/

/* Set the width of the side navigation to 250px */
function openSidebar(): void {
  (document.getElementById(HtmlElements.SIDEBAR) as HTMLDivElement).style.width = "250px";
  (document.getElementById(HtmlElements.MAP_CONTAINER) as HTMLDivElement).style.marginLeft =
    "250px";
  (document.getElementById(HtmlElements.MAP) as HTMLDivElement).style.width = "calc(100% - 250px)";
}

/* Set the width of the side navigation to 0 */
function closeSidebar(): void {
  (document.getElementById(HtmlElements.SIDEBAR) as HTMLDivElement).style.width = "0";
  (document.getElementById(HtmlElements.MAP_CONTAINER) as HTMLDivElement).style.marginLeft = "0";
  (document.getElementById(HtmlElements.MAP) as HTMLDivElement).style.width = "100%";
}

async function showLocations(): Promise<void> {
  //console.log("NOT IMPLEMENTED:\nFetching data from osm ...");
  openSidebar();
}

function selectData(e: Event, mapController: MapController): void {
  e.stopPropagation();
  e.preventDefault();

  const queryInput = document.querySelector(HtmlElements.QUERY_INPUT_ID) as HTMLInputElement;
  const value = (e.target as HTMLAnchorElement).innerText;
  const key = OsmTags.getKeyType(value); //TODO: flexibler machen!
  const query = key + "=" + value;
  queryInput.value = query;

  const selectionBox = document.querySelector(HtmlElements.SELECTION_BOX_CLASS) as HTMLDivElement;
  const list = document.querySelector(HtmlElements.SELECTION_LIST_ID) as HTMLUListElement;

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

async function performOsmQuery(mapController: MapController, inputQuery: string): Promise<void> {
  //TODO: let user choose bounding box?
  //ganz Regensburg: 12.028,48.966,12.192,49.076
  //kleinerer Teil: 12.06075,48.98390,12.14537,49.03052
  const bounds = mapController.getViewportBounds();

  Benchmark.startMeasure("Fetching data from osm");
  // request data from osm
  const data = await fetchOsmData(bounds, inputQuery);
  console.log(Benchmark.stopMeasure("Fetching data from osm"));

  if (data) {
    const t0 = performance.now();
    mapController.showData(data, inputQuery);
    const t1 = performance.now();
    console.log("Adding data to map took " + (t1 - t0).toFixed(3) + " milliseconds.");

    console.log("Finished adding data to map!");
  }
}

function setupUI(mapController: MapController): void {
  const showLocationsButtton = document.querySelector(HtmlElements.SHOW_LOCATIONS_BUTTON_ID);
  if (showLocationsButtton) {
    showLocationsButtton.addEventListener("click", showLocations);
  }

  //testVectorTileAPI(mapController);
  /*
  mapController.addVectorData(
    "http://localhost:8080/data/countries/{z}/{x}/{y}.pbf"
  );
  */

  const closeSidebarButtton = document.querySelector(HtmlElements.CLOSE_SIDEBAR_BUTTON_CLASS);
  if (closeSidebarButtton) {
    closeSidebarButtton.addEventListener("click", closeSidebar);
  }

  const dropdownList = document.querySelector(HtmlElements.DROPDOWN_CONTENT_CLASS);
  if (dropdownList) {
    dropdownList.addEventListener("click", function (ev) {
      selectData(ev, mapController);
    });
  }

  const showWebGLButton = document.querySelector(HtmlElements.SHOW_CUSTOM_DATA_ID);
  if (showWebGLButton) {
    showWebGLButton.addEventListener(
      "click",
      mapController.addWebGlLayer.bind(mapController) // necessary to bind as the this context would be different in the addWebGL method otherwise
    );
  }

  const queryInput = document.querySelector(HtmlElements.QUERY_INPUT_ID) as HTMLInputElement;
  const queryButton = document.querySelector(HtmlElements.QUERY_BUTTON_ID);
  if (queryButton && queryInput) {
    queryButton.addEventListener("click", () => {
      performOsmQuery(mapController, queryInput.value.toLowerCase());
    });
  }
}

async function init(): Promise<void> {
  const mapController = new MapController();
  mapController.setupMap(setupUI);
}

init();
