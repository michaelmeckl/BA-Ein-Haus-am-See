/* eslint-env browser */
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  GeometryObject,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import mapboxgl, { EventData, LngLat, MapMouseEvent } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import type { FilterLayer } from "../mapData/filterLayer";
import FilterManager from "../mapData/filterManager";
import mapLayerManager from "../mapData/mapLayerManager";
import OsmTagCollection from "../mapData/osmTagCollection";
import { fetchOsmDataFromServer } from "../network/networkUtils";
import { PerformanceMeasurer } from "../performanceMeasurer";
import { hideSnackbar, showSnackbar, SnackbarType } from "../utils";
import { createOverlay } from "../overlayCreation/canvasRenderer";
import { initialPosition, initialZoomLevel, map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import { addBufferToFeature } from "./turfUtils";

export const enum VisualType {
  NORMAL,
  OVERLAY,
  //HEATMAP
}

//! add clear map data button or another option (or implement the removeMapData method correct) because atm
//! a filter can be deleted while fetching data which still adds the data but makes it impossible to delete the data on the map!!

const zoomTreshold = 2; // 2 zoom levels difference
const moveTreshold = 1500; // map center difference in meters

/**
 * Main Controller Class for mapbox that handles all different aspects of the map.
 */
export default class MapController {
  private currentZoom: number = initialZoomLevel;
  private currentMapCenter: LngLat = new LngLat(initialPosition[0], initialPosition[1]);

  private selectedVisualType: VisualType = VisualType.NORMAL; //TODO wechseln!
  private showingOverlay = false;
  showOverlayActivated = true; //! im moment immer true

  //TODO
  private logControllerState(): void {
    console.log("Controller: ", this);
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

  setupMapEvents(): void {
    //map.on("sourcedata", this.onSourceLoaded.bind(this));
    //map.on("data", this.onDataLoaded.bind(this)); // fired when any map data begins loading or changing asynchronously.
    map.on("click", this.onMapClick.bind(this));
    map.on("zoomstart", this.onMapZoomStart.bind(this));
    map.on("zoomend", this.onMapZoomEnd.bind(this));
    map.on("dragstart", this.onMapDragStart.bind(this));
    map.on("dragend", this.onMapDragEnd.bind(this));
  }

  onMapDragStart(): void {
    this.currentMapCenter = map.getCenter();
  }

  onMapDragEnd(): void {
    //* overlay needs to be updated all the time unfortunately :(
    if (this.showingOverlay) {
      createOverlay(FilterManager.allFilterLayers);
      return;
    }

    // Uses the Haversine Formula to calculate difference between tow latLng coords in meters
    const distance = this.currentMapCenter.distanceTo(map.getCenter());
    console.log("Distance", distance);
    // this is a threshold to avoid firing events with small moves
    if (distance < moveTreshold) {
      return;
    }
    console.log("Distance greater than treshold - updating");
    this.loadMapData();
  }

  onMapZoomStart(): void {
    this.currentZoom = map.getZoom();
  }

  onMapZoomEnd(): void {
    const newZoom = map.getZoom();

    if (this.showingOverlay) {
      createOverlay(FilterManager.allFilterLayers);
      //this.currentZoom = newZoom;
      return;
    }

    // don't update data if the zoom level change is below the treshold
    if (Math.abs(newZoom - this.currentZoom) <= zoomTreshold) {
      return;
    } else if (newZoom <= 8) {
      // performance optimization - dont show/update overlay below a certain zoomlevel
      //TODO snackbar nervt vllt wenn ständig angezeigt
      showSnackbar(
        "Die aktuelle Zoomstufe ist zu niedrig, um Daten zu aktualisieren!",
        SnackbarType.WARNING,
        2000
      );
      //this.currentZoom = newZoom;
      return;
    }
    console.log("new zoom is different enough - updating ...");
    this.loadMapData();

    //this.currentZoom = newZoom;
  }

  async onMapClick(e: MapMouseEvent & EventData): Promise<void> {
    //console.log("Click:", e);
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

  async loadMapData(): Promise<void> {
    const allCurrentFilters = FilterManager.activeFilters;

    if (allCurrentFilters.size === 0) {
      console.log("keine aktiven Filter, es kann nichts geladen werden");
      return;
    }

    this.logControllerState();

    console.log("Performing osm query for active filters: ", allCurrentFilters);

    // give feedback to the user
    showSnackbar("Daten werden geladen...", SnackbarType.INFO, undefined, true); //TODO doch zeitdauer?

    //get screen viewport and 500 meter around to compensate for the move treshold for new data
    const bounds = mapboxUtils.getViewportBoundsString(500);

    Benchmark.startMeasure("Performing osm query for active filters");

    const allResults = await Promise.allSettled(
      Array.from(allCurrentFilters).map(async (tag) => {
        // get overpass query for each tag
        const query = OsmTagCollection.getQueryForCategory(tag);

        Benchmark.startMeasure("Fetching data from osm");
        // request data from osm
        //const data = await fetchOsmDataFromClientVersion(bounds, query);
        const data = await fetchOsmDataFromServer(bounds, query);
        Benchmark.stopMeasure("Fetching data from osm");

        if (data) {
          //TODO das ist eigentlich nicht nötig hier sondern nur das filterlayer befüllen und dafür reichen die daten hier oder?
          const filterLayer = this.preprocessGeoData(data, tag);

          if (this.selectedVisualType === VisualType.NORMAL) {
            console.log("showing normal data");
            this.showDataOnMap(data, tag);
          } else {
            console.log("showing overlay data");
            if (filterLayer) {
              this.prepareDataForOverlay(filterLayer);
            }
          }
        }
      })
    );

    console.log("Finished adding data to map!");

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
    //TODO funktioniert nicht richtig im moment!
    hideSnackbar();

    Benchmark.stopMeasure("Performing osm query for active filters");

    console.log("before showOverlayAutomatically...");

    if (this.showOverlayActivated && FilterManager.allFilterLayers.length > 0) {
      //TODO remove legend and other map layers
      //console.log("updating overlay...\n", FilterManager.allFilterLayers);
      //this.showingOverlay = true;
      //createOverlay(FilterManager.allFilterLayers);
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

  //TODO use geojson merge (https://github.com/mapbox/geojson-merge) to merge existing and new features?
  //! or use filterlayer.features.push(...newData.features) !! ("features": [... GeoJSON1.features, ... GeoJSON2.features])

  //! Data preprocessing could (and probably should) already happen on the server!

  //! am besten gleich hier truncate und simplify von  turf anwenden!
  preprocessGeoData(
    data: FeatureCollection<GeometryObject, any>,
    dataName: string
  ): FilterLayer | null {
    const currentPoints: Set<Feature<Point, GeoJsonProperties>> = new Set();
    const currentWays: Set<Feature<LineString, GeoJsonProperties>> = new Set();
    const currentPolygons: Set<Feature<Polygon, GeoJsonProperties>> = new Set();

    // TODO simplify
    /*
    const options = { tolerance: 0.01, highQuality: false };
    const simplifiedPolygon = simplify(polygon, options);
    const options2 = { precision: 3, coordinates: 2, mutate: true};
    const truncated = truncate(point, options2);
    */

    //TODO jedem als property "type" den tag übergeben für legende?
    // oder besser gleich das filterlayer und dann dessen id and add/update geojsonsource

    //TODO kann da gleich etwas von später mit rein? z.B. der buffer?
    //TODO macht das überhaupt sinn multipolys zu flatten ? aber dann müsst ich mir später keine sorgen mehr machen
    //!alternativ könnte auch ausprobiert werden gleich data.features an das layer zu übergeben!
    for (let index = 0; index < data.features.length; index++) {
      const element = data.features[index];

      switch (element.geometry.type) {
        case "Point":
          currentPoints.add(element as Feature<Point, GeoJsonProperties>);
          break;

        case "MultiPoint":
          for (const coordinate of element.geometry.coordinates) {
            const point = {
              geometry: { type: "Point", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<Point, GeoJsonProperties>;

            currentPoints.add(point);
          }
          break;

        case "LineString": {
          currentWays.add(element as Feature<LineString, GeoJsonProperties>);
          break;
        }
        case "MultiLineString":
          for (const coordinate of element.geometry.coordinates) {
            const way = {
              geometry: { type: "LineString", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<LineString, GeoJsonProperties>;

            currentWays.add(way);
          }
          break;

        case "Polygon": {
          currentPolygons.add(element as Feature<Polygon, GeoJsonProperties>);
          break;
        }
        case "MultiPolygon":
          for (const coordinate of element.geometry.coordinates) {
            // construct a new polygon for every coordinate array in the multipolygon
            const polygon = {
              geometry: { type: "Polygon", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<Polygon, GeoJsonProperties>;

            currentPolygons.add(polygon);
          }
          break;
        case "GeometryCollection":
          break;

        default:
          throw new Error("Unknown geojson geometry type in data!");
      }
    }

    const allFeatures = [...currentPoints, ...currentWays, ...currentPolygons];
    console.log("allFeatures: ", allFeatures);

    this.logControllerState();

    const layer = FilterManager.getFilterLayer(dataName);
    if (layer) {
      layer.Features = allFeatures; //TODO push or = ?
    }
    //TODO what to do in else? create new? it should already exist at this point!

    return layer;
  }

  prepareDataForOverlay(data: FilterLayer): void {
    //const polyFeatures = mapboxUtils.convertAllFeaturesToPolygons(data.Features, 250);

    this.logControllerState();

    Benchmark.startMeasure("adding buffer to all features and converting to points");

    const bufferSize = data.Distance;
    for (let index = 0; index < data.Features.length; index++) {
      // add a buffer to all points, lines and polygons; this operation returns only polygons / multipolygons
      const bufferedPolygon = addBufferToFeature(data.Features[index], bufferSize, "meters");

      //TODO hier erst simplify?

      this.convertToPixels(data, bufferedPolygon);
    }

    /**
     * Result in FilterManager.allFilterLayers looks like this:
     *[
     *  { ### Park
     *    points: [{x: 49.1287; y: 12.3591}, ...], [{x: 49.1287; y: 12.3591}, ...], ...,
     *    radius: 500,
     *    relevance: 0.8,  //="very important"
     *    name: "Park"
     *  },
     *  { ### Restaurant
     *    points: [{x: 49.1287; y: 12.3591}, ...], [{x: 49.1287; y: 12.3591}, ...], ...,
     *    radius: 250,
     *    relevance: 0.2, // ="not very important"
     *    name: "Restaurant"
     *  },
     *  ...
     * ]
     */

    Benchmark.stopMeasure("adding buffer to all features and converting to points");
  }

  showDataOnMap(data: FeatureCollection<GeometryObject, any>, tagName: string): void {
    console.log("filter Data:", data);
    console.log("now adding to map...");
    console.log("Tagname: ", tagName);

    this.logControllerState();
    //TODO falls das auf den server ausgelagert wird, muss später nur noch die features und points nachträglich gefüllt werden (mit settern am besten!)

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

  convertToPixels(
    layer: FilterLayer,
    polygon: Feature<Polygon | MultiPolygon, GeoJsonProperties>
  ): void {
    const coords = polygon.geometry.coordinates;

    // check if this is a multidimensional array (i.e. a multipolygon)
    if (coords.length > 1) {
      //TODO oder will ich hier das das zu einem array "flatten" und nur dieses pushen??
      console.log("Multipolygon: ", coords);
      //const flattened: mapboxgl.Point[] = [];
      for (const coordPart of coords) {
        layer.Points.push(
          //@ts-expect-error
          coordPart.map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord))
        );
        //flattened.push(coordPart.map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord)));
      }
      // layer.Points.push(flattened);
      // or: layer.Points.push(...flattened);
    } else {
      console.log("Polygon");
      //@ts-expect-error
      //prettier-ignore
      const pointData = coords[0].map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord));
      layer.Points.push(pointData);
    }
  }

  addAreaOverlay(overlayData: any): void {
    console.log("FilterManager: ", FilterManager);

    // check that there is data to create an overlay for the map
    if (overlayData.length > 0) {
      createOverlay(overlayData);
    } else {
      console.warn("Creating an overlay is not possible because overlayData is empty!");
    }
  }
}
