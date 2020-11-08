/* eslint-env browser */
import { Config } from "../shared/config";
import MapController from "./map/mapController";
import { FilterLayer, FilterRelevance } from "./mapData/filterLayer";
import { default as FilterManager, default as filterManager } from "./mapData/filterManager";
import mapLayerManager from "./mapData/mapLayerManager";
import { showSnackbar, SnackbarType } from "./utils";

// * const enum instead of enum as this inlines the elements at runtime
//TODO alle html element accessor names hier auslagern:
const enum HtmlElements {
  LIST_TEMPLATE_ID = "#li-template",
  FILTER_LIST_TEMPLATE_ID = "#filter-li-template",
  // heading buttons
  SHOW_LOCATIONS_BUTTON_ID = "#showLocations",
  SHOW_FILTER_BUTTON_ID = "#showFilters",
  SHOW_CUSTOM_DATA_ID = "#showCustomData",
  // api controls
  QUERY_INPUT_ID = "#query-input",
  QUERY_BUTTON_ID = "#query-button",
  SELECTION_LIST_ID = "#selection-list",
  SELECTION_BOX_CLASS = ".selection-box",
  DROPDOWN_CONTENT_CLASS = ".dropdown-content",
  // sidebar
  CLOSE_SIDEBAR_BUTTON_CLASS = ".closeSidebar",
  FILTER_SIDEBAR = "#filter-sidebar",
  LOCATIONS_SIDEBAR = "#loc-sidebar",
  // container elements
  SIDEBAR = ".sidebar",
  MAP_CONTAINER = "#mapContainer",
  MAP = "#map",
}

const enum SidebarType {
  FilterSidebar,
  LocationsSidebar,
}

// ###### Setup: ######

let mapController: MapController;
// map
const mapConatiner = document.querySelector(HtmlElements.MAP_CONTAINER) as HTMLDivElement;
const mapElement = document.querySelector(HtmlElements.MAP) as HTMLDivElement;

// buttons
const showFilterButtton = document.querySelector(
  HtmlElements.SHOW_FILTER_BUTTON_ID
) as HTMLButtonElement;
const showLocationsButtton = document.querySelector(
  HtmlElements.SHOW_LOCATIONS_BUTTON_ID
) as HTMLButtonElement;
const resetButtton = document.querySelector("#resetMapButton") as HTMLButtonElement;
//const showMapDataButtton = document.querySelector("#deckglButton");
const showOverlayButton = document.querySelector("#showOverlayButton") as HTMLButtonElement;
const closeSidebarButtton = document.querySelector(
  HtmlElements.CLOSE_SIDEBAR_BUTTON_CLASS
) as HTMLButtonElement;
const queryButton = document.querySelector(HtmlElements.QUERY_BUTTON_ID) as HTMLButtonElement;

//template
const LIST_TEMPLATE = document.querySelector(HtmlElements.LIST_TEMPLATE_ID)?.innerHTML.trim();
const FILTER_LIST_TEMPLATE = document
  .querySelector(HtmlElements.FILTER_LIST_TEMPLATE_ID)
  ?.innerHTML.trim();

//sidebar
const sidebarContainer = document.querySelector(HtmlElements.SIDEBAR) as HTMLDivElement;
const filterSidebar = document.querySelector(HtmlElements.FILTER_SIDEBAR) as HTMLDivElement;
const locationsSidebar = document.querySelector(HtmlElements.LOCATIONS_SIDEBAR) as HTMLDivElement;

const list = document.querySelector("#active-filters") as HTMLUListElement;
const noFilterText = document.querySelector(".no-filter") as HTMLParagraphElement;
const modal = document.querySelector("#filterModal") as HTMLDivElement;

// ####### Logic starts here: ########

async function performOsmQuery(): Promise<void> {
  mapController.loadMapData(); //TODO await this and activate location button only after this has finished?
  /*
  const data = await testGuide("restaurant");
  console.log(data);
  */
}

