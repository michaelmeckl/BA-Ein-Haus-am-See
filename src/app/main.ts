/* eslint-env browser */
import { Config } from "../shared/config";
import MapController, { VisualType } from "./map/mapController";
import { FilterLayer, FilterRelevance } from "./mapData/filterLayer";
import FilterManager from "./mapData/filterManager";
import { showSnackbar, SnackbarType } from "./utils";
import Benchmark from "../shared/benchmarking";
//import { uploadLogs } from "./network/networkUtils";
//import { getLogs, clearLogs } from "./Logger";

// * const enum instead of enum as this inlines the elements at runtime
const enum HtmlElements {
  // container elements
  MAP_CONTAINER = "#mapContainer",
  MAP = "#map",
  SIDEBAR = ".sidebar",

  // headline controls
  SHOW_LOCATIONS_BUTTON_ID = "#showLocations",
  SHOW_FILTER_BUTTON_ID = "#showFilters",
  LOAD_MANUALLY_BUTTON_ID = "#manualLoadButton",
  RESET_BUTTON_ID = "#resetMapButton",
  MODE_SELECT_ID = "#mode-select",

  // sidebar
  FILTER_SIDEBAR_ID = "#filter-sidebar",
  LOCATIONS_SIDEBAR_ID = "#loc-sidebar",
  CLOSE_SIDEBAR_BUTTON_CLASS = ".closeSidebar",
  FILTER_LIST_TEMPLATE_ID = "#filter-li-template",
  FILTER_LIST_ID = "#active-filters",
  NO_FILTER_TEXT_ID = ".no-filter",

  // modal
  MODAL_ID = "#filterModal",
  MODAL_FORM_ID = "#modal-form",
  MODAL_HEADER_CLASS = ".modal-header",
  DISTANCE_INPUT_CLASS = ".distance-input",
  DISTANCE_UNIT_SELECT_ID = "#distance-unit-select",
  IMPORTANCE_SELECT_ID = "#importance-select",

  REMOVE_FILTER_BUTTON_ID = "#remove-filter-button",
  CANCEL_BUTTON_ID = "#cancel-button",
  ADD_FILTER_BUTTON_ID = "#add-filter-button",
}

const enum SidebarType {
  FilterSidebar,
  LocationsSidebar,
}

// ###### Setup: ######

let mapController: MapController;

let sidebarOpen = false;

// map
const mapConatiner = document.querySelector(HtmlElements.MAP_CONTAINER) as HTMLDivElement;
const mapElement = document.querySelector(HtmlElements.MAP) as HTMLDivElement;

/**
 * buttons and headline controls
 */
const showFilterButtton = document.querySelector(
  HtmlElements.SHOW_FILTER_BUTTON_ID
) as HTMLButtonElement;
const manualLoadButton = document.querySelector(
  HtmlElements.LOAD_MANUALLY_BUTTON_ID
) as HTMLButtonElement;
const resetButtton = document.querySelector(HtmlElements.RESET_BUTTON_ID) as HTMLButtonElement;
const closeSidebarButtton = document.querySelector(
  HtmlElements.CLOSE_SIDEBAR_BUTTON_CLASS
) as HTMLButtonElement;
//const showLocationsButtton = document.querySelector(HtmlElements.SHOW_LOCATIONS_BUTTON_ID) as HTMLButtonElement;
const modeSelection = document.querySelector(HtmlElements.MODE_SELECT_ID) as HTMLSelectElement;

/**
 * templates
 */
const FILTER_LIST_TEMPLATE = document
  .querySelector(HtmlElements.FILTER_LIST_TEMPLATE_ID)
  ?.innerHTML.trim();

/**
 * sidebar and modal
 */
const sidebarContainer = document.querySelector(HtmlElements.SIDEBAR) as HTMLDivElement;
const filterSidebar = document.querySelector(HtmlElements.FILTER_SIDEBAR_ID) as HTMLDivElement;
//const locationsSidebar = document.querySelector(HtmlElements.LOCATIONS_SIDEBAR) as HTMLDivElement;

