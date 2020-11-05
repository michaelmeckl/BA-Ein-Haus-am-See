/* eslint-env browser */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import bbox from "@turf/bbox";
import bbpolygon from "@turf/bbox-polygon";
import { featureCollection } from "@turf/helpers";
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
import mapboxgl, {
  CustomLayerInterface,
  EventData,
  Layer,
  MapDataEvent,
  MapMouseEvent,
  MapSourceDataEvent,
  MapTouchEvent,
} from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import { FilterLayer, FilterRelevance } from "../mapData/filterLayer";
import FilterManager from "../mapData/filterManager";
import mapLayerManager from "../mapData/mapLayerManager";
import { fetchOsmDataFromServer } from "../network/networkUtils";
import { MapboxCustomLayer } from "../webgl/mapboxCustomLayer";
import { createCanvasOverlay, updateOverlay } from "./canvasRenderer";
import { getDataFromMap } from "./featureUtils";
import { map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import { PerformanceMeasurer } from "./performanceMeasurer";
import { addBufferToFeature } from "./turfUtils";

//! add clear map data button or another option (or implement the removeMapData method correct) because atm
//! a filter can be deleted while fetching data which still adds the data but makes it impossible to delete the data on the map!!

//export let originalMapImage: HTMLImageElement | undefined;

/**
 * Main Controller Class for the mapbox map that handles all different aspects of the map.
 */
export default class MapController {
  private currentPoints = new Set<Feature<Point, GeoJsonProperties>>();
  private currentWays = new Set<Feature<LineString, GeoJsonProperties>>();
  private currentPolygons = new Set<Feature<Polygon, GeoJsonProperties>>();
  //prettier-ignore
  private allPolygonFeatures: Map<string, Feature<Polygon | MultiPolygon, GeoJsonProperties>[]> = new Map();

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

    //map.on("moveend", this.onMapMoveEnd.bind(this));
    map.on("zoomend", this.onMapZoomEvent.bind(this));
    map.on("dragend", this.onMapDragEnd.bind(this));
  }

  async onMapMoveEnd(e: { originalEvent: DragEvent }): Promise<void> {
    console.log("A moveend event occurred:", e.originalEvent);
    //TODO refetch all data for the current viewport
    //this.reloadData();
  }

  onMapDragEnd(e: { originalEvent: DragEvent }): void {
    console.log("A dragend event occurred:", e.originalEvent);
    //TODO updateOverlay();
  }

  onMapZoomEvent(e: MapMouseEvent | MapTouchEvent): void {
    console.log("A zoomend event occurred: ", e);
  }

  onSourceLoaded(e: MapSourceDataEvent): void {
    if (e.isSourceLoaded) {
      // the source has finished loading
      console.log("onSourceLoaded ", e);
    }
  }

  onDataLoaded(e: MapDataEvent): void {
    if (e.dataType === "source") {
      const e2 = e as MapSourceDataEvent;
      console.log(" e is a MapSourceDataEvent");
    }
    console.log("A dataloading event occurred: ", e);
  }

  async onMapClick(e: MapMouseEvent & EventData): Promise<void> {
    console.log("Click:", e);

    //TODO
    //getAllRenderedFeatures(undefined, undefined, ["==", "class", "park"]);
    //getAllSourceFeatures("amenity=restaurant");
  }

  addMapControls(): void {
    // Add navigation controls to the map
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
      })
    );
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    //map.addControl(new mapboxgl.GeolocateControl(), "bottom-right");

    // Add the geocoder to the map
    map.addControl(Geocoder.geocoderControl, "bottom-left");
  }

  reloadData(): void {
    //TODO load data new on every move, works but needs another source than overpass api mirror
    FilterManager.activeFilters.forEach(async (param) => {
      Benchmark.startMeasure("Fetching data on moveend");
      const data = await fetchOsmDataFromServer(this.getViewportBoundsString(), param);
      console.log(Benchmark.stopMeasure("Fetching data on moveend"));

      if (data) {
        const t0 = performance.now();
        this.showData(data, param);
        const t1 = performance.now();
        console.log("Adding data to map took " + (t1 - t0).toFixed(3) + " milliseconds.");

        console.log("Finished adding data to map!");
      }
    });

    //TODO use this callback instead of the code above to reload on every move?
    /*
    // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
    map.on('data', function(e) {
    if (e.sourceId !== 'bars' || !e.isSourceLoaded) return;

    map.on('move', updateMarkers);
    map.on('moveend', updateMarkers);
    updateMarkers();
    });
    */
  }

  /**
   * Get the current bounding box, in order:
   * southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude.
   * @return string representation of the bounds in the above order
   */
  getViewportBoundsString(additionalDistance?: number): string {
    const currBounds = map.getBounds();
    let southLat = currBounds.getSouth();
    let westLng = currBounds.getWest();
    let northLat = currBounds.getNorth();
    let eastLng = currBounds.getEast();
    //console.log(currBounds);

    if (additionalDistance) {
      const bufferedBBox = bbox(
        addBufferToFeature(bbpolygon([westLng, southLat, eastLng, northLat]), additionalDistance)
      );
      //console.log(bufferedBBox);

      southLat = bufferedBBox[1];
      westLng = bufferedBBox[0];
      northLat = bufferedBBox[3];
      eastLng = bufferedBBox[2];
    }

    return `${southLat},${westLng},${northLat},${eastLng}`;
  }

  //TODO
  /*
  getBBoxForBayern(): string {
    const mittelpunktOberpfalz = point([12.136, 49.402]);
    const radiusOberpfalz = 100; //km

    const mittelpunktBayern = point([11.404, 48.946]);
    const radiusBayern = 200; //km

    //@ts-expect-error
    const centerPoint = circle(mittelpunktOberpfalz, radiusOberpfalz, { units: "kilometers" });

    const bboxExtent = bbox(centerPoint);
    //console.log("Bbox: ", bboxExtent);

    const bboxExtent2 = bbpolygon(bboxExtent);

    return `${bboxExtent[1]},${bboxExtent[0]},${bboxExtent[3]},${bboxExtent[2]}`;
  }

  showCurrentViewportCircle(): void {
    const { center, radius } = mapboxUtils.getRadiusAndCenterOfViewport();
    //@ts-expect-error
    const viewportCirclePolygon = circle([center.lng, center.lat], radius, { units: "meters" });

    mapLayerManager.addNewGeojsonSource("viewportCircle", viewportCirclePolygon);
    const newLayer: Layer = {
      id: "viewportCircleLayer",
      source: "viewportCircle",
      type: "fill",
      paint: {
        "fill-color": "rgba(255, 255, 0, 0.15)",
      },
    };
    mapLayerManager.addNewLayer(newLayer, true);
  }
  */

  removeData(sourceName: string): void {
    console.log("Removing source: ", sourceName);
    mapLayerManager.removeSource(sourceName);
  }

  preprocessGeoData(data: FeatureCollection<GeometryObject, any>, dataName: string): void {
    // TODO another option would be to let them be and use them as a client side cache later???
    this.currentPoints.clear();
    this.currentWays.clear();
    this.currentPolygons.clear();

    for (let index = 0; index < data.features.length; index++) {
      const element = data.features[index];

      switch (element.geometry.type) {
        case "Point":
          this.currentPoints.add(element as Feature<Point, GeoJsonProperties>);
          break;

        case "MultiPoint":
          for (const coordinate of element.geometry.coordinates) {
            const point = {
              geometry: { type: "Point", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<Point, GeoJsonProperties>;

            this.currentPoints.add(point);
          }
          break;

        case "LineString": {
          this.currentWays.add(element as Feature<LineString, GeoJsonProperties>);
          break;
        }
        case "MultiLineString":
          for (const coordinate of element.geometry.coordinates) {
            const way = {
              geometry: { type: "LineString", coordinates: coordinate },
              properties: { ...element.properties },
              type: "Feature",
            } as Feature<LineString, GeoJsonProperties>;

            this.currentWays.add(way);
          }
          break;

        case "Polygon": {
          this.currentPolygons.add(element as Feature<Polygon, GeoJsonProperties>);
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

            this.currentPolygons.add(polygon);
          }
          break;

        default:
          throw new Error("Unknown geojson geometry type in data!");
      }
    }

    console.log("this.currentPoints: ", this.currentPoints);
    console.log("this.currentWays: ", this.currentWays);
    console.log("this.currentPolygons: ", this.currentPolygons);

    const allFeatures = [...this.currentPoints, ...this.currentWays, ...this.currentPolygons];
    const polyFeatures = mapboxUtils.convertAllFeaturesToPolygons(allFeatures, 250);
    this.allPolygonFeatures.set(dataName, polyFeatures); //TODO überflüssign wenn mit filterLayers

    const layer = FilterManager.getFilterLayer(dataName);
    if (layer) {
      layer.Features = polyFeatures;
    }
    //this.showPreprocessedData(dataName, polyFeatures);
  }

  //TODO das funktioniert im moment irgendwie noch nicht richtig mit mehreren hintereinander?
  showPreprocessedData(
    sourceName: string,
    polygonFeatures: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]
  ): void {
    mapLayerManager.removeAllLayersForSource(sourceName);

    const layer: Layer = {
      id: "currFeatures-Layer",
      source: sourceName,
      type: "fill",
      paint: {
        "fill-color": "rgba(170, 170, 170, 0.5)",
      },
    };

    if (map.getSource(sourceName)) {
      // the source already exists, only update the data
      console.log(`Source ${sourceName} is already used! Updating it!`);
      mapLayerManager.updateSource(sourceName, featureCollection(polygonFeatures));
    } else {
      // source doesn't exist yet, create a new one
      mapLayerManager.addNewGeojsonSource(sourceName, featureCollection(polygonFeatures), false);
    }

    mapLayerManager.addNewLayer(layer, true);
  }

  //TODO parameter wie distance und relevance müssen vom nutzer eingegeben werden können!
  showData(
    data: FeatureCollection<GeometryObject, any>,
    sourceName: string,
    distance?: number,
    relevance?: FilterRelevance,
    wanted?: boolean
  ): void {
    console.log("original Data:", data);
    console.log("now adding to map...");
    console.log(sourceName);

    //TODO falls das auf den server ausgelagert wird, muss später nur noch die features und points nachträglich gefüllt werden (mit settern am besten!)
    FilterManager.addFilter(new FilterLayer(sourceName, distance, relevance, wanted));

    //TODO macht das Sinn alle Layer zu löschen???? oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
    mapLayerManager.removeAllLayersForSource(sourceName);

    //! Data preprocessing could (and probably should) already happen on the server!
    this.preprocessGeoData(data, sourceName);
    //return; //TODO

    if (map.getSource(sourceName)) {
      // the source already exists, only update the data
      console.log(`Source ${sourceName} is already used! Updating it!`);
      mapLayerManager.updateSource(sourceName, data);
    } else {
      // source doesn't exist yet, create a new one
      mapLayerManager.addNewGeojsonSource(sourceName, data, false);
    }

    //show the source data on the map
    mapLayerManager.addLayers(sourceName);
  }

  addWebGlLayer(data: any): void {
    if (map.getLayer("webglCustomLayer")) {
      // the layer exists already; remove it
      map.removeLayer("webglCustomLayer");
    }

    console.log("adding webgl data...");

    const mapData = getDataFromMap(FilterManager.activeFilters);
    const customLayer = new MapboxCustomLayer(mapData) as CustomLayerInterface;
    map.addLayer(customLayer, "waterway-label");

    console.log("Finished adding webgl data!");
  }

  addHeatmap(data?: string): void {
    mapLayerManager.addHeatmapLayer(data);
    mapboxUtils.addLegend();
  }

  addLumaGlLayer(): void {
    console.log(this.allPolygonFeatures);

    /*
    const currentMapData: Feature<Polygon | MultiPolygon, GeoJsonProperties>[][][] = [];
    let ii = 0;
    this.activeFilters.forEach((filter) => {
      const polyData = this.allPolygonFeatures.get(filter);
      if (polyData) {
        currentMapData[ii] = []; // needs to be initialized before adding data!
        currentMapData[ii].push(polyData);
      }
      ii++;
    });
    console.log("currentMapData: ", currentMapData);
    */

    const overlayData: FilterLayer[] = [];
    //const overlayData: mapboxgl.Point[][][] = [];

    console.log(FilterManager.activeFilters);
    console.log(FilterManager.allFilterLayers);
    console.log(FilterManager);

    //! wenn die polygon features sonst nirgendwo gebraucht werden, könnte man gleich oben wenn sie in die Map
    //! gespeichert werden, sie zu mapboxgl.Points umwandeln, dann könnte man vllt die doppelte for-schleife hier vermeiden

    let i = 0;
    for (const [name, features] of this.allPolygonFeatures.entries()) {
      overlayData[i] = new FilterLayer(name); //TODO oder lieber gleich statt this.allPolygonFeatures?
      for (let index = 0; index < features.length; index++) {
        const feature = features[index];
        const coords = feature.geometry.coordinates;

        // check if this is a multidimensional array (i.e. a multipolygon or a normal one)
        if (coords.length > 1) {
          //? oder will ich hier das das zu einem array "flatten" und nur dieses pushen??
          console.log("Multipolygon: ", coords);
          //const flattened: mapboxgl.Point[] = [];
          for (const coordPart of coords) {
            //@ts-expect-error
            //prettier-ignore
            overlayData[i].Points.push(coordPart.map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord)));
            //flattened.push(coordPart.map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord)));
          }
          // overlayData[i].push(flattened);
        } else {
          console.log("Polygon");
          //@ts-expect-error
          //prettier-ignore
          const pointData = coords[0].map((coord: number[]) => mapboxUtils.convertToPixelCoord(coord));
          overlayData[i].Points.push(pointData);

          //TODO das statt dem overlay data dann verwenden
          const filterLayer = FilterManager.getFilterLayer(name);
          if (filterLayer) {
            filterLayer.Points = pointData;
          }
        }
      }
      i++;
    }

    /**
     *[
     *  { ### Park
     *    points: [{x: 49.1287; y: 12.3591}, ...], [{x: 49.1287; y: 12.3591}, ...], ...,
     *    radius: 500,
     *    relevance: "very important",
     *    name: "Park"  ?? (vllt nicht relevant)
     *  },
     *  { ### Restaurant
     *    points: [{x: 49.1287; y: 12.3591}, ...], [{x: 49.1287; y: 12.3591}, ...], ...,
     *    radius: 2000,
     *    relevance: "not very important",
     *  },
     *  ...
     * ]
     */

    console.log("OverlayData: ", overlayData);

    // check that there is data to overlay the map with
    if (overlayData.length > 0) {
      createCanvasOverlay(overlayData);
    } else {
      console.warn("Creating an overlay is not possible because overlayData is empty!");
    }
  }
}
