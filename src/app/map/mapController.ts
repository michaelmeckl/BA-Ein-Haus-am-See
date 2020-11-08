/* eslint-env browser */
import truncate from "@turf/truncate";
import type { FeatureCollection, Geometry, GeometryObject } from "geojson";
import mapboxgl, { LngLat } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import type { FilterLayer } from "../mapData/filterLayer";
import FilterManager from "../mapData/filterManager";
import mapLayerManager from "../mapData/mapLayerManager";
import OsmTagCollection from "../mapData/osmTagCollection";
import { fetchOsmDataFromServer } from "../network/networkUtils";
import { createOverlay } from "../overlayCreation/canvasRenderer";
import { PerformanceMeasurer } from "../performanceMeasurer";
import { hideSnackbar, showSnackbar, SnackbarType } from "../utils";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import { addBufferToFeature } from "./turfUtils";

export const enum VisualType {
  NORMAL,
  OVERLAY,
  //HEATMAP
}

// tresholds to prevent reloading when small movements are made (performance optimization)
const zoomTreshold = 0.5; // zoom level difference -> update if a map zoom changed more than half the zoom level
const moveTreshold = 1000; // map center difference in meters

/**
 * Main Controller Class for mapbox that handles all different aspects of the map.
 */
export default class MapController {
  private minRequiredZoomLevel = 7; //below this zoomlevel, nothing is shown (performance optimization)
  private currentZoom: number = initialZoomLevel;
  private currentMapCenter: LngLat = new LngLat(initialPosition[0], initialPosition[1]);

  private selectedVisualType: VisualType = VisualType.OVERLAY; //TODO wechseln!
  private showingOverlay = false;
  showOverlayActivated = true; //! im moment immer true