const list = document.querySelector(HtmlElements.FILTER_LIST_ID) as HTMLUListElement;
const noFilterText = document.querySelector(HtmlElements.NO_FILTER_TEXT_ID) as HTMLParagraphElement;
const modal = document.querySelector(HtmlElements.MODAL_ID) as HTMLDivElement;
//const errormessage = document.querySelector("#errormessage") as HTMLDivElement;

/**
 * ###################
 * Logic starts here:
 * ###################
 */

async function performOsmQuery(): Promise<void> {
  if (FilterManager.activeFilters.size === 0) {
    showSnackbar(
      "Es können keine Daten geladen werden, da keine Filter aktiv sind!",
      SnackbarType.WARNING
    );
    return;
  }
  mapController.loadMapData();
  /*
  const data = await testGuide("restaurant");
  console.log(data);
  */
}

//* as onFilterRemoved is bound to a click listener the event (this) MUST be the last argument!
function onFilterRemoved(filterName: string, ev: Event): void {
  const listElement = (ev.target as HTMLButtonElement).parentElement as Node; // cast to node to remove it with removeChild()
  list.removeChild(listElement);

  // remove data from the map as well
  mapController.removeData(filterName);

  // eslint-disable-next-line no-magic-numbers
  showSnackbar(`Filter "${filterName}" wurde entfernt.`, SnackbarType.SUCCESS, 1200);

  // check if there are other list elements, if not show the no filter text
  if (list.children.length === 0) {
    noFilterText?.classList.remove(Config.CSS_HIDDEN);

    //also disable the locations and overlay buttons
    //showLocationsButtton.classList.add(Config.CSS_BTN_DISABLED);
    //showLocationsButtton.disabled = true;
    manualLoadButton.classList.add(Config.CSS_BTN_DISABLED);
    manualLoadButton.disabled = true;
  }
}

function addNewFilter(
  filterName: string,
  distance: string,
  distanceUnit: string,
  importance: string,
  filterWanted: string
): void {
  if (list.children.length === 0) {
    // the list is empty so this is the first filter -> hide the no filter text
    noFilterText?.classList.add(Config.CSS_HIDDEN);

    // also enable these buttons
    //showLocationsButtton.classList.remove(Config.CSS_BTN_DISABLED);
    //showLocationsButtton.disabled = false;
    manualLoadButton.classList.remove(Config.CSS_BTN_DISABLED);
    manualLoadButton.disabled = false;
  }

  // check if that list element already exists to prevent adding it twice
  for (const el of list.getElementsByTagName("li")) {
    if (el.firstChild?.textContent?.trim() === filterName) {
      return;
    }
  }

  const distanceInMeters = distanceUnit === "m" ? parseInt(distance) : parseInt(distance) * 1000;
  const wanted = filterWanted === "true";

  let relevance;
  switch (importance) {
    case "optional":
      relevance = FilterRelevance.notVeryImportant;
      break;
    case "sehr wichtig":
      relevance = FilterRelevance.veryImportant;
      break;
    case "wichtig":
    default:
      relevance = FilterRelevance.important;
  }
  //if (importance in FilterRelevance) relevance = FilterRelevance[importance]; //not working!

  const newFilter = new FilterLayer(filterName, distanceInMeters, relevance, wanted);
  FilterManager.addFilter(newFilter);

  const containerElement = document.createElement("div");
  containerElement.innerHTML = FILTER_LIST_TEMPLATE as string;
  const listEl = containerElement.firstChild as ChildNode;

  const title = `<h4>${filterName}</h4>`;
  // insert the h3 before the button
  containerElement.firstElementChild?.insertAdjacentHTML("afterbegin", title);

  // get the remove button for the list element
  const removeButton = containerElement.querySelector(HtmlElements.REMOVE_FILTER_BUTTON_ID);

  // add the selected data to the list element and append the list element
  listEl.appendChild(
    document.createTextNode(
      `Entfernung: ${distance} ${distanceUnit}, Relevanz: ${importance}, ${
        wanted ? "erwünscht" : "nicht erwünscht"
      }`
    )
  );
  list.appendChild(listEl);

  showSnackbar("Filter wurde erfolgreich hinzugefügt!", SnackbarType.SUCCESS, 1000);

  // load map data automatically after 800ms (timeout so the snackbars wont overlap)
  setTimeout(() => {
    performOsmQuery();
  }, 800);

  // remove the list element when its close button is clicked
  //@ts-expect-error: not actually a ts-error but this with implicit any is fine for me in this case
  removeButton?.addEventListener("click", onFilterRemoved.bind(this, filterName));
}

