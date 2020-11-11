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
const zoomTreshold = 0.7; // zoom level difference -> update if a map zoom event changed more than this
const moveTreshold = 1000; // map center difference in meters

/**
 * Main Controller Class for mapbox that handles all different aspects of the map.
 */
export default class MapController {
  private minRequiredZoomLevel = 7; //below this zoomlevel, nothing is shown (performance optimization)
  private currentZoom: number = initialZoomLevel;
  private currentMapCenter: LngLat = new LngLat(initialPosition[0], initialPosition[1]);

  private selectedVisualType: VisualType = VisualType.OVERLAY;

  set VisualType(type: VisualType) {
    const changedOverlay = this.selectedVisualType !== type;
    this.selectedVisualType = type;

    //reload if type changed
    if (changedOverlay) {
      //console.log("reloading");
      if (FilterManager.activeFilters.size > 0) {
        if (this.selectedVisualType === VisualType.OVERLAY) {
          this.showAreasOnMap();
        } else {
          this.showPOILocations();
        }
      } else {
        // no filters are active so the user wont see any change; inform him about this!
        showSnackbar(
          "Aktive Filter müssen vorhanden sein für Darstellung!",
          SnackbarType.WARNING,
          2000
        );
      }
    }
  }

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
    map.addControl(Geocoder.geocoderControl, "top-left");
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

    //! overlay needs to be updated all the time unfortunately as long as there is no way to draw the canvas
    //! bigger than the screen and retain correct world corrdinates :( -> would probably require view matrix transformation
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
    //console.log("allcurrentfilters", allCurrentFilters);

    if (allCurrentFilters.size === 0) {
      //console.warn("no active filters! cant load anything!");
      return;
    }
    //console.log("Performing osm query for active filters: ", allCurrentFilters);

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
        //TODO also check that bounds are nearly the same!
        //! doesnt work like this because filterlayer is created before in main!
        /*
        if (FilterManager.activeFilters.has(tag)) {
          console.log("loadin locally");
          const layer = FilterManager.getFilterLayer(tag);
          console.log("tag", tag);
          console.log(layer);
          this.showDataOnMap(layer?.Features, tag);
          return;
        }*/

        //Benchmark.startMeasure("Fetching data from osm");
        // request data from osm
        //const data = await fetchOsmDataFromClientVersion(bounds, query);
        console.log("loading from server");
        const data = await fetchOsmDataFromServer(bounds, query);
        //Benchmark.stopMeasure("Fetching data from osm");

        console.log("data from server:", data);
        if (data) {
          //const filterLayer = this.preprocessGeoData(data, tag);

          // get the filterlayer for this tag that has already been created at this point
          const layer = FilterManager.getFilterLayer(tag);
          if (layer) {
            layer.OriginalData = data;
          }

          //console.log(this.selectedVisualType);
          if (this.selectedVisualType === VisualType.NORMAL) {
            this.showDataOnMap(data, tag);
          } else {
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

    this.showAreasOnMap();
  }

  showAreasOnMap(): void {
    //update / show the overlay if this visual type is activated
    if (this.selectedVisualType === VisualType.OVERLAY) {
      if (mapLayerManager.geojsonSourceActive) {
        mapLayerManager.removeAllDataFromMap();
      }

      //console.log("updating overlay...\n", FilterManager.allFilterLayers);
      this.addAreaOverlay();
    }
  }

  showPOILocations(): void {
    for (let index = 0; index < FilterManager.allFilterLayers.length; index++) {
      const layer = FilterManager.allFilterLayers[index];
      this.showDataOnMap(layer.OriginalData, layer.LayerName);
    }
  }

  removeData(sourceName: string): void {
    FilterManager.removeFilter(sourceName);

    if (this.selectedVisualType === VisualType.OVERLAY) {
      mapLayerManager.removeCanvasSource("overlaySource");
      this.addAreaOverlay(); //recreate overlay without this filter layer
    } else {
      mapLayerManager.removeGeojsonSource(sourceName);
    }
  }

  resetMapData(): void {
    //clear all filters (and filterlayers)
    FilterManager.clearAllFilters();
    // clear all mapbox sources and layers that were added and the corresponding legened elements
    mapLayerManager.removeAllDataFromMap();
  }

  showDataOnMap(data: any, tagName: string): void {
    //console.log("Tagname: ", tagName);

    //const ftCollection = featureCollection(data);

    //remove area overlay if it exists
    if (map.getSource("overlaySource")) {
      mapLayerManager.removeCanvasSource("overlaySource");
    }

    mapLayerManager.removeAllLayersForSource(tagName);

    if (map.getSource(tagName)) {
      // the source already exists, only update the data
      //console.log(`Source ${tagName} is already used! Updating it!`);
      mapLayerManager.updateGeojsonSource(tagName, data);
    } else {
      // source doesn't exist yet, create a new one
      mapLayerManager.addNewGeojsonSource(tagName, data, false);
    }

    //show the source data on the map
    mapLayerManager.addLayersForSource(tagName);
  }

  //! most of the data preprocessing could (and probably should) already happen on the server!
  //! (after the data has been fetched and before being saved in Redis)
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

    //! reset arrays for this layer
    //! the new and the old information (if any) could probably be merged somehow to improve this
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

  addAreaOverlay(): void {
    //console.log("FilterManager in addAreaOverlay: ", FilterManager);

    /**
     * FilterManager.allFilterLayers should look like this at this point:
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

    // check that there is data to create an overlay for the map
    if (FilterManager.allFilterLayers.length > 0) {
      createOverlay(FilterManager.allFilterLayers);
    } else {
      console.log("Creating an overlay is not possible because overlayData is empty!");
    }
  }
}