  /**
   * Async init function that awaits the map load and resolves (or rejects) after the map has been fully loaded.
   * This should be the very first function to call to make sure all code later on
   * can safely assume that the map is ready to be used.
   */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      map.on("load", () => {
        resolve();
      });
      map.on("error", (err) => reject(err));
    });
  }

  setupMapState(): void {
    this.addMapControls();

    // disable map rotation using right click + drag
    map.dragRotate.disable();
    // disable map rotation using touch rotation gesture
    map.touchZoomRotate.disableRotation();

    // start measuring the frame rate
    const performanceMeasurer = new PerformanceMeasurer();
    performanceMeasurer.startMeasuring();

    //map.showTileBoundaries = true;

    // setup event listeners on the map
    this.setupMapEvents();
  }

  addMapControls(): void {
    // Add navigation controls to the map
    map.addControl(new mapboxgl.NavigationControl());
    //map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    //map.addControl(new mapboxgl.GeolocateControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    // Add the geocoder to the map
    map.addControl(Geocoder.geocoderControl, "bottom-left"); //TODO top-left
  }

  setupMapEvents(): void {
    //map.on("sourcedata", this.onSourceLoaded.bind(this));
    //map.on("data", this.onDataLoaded.bind(this));
    //map.on("click", this.onMapClick.bind(this));
    map.on("zoomstart", this.onMapZoomStart.bind(this));
    map.on("zoomend", this.onMapZoomEnd.bind(this));
    map.on("dragstart", this.onMapDragStart.bind(this));
    map.on("dragend", this.onMapDragEnd.bind(this));
  }

  onMapDragStart(): void {
    this.currentMapCenter = map.getCenter();
  }

  onMapDragEnd(): void {
    // Uses the Haversine Formula to calculate difference between tow latLng coords in meters
    const distance = this.currentMapCenter.distanceTo(map.getCenter());
    //console.log("Distance", distance);

    //! overlay needs to be updated all the time unfortunately :(
    if (this.selectedVisualType === VisualType.OVERLAY) {
      FilterManager.recalculateScreenCoords();
      // this is a threshold to avoid firing events with small moves
      if (distance < moveTreshold) {
        // if below the treshold only update overlay
        this.addAreaOverlay();
      } else {
        // if greater than the treshold load new data from the internet as well
        this.loadMapData();
      }
    } else {
      if (distance < moveTreshold) {
        return;
      }
      //console.log("Distance greater than treshold - updating");
      this.loadMapData();
    }
  }

  onMapZoomStart(): void {
    this.currentZoom = map.getZoom();
  }

  onMapZoomEnd(): void {
    const newZoom = map.getZoom();

    if (this.selectedVisualType === VisualType.OVERLAY) {
      FilterManager.recalculateScreenCoords();

      if (newZoom <= this.minRequiredZoomLevel) {
        // performance optimization - dont show/update overlay below a certain zoomlevel
        //? show it all the time below this zoomlevel?
        showSnackbar(
          "Die aktuelle Zoomstufe ist zu niedrig, um Daten zu aktualisieren!",
          SnackbarType.WARNING,
          2000
        );
        return;
      } else if (Math.abs(newZoom - this.currentZoom) <= zoomTreshold) {
        this.addAreaOverlay();
        return;
      }

      this.loadMapData();
    } else {
      if (newZoom <= this.minRequiredZoomLevel) {
        showSnackbar(
          "Die aktuelle Zoomstufe ist zu niedrig, um Daten zu aktualisieren!",
          SnackbarType.WARNING,
          2000
        );
        return;
      } else if (Math.abs(newZoom - this.currentZoom) <= zoomTreshold) {
        // don't update data if the zoom level change is below the treshold
        return;
      }
      //console.log("new zoom is different enough - updating ...");
      this.loadMapData();
    }
  }

  /*
  async onMapClick(e: MapMouseEvent & EventData): Promise<void> {
    console.log("Click:", e);
  }*/

  async loadMapData(): Promise<void> {
    const allCurrentFilters = FilterManager.activeFilters;
    if (allCurrentFilters.size === 0) {
      console.warn("no active filters! cant load anything!");
      return;
    }

    console.log("Performing osm query for active filters: ", allCurrentFilters);
    // give feedback to the user
    showSnackbar("Daten werden geladen...", SnackbarType.INFO, undefined, true);

    //get screen viewport and 500 meter around to compensate for the move treshold for new data
    const bounds = mapboxUtils.getViewportBoundsString(500);

    Benchmark.startMeasure("Performing osm query for active filters");
    const allResults = await Promise.allSettled(
      Array.from(allCurrentFilters).map(async (tag) => {
        // get overpass query for each tag
        const query = OsmTagCollection.getQueryForCategory(tag);

        //TODO check if already locally loaded this tag; only fetch if not!
        Benchmark.startMeasure("Fetching data from osm");
        // request data from osm
        //const data = await fetchOsmDataFromClientVersion(bounds, query);
        const data = await fetchOsmDataFromServer(bounds, query);
        Benchmark.stopMeasure("Fetching data from osm");

        if (data) {
          if (this.selectedVisualType === VisualType.NORMAL) {
            this.showDataOnMap(data, tag);
          } else {
            //const filterLayer = this.preprocessGeoData(data, tag);
            this.preprocessGeoData(data, tag);
          }
        }
      })
    );

    Benchmark.stopMeasure("Performing osm query for active filters");

    //console.log("Finished adding data to map!");

    let success = true;
    for (const res of allResults) {
      if (res.status === "rejected") {
        success = false;
        break;
      }
    }

    if (!success) {
      showSnackbar("Nicht alle Daten konnten erfolgreich geladen werden", SnackbarType.ERROR, 1500);
      //return;
    }

    // hide the snackbar after data has finished loading
    hideSnackbar();

    //update the overlay if it is activated
    if (this.showOverlayActivated) {
      //TODO remove legend and other map layers // ==  mapLayerManager.removeAllDataFromMap();
      //TODO oder nur geojson layer?
      //console.log("updating overlay...\n", FilterManager.allFilterLayers);
      this.showingOverlay = true;
      this.addAreaOverlay();
    }
  }

  removeData(sourceName: string): void {
    console.log("Removing source: ", sourceName);
    mapLayerManager.removeGeojsonSource(sourceName);
    //TODO should also call the filtermanager so everythings in one place
  }

  resetMapData(): void {
    //TODO sollten die filter wirklich gelöscht werden???
    //filterManager.clearAllFilters();
    //console.log("After clear: ", filterManager);

    mapLayerManager.removeAllDataFromMap();
  }

  showDataOnMap(data: FeatureCollection<GeometryObject, any>, tagName: string): void {
    //console.log("now adding to map...");
    console.log("Tagname: ", tagName);

    //TODO macht das Sinn alle Layer zu löschen???? oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
    mapLayerManager.removeAllLayersForSource(tagName);

    if (map.getSource(tagName)) {
      // the source already exists, only update the data
      console.log(`Source ${tagName} is already used! Updating it!`);
      mapLayerManager.updateGeojsonSource(tagName, data);
    } else {
      // source doesn't exist yet, create a new one
      mapLayerManager.addNewGeojsonSource(tagName, data, false);
    }

    //show the source data on the map
    mapLayerManager.addLayersForSource(tagName);
  }

  //! most of the data preprocessing could (and probably should) already happen on the server!
  preprocessGeoData(
    data: FeatureCollection<GeometryObject, any>,
    dataName: string
  ): FilterLayer | null {
    //const flattenedData = mapboxUtils.flattenMultiGeometry(data);

    // truncate geojson precision to 4 decimals;
    // this increases performance and the perfectly exact coords aren't necessary for the area overlay
    const options = { precision: 4, coordinates: 2, mutate: true };
    const truncatedData: FeatureCollection<Geometry, any> = truncate(data, options);

    const layer = FilterManager.getFilterLayer(dataName);
    if (!layer) {
      return null;
    }

    //! reset array
    layer.Points.length = 0;
    layer.Features.length = 0;

    // convert to pixels and add these to filterlayer
    for (let index = 0; index < truncatedData.features.length; index++) {
      const feature = truncatedData.features[index];
      const bufferedPoly = addBufferToFeature(feature, layer.Distance, "meters");

      layer.Features.push(bufferedPoly);

      mapboxUtils.convertPolygonCoordsToPixels(bufferedPoly, layer);
    }

    //console.log("allPoints in layer:", layer.Points);
    //console.log("allfeatures in layer:", layer.Features);

    return layer;
  }

  /**
   * FilterManager.allFilterLayers looks like this:
   *[
   *  { ### FilterLayer - Park
   *    points: [
   *      [{x: 49.1287; y: 12.3591}, ...],
   *      [{x: 49.1287; y: 12.3591}, ...],
   *      ...,
   *    ]
   *    features: [ {Feature}, {Feature}, ...],
   *    distance: 500,
   *    relevance: 0.8,  //="very important"
   *    name: "Park",
   *    wanted: true,
   *  },
   *  { ### FilterLayer - Restaurant
   *    ...
   *  },
   *  ...
   * ]
   */
  addAreaOverlay(): void {
    //console.log("FilterManager in addAreaOverlay: ", FilterManager);

    // check that there is data to create an overlay for the map
    if (FilterManager.allFilterLayers.length > 0) {
      createOverlay(FilterManager.allFilterLayers);
    } else {
      console.warn("Creating an overlay is not possible because overlayData is empty!");
    }
  }
}