function resetModalContent(): void {
  //reset inputs
  const modalForm = document.querySelector(HtmlElements.MODAL_FORM_ID) as HTMLFormElement;
  modalForm.reset();

  //reset error message
  //errormessage.classList.add(Config.CSS_HIDDEN);
}

function showFilterDetailModal(filterName: string | null): void {
  //show the modal
  modal.style.display = "block";

  // set the title to the current filter
  const modalTitle = document.querySelector(HtmlElements.MODAL_HEADER_CLASS) as HTMLElement;
  modalTitle.textContent = filterName;
}

function onCancelBtnClick(): void {
  // hide modal and reset its content to default
  modal.style.display = "none";
  resetModalContent();
}

function onAddFilterBtnClick(): void {
  // get all relevant input information
  const filterName = document.querySelector(HtmlElements.MODAL_HEADER_CLASS) as HTMLElement;
  const distance = document.querySelector(HtmlElements.DISTANCE_INPUT_CLASS) as HTMLInputElement;
  const distanceUnit = document.querySelector(
    HtmlElements.DISTANCE_UNIT_SELECT_ID
  ) as HTMLSelectElement;
  const importance = document.querySelector(HtmlElements.IMPORTANCE_SELECT_ID) as HTMLSelectElement;
  const filterWanted = document.querySelector(
    "input[name = 'polarity']:checked"
  ) as HTMLInputElement;

  /*
  const distanceInMeters =
    distanceUnit.value === "m" ? parseInt(distance.value) : parseInt(distance.value) * 1000;
  
  if (distanceInMeters > 700) {
    errormessage.classList.remove(Config.CSS_HIDDEN);
    return;
  }

  errormessage.classList.add(Config.CSS_HIDDEN);
  */

  addNewFilter(
    filterName.textContent || "",
    distance.value,
    distanceUnit.value,
    importance.value,
    filterWanted.value
  );

  //close the modal
  modal.style.display = "none";
  //reset all fields in the modal
  resetModalContent();
}

function setupModalButtons(): void {
  const cancelBtn = document.querySelector(HtmlElements.CANCEL_BUTTON_ID);
  const addFilterBtn = document.querySelector(HtmlElements.ADD_FILTER_BUTTON_ID);

  //handle click on cancel button
  cancelBtn?.addEventListener("click", onCancelBtnClick);
  //handle click on add filter button
  addFilterBtn?.addEventListener("click", onAddFilterBtnClick);
}

/* show the sidebar and calculate the width of the map */
//prettier-ignore
function openSidebar(sidebarType: SidebarType): void {
  sidebarOpen = true;

  // switch visibility of sidebars
  if(sidebarType === SidebarType.FilterSidebar) {
    filterSidebar.classList.remove(Config.CSS_HIDDEN);
    //locationsSidebar.classList.add(Config.CSS_HIDDEN);
  } else {
    filterSidebar.classList.add(Config.CSS_HIDDEN);
    //locationsSidebar.classList.remove(Config.CSS_HIDDEN);
  }
  
  const sidebarWidth = "30%";
  sidebarContainer.style.width = sidebarWidth;
  mapConatiner.style.marginLeft = sidebarWidth;
  mapElement.style.width = `calc(100% - ${sidebarWidth})`;
}