//* as onFilterRemoved is bound to a click listener the event (this) MUST be the last argument!
function onFilterRemoved(filterName: string, ev: Event): void {
  const listElement = (ev.target as HTMLButtonElement).parentElement as Node; // cast to node to remove it with removeChild()
  list.removeChild(listElement);
  FilterManager.removeFilter(filterName);

  // remove data from the map as well
  const textContent = listElement.firstChild?.textContent?.trim(); //TODO oder einfach filtername nehmen hier??
  if (textContent) {
    mapController.removeData(textContent);
  }

  // eslint-disable-next-line no-magic-numbers
  showSnackbar(`Filter "${filterName}" wurde entfernt.`, SnackbarType.SUCCESS, 1200);

  // check if there are other list elements, if not show the no filter text
  if (list.children.length === 0) {
    noFilterText?.classList.remove(Config.CSS_HIDDEN);

    //also disable the locations and overlay buttons
    showLocationsButtton.classList.add(Config.CSS_BTN_DISABLED);
    showLocationsButtton.disabled = true;
    showOverlayButton.classList.add(Config.CSS_BTN_DISABLED);
    showOverlayButton.disabled = true;
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
    showLocationsButtton.classList.remove(Config.CSS_BTN_DISABLED);
    showLocationsButtton.disabled = false;
    showOverlayButton.classList.remove(Config.CSS_BTN_DISABLED);
    showOverlayButton.disabled = false;
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
  const removeButton = containerElement.querySelector("#remove-filter-button");

  // add the selected data to the list element and append the list element
  listEl.appendChild(
    document.createTextNode(
      `Entfernung: ${distance} ${distanceUnit}, Relevanz: ${importance}, ${
        wanted ? "erwünscht" : "nicht erwünscht"
      }`
    )
  );
  list.appendChild(listEl);

  showSnackbar("Filter wurde erfolgreich hinzugefügt!", SnackbarType.SUCCESS, 1200);

  // load map data automatically after 1 second (timeout so the snackbars wont overlap)
  setTimeout(() => {
    performOsmQuery();
  }, 1000);

  // remove the list element when its close button is clicked
  //@ts-expect-error: not actually a ts-error but this with implicit any is fine for me in this case
  removeButton?.addEventListener("click", onFilterRemoved.bind(this, filterName));
}

function resetModalContent(): void {
  const modalForm = document.querySelector("#modal-form") as HTMLFormElement;
  modalForm.reset();
}

function showFilterDetailModal(filterName: string | null): void {
  //show the modal
  modal.style.display = "block";

  // set the title to the current filter
  const modalTitle = document.querySelector(".modal-header") as HTMLElement;
  modalTitle.textContent = filterName;
}

function onCancelBtnClick(): void {
  modal.style.display = "none";
  resetModalContent();
}

function onAddFilterBtnClick(): void {
  // get all relevant input information
  const filterName = document.querySelector(".modal-header") as HTMLElement;
  const distance = document.querySelector(".distance-input") as HTMLInputElement;
  const distanceUnit = document.querySelector("#distance-unit-select") as HTMLSelectElement;
  const importance = document.querySelector("#importance-select") as HTMLSelectElement;
  const filterWanted = document.querySelector(
    "input[name = 'polarity']:checked"
  ) as HTMLInputElement;

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
  const cancelBtn = document.querySelector("#cancel-button");
  const addFilterBtn = document.querySelector("#add-filter-button");

  //handle click on cancel button
  cancelBtn?.addEventListener("click", onCancelBtnClick);
  //handle click on add filter button
  addFilterBtn?.addEventListener("click", onAddFilterBtnClick);
}

/* show the sidebar and calculate the width of the map */
//prettier-ignore
function openSidebar(sidebarType: SidebarType): void {

  // switch visibility of sidebars
  if(sidebarType === SidebarType.FilterSidebar) {
    filterSidebar.classList.remove(Config.CSS_HIDDEN);
    locationsSidebar.classList.add(Config.CSS_HIDDEN);
  } else {
    filterSidebar.classList.add(Config.CSS_HIDDEN);
    locationsSidebar.classList.remove(Config.CSS_HIDDEN);
  }
  
  //! use width = 30% für mehr responsitivität
  const sidebarWidth = "350px";
  sidebarContainer.style.width = sidebarWidth;
  mapConatiner.style.marginLeft = sidebarWidth;
  mapElement.style.width = `calc(100% - ${sidebarWidth})`;
}

/* Set the width of the sidebar to 0 */
function closeSidebar(): void {
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

function showFilterPanel(): void {
  //TODO toggle sidebar (also bei klick wieder zu)? dazu müsste nur der state hier in einer globalen variable gespeichert werden

  openSidebar(SidebarType.FilterSidebar);
}

function showLocationsPanel(): void {
  openSidebar(SidebarType.LocationsSidebar);
}

//TODO remove this later
function selectData(e: Event): void {
  e.stopPropagation();
  e.preventDefault();

  const value = (e.target as HTMLAnchorElement).innerText;
  /*
  const queryInput = document.querySelector(HtmlElements.QUERY_INPUT_ID) as HTMLInputElement;
  const query = OsmTags.getQuery(value);
  queryInput.value = query;
  */

  const selectionBox = document.querySelector(HtmlElements.SELECTION_BOX_CLASS) as HTMLDivElement;
  const list = document.querySelector(HtmlElements.SELECTION_LIST_ID) as HTMLUListElement;

  //TODO: actually the visible features on the map should be shown in the box (not what is clicked!)

  // check if that list element already exists to prevent adding it twice
  for (const el of list.getElementsByTagName("li")) {
    if (el.textContent?.trim() === value) {
      return;
    }
  }

  const containerElement = document.createElement("div");
  containerElement.innerHTML = LIST_TEMPLATE as string;
  const listEl = containerElement.firstChild as ChildNode;
  // get the close button for the list element
  const closeButton = containerElement.firstChild?.childNodes[1] as ChildNode;

  // add the selected data to the list element and append the list element
  listEl.appendChild(document.createTextNode(value));
  list.appendChild(listEl);

  FilterManager.addFilter(new FilterLayer(value, 250, FilterRelevance.important, true));

  // remove the list element when its close button is clicked
  closeButton.addEventListener("click", function (this: ChildNode) {
    const listElement = this.parentElement as Node;
    list.removeChild(listElement);
    FilterManager.removeFilter(value);

    // remove data from the map as well
    const textContent = listElement.textContent?.trim();
    if (textContent) {
      mapController.removeData(textContent);
    }

    // eslint-disable-next-line no-magic-numbers
    showSnackbar(`Filter "${value}" wurde entfernt`, SnackbarType.SUCCESS, 1200);

    // check if there are other list elements, if not hide selection box
    if (list.children.length === 0) {
      selectionBox.classList.add(Config.CSS_HIDDEN);
    }
  });

  // show selection box
  selectionBox.classList.remove(Config.CSS_HIDDEN);
}

function setupUI(): void {
  showFilterButtton.addEventListener("click", showFilterPanel);

  showLocationsButtton.addEventListener("click", () => {
    // check if there are active filters, if not show snackbar warning
    if (filterManager.activeFilters.size > 0) {
      showLocationsPanel();
    } else {
      showSnackbar(
        "Um Orte anzuzeigen, muss mindestens ein Filter aktiviert sein!",
        SnackbarType.WARNING,
        2500
      );
    }
  });

  resetButtton.addEventListener("click", () => {
    mapController.resetMapData();
  });

  //TODO
  // necessary to bind so the this context stays the same!
  showOverlayButton.addEventListener("click", mapController.addAreaOverlay.bind(mapController));

  //FIXME funktioniert im locations Panel nicht!!!
  closeSidebarButtton.addEventListener("click", closeSidebar);

  const dropdownList = document.querySelector(HtmlElements.DROPDOWN_CONTENT_CLASS);
  if (dropdownList) {
    dropdownList.addEventListener("click", function (ev) {
      selectData(ev);
    });
  }

  //TODO delete me?
  queryButton.addEventListener("click", () => {
    performOsmQuery();
  });

  //disable specific buttons initially
  showLocationsButtton.disabled = true;
  showOverlayButton.disabled = true;

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
  //TODO not possible performance-wise at the moment
  //loadLocations();
}

function init(): void {
  console.time("load map");

  mapController = new MapController();
  mapController
    .init()
    .then(() => {
      // map loaded sucessfully
      console.timeEnd("load map");

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