/* Set the width of the sidebar to 0 */
function closeSidebar(): void {
  sidebarOpen = false;

  sidebarContainer.style.width = "0";
  mapConatiner.style.marginLeft = "0";
  mapElement.style.width = "100%";
}

function setupFilterSelection(): void {
  const filterNodes = document.querySelectorAll(".filter-entries > a");

  filterNodes.forEach((filter) => {
    filter.addEventListener("click", () => {
      showFilterDetailModal(filter.textContent);
    });
  });
}

function setupSidebarFilterCategories(): void {
  const filterCategories = document.getElementsByClassName("filter-categories");

  for (let i = 0; i < filterCategories.length; i++) {
    filterCategories[i].addEventListener("click", (event) => {
      const clickedButton = event.currentTarget as HTMLElement;
      // toggle the active class
      clickedButton.classList.toggle("active-filter-category");

      // toggle the dropdown arrow
      const dropdownIcon = clickedButton.firstElementChild;
      dropdownIcon?.classList.toggle("caret-down");
      dropdownIcon?.classList.toggle("caret-up");

      // show or hide the dropdown content
      const dropdownContent = clickedButton.nextElementSibling as HTMLElement;
      if (dropdownContent.style.display === "block") {
        dropdownContent.style.display = "none";
      } else {
        dropdownContent.style.display = "block";
      }
    });
  }
}

function toggleFilterPanel(): void {
  if (sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar(SidebarType.FilterSidebar);
  }
}

/*
function showLocationsPanel(): void {
  openSidebar(SidebarType.LocationsSidebar);
}
*/

function switchVisualMode(newMode: string): void {
  let visualMode: VisualType;
  switch (newMode) {
    case "Normal":
      visualMode = VisualType.NORMAL;
      break;

    case "Overlay":
    default:
      visualMode = VisualType.OVERLAY;
  }

  mapController.VisualType = visualMode;
}

function setupUI(): void {
  showFilterButtton.addEventListener("click", toggleFilterPanel);

  modeSelection.addEventListener("change", () => {
    switchVisualMode(modeSelection.value);
  });

  resetButtton.addEventListener("click", () => {
    mapController.resetMapData();

    const elements = document.querySelectorAll("#active-filters > li");
    elements.forEach((el) => el.remove());
    noFilterText?.classList.remove(Config.CSS_HIDDEN);
  });

  manualLoadButton.addEventListener("click", performOsmQuery);

  closeSidebarButtton.addEventListener("click", closeSidebar);

  /*
  showLocationsButtton.addEventListener("click", () => {
    // check if there are active filters, if not show snackbar warning
    if (FilterManager.activeFilters.size > 0) {
      showLocationsPanel();
    } else {
      showSnackbar(
        "Um Orte anzuzeigen, muss mindestens ein Filter aktiviert sein!",
        SnackbarType.WARNING,
        2500
      );
    }
  });
  */

  //disable specific buttons initially
  //showLocationsButtton.disabled = true;
  manualLoadButton.disabled = true;

  //setup filter side panel
  setupSidebarFilterCategories();
  setupFilterSelection();
  setupModalButtons();
  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function (event: Event): void {
    if (event.target === modal) {
      modal.style.display = "none";
      //reset all fields in the modal
      resetModalContent();
    }
  };

  //setup house side panel
  //loadLocations();

  /*
  const logButton = document.querySelector("#uploadLogsButton") as HTMLButtonElement;
  logButton.addEventListener("click", () => {
    uploadLogs(getLogs());
    clearLogs();
  });
  */
}

export function init(): void {
  Benchmark.startMeasure("load map");

  mapController = new MapController();
  mapController
    .init()
    .then(() => {
      // map loaded sucessfully
      Benchmark.stopMeasure("load map");

      // setup the initial map state
      mapController.setupMapState();

      setupUI();
    })
    .catch((error) => {
      // an error occured while loading the map, the application cannot be used
      throw new Error(error);
    });
}

init();
