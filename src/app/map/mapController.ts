/* eslint-env browser */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  GeometryObject,
  LineString,
  Point,
  Polygon,
} from "geojson";
import mapboxgl, { CustomLayerInterface, Layer, LngLatLike } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import { fetchOsmData } from "../network/networkUtils";
import { renderAndBlur } from "../webgl/blurFilter";
import LumaLayer from "../webgl/lumaLayer";
import { MapboxCustomLayer } from "../webgl/mapboxCustomLayer";
import { addBlurredImage, addCanvasOverlay } from "./canvasUtils";
import ClusterManager from "./clusterManager";
import { getDeckGlLayer } from "./deckLayer";
import { getDataFromMap, getPointsInRadius } from "./featureUtils";
import { map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import mapLayerManager from "./mapLayerManager";
import { loadSidebar } from "./mapTutorialStoreTest";
import { PerformanceMeasurer } from "./performanceMeasurer";
import { featureCollection } from "@turf/helpers";

//! add clear map data button or another option (or implement the removeMapData method correct) because atm
//! a filter can be deleted while fetching data which still adds the data but makes it impossible to delete the data on the map!!

/**
 * Main Controller Class for the mapbox map that handles all different aspects of the map.
 */
export default class MapController {
  //private mapData = new Map<string, number[]>(); // type as key, array of all points as value
  //TODO oder so:
  //private mapData = new Map<string, Map<string, number[]>>(); // sourcename as key, value: map from above
  //TODO oder so:
  private mapData = new Map<string, number[] | number[][]>(); // sourcename as key, array of all points as value or array of
  // array for polygon and linestring?? (basically do i want to flatten it??)

  //private currentData?: string;

  private currentPoints = new Set<Feature<Point, GeoJsonProperties>>();
  private currentWays = new Set<Feature<LineString, GeoJsonProperties>>();
  private currentPolygons = new Set<Feature<Polygon, GeoJsonProperties>>();

  private activeFilters: Set<string> = new Set();

  /**
   * Async init function that awaits the map load and resolves (or rejects) after the map has been fully loaded.
   * This should be the very first function to call to make sure all code later on
   * can safely assume that the map is ready to be used.
   */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      map.on("load", () => {
        // setup the initial map state
        this.setupMapState();

        resolve();
      });
      map.on("error", () => reject());
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

    //TODO
    loadSidebar();

    //map.showTileBoundaries = true;

    // setup event listeners on the map
    map.on("sourcedata", this.onSourceLoaded.bind(this));
    map.on("movestart", this.onMapMoveStart.bind(this));
    map.on("moveend", () => {
      //using an arrow function lets the this context stay the same as does bind(this)
      this.onMapMoveEnd();
    });
    // fired when any map data begins loading or changing asynchronously.
    //map.on("dataloading", this.onDataLoaded.bind(this));
    map.once("dataloading", this.onDataLoaded.bind(this));
    map.on("click", this.onMapClick.bind(this));

    /** 
     * * Example for updating an overlay while hovering over features:
    map.on("mousemove", function (e) {
      var states = map.queryRenderedFeatures(e.point, {
        layers: ["statedata"],
      });

      if (states.length > 0) {
        document.getElementById("pd").innerHTML =
          "<h3><strong>" +
          states[0].properties.name +
          "</strong></h3><p><strong><em>" +
          states[0].properties.density +
          "</strong> people per square mile</em></p>";
      } else {
        document.getElementById("pd").innerHTML = "<p>Hover over a state!</p>";
      }
    });
    */
  }

  async onMapMoveStart(): Promise<void> {
    //console.log("Move start event fired!");
    //const pois = await getPoiTypes();
    //console.log(pois);
  }

  async onMapMoveEnd(): Promise<void> {
    //use tilequery API
    //TODO idee: alle häuser in abstand bekommen, indem erst mit tilequery api landuse oder building extrahiert
    //TODO und dann z.b. mit turf distanz oder der LatLng.distanceto()-Methode zu allen queryRendered features
    //TODO bekommen und dann diese gebiete markieren
    //mapboxUtils.testTilequeryAPI();
    //refetch all data for the current viewport
    //TODO !!
    this.reloadData();
  }

  onSourceLoaded(): void {
    /*
      console.log(e.source);
      if (e.isSourceLoaded) {
        // Do something when the source has finished loading
        console.log(e.sourceId);
        console.log(e.source);
        console.log(e.coord);
        console.log(e.tile);

       testGetQueryFeatures(e.source.name)
      }
      */
  }

  onDataLoaded(): void {
    //console.log("A dataloading event occurred.");
  }

  //TODO should all map click events be handled here? -> probably
  async onMapClick(e: mapboxgl.MapMouseEvent & mapboxgl.EventData): Promise<void> {
    console.log("Click:", e);

    /*
    getPointsInRadius(map);

    //!not working rigth now
    //sortDistances(e.lngLat);

    //addWebglCircle(map);
    */
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

  addActiveFilter(filter: string): void {
    this.activeFilters.add(filter);
  }

  //TODO remove map data in here? so everything is in one place?
  removeActiveFilter(filter: string): void {
    this.activeFilters.delete(filter);
  }

  reloadData(): void {
    //TODO load data new on every move, works but needs another source than overpass api mirror
    this.activeFilters.forEach(async (param) => {
      Benchmark.startMeasure("Fetching data on moveend");
      const data = await fetchOsmData(this.getViewportBoundsString(), param);
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
  getViewportBoundsString(): string {
    const currBounds = map.getBounds();
    const southLat = currBounds.getSouth();
    const westLng = currBounds.getWest();
    const northLat = currBounds.getNorth();
    const eastLng = currBounds.getEast();

    return `${southLat},${westLng},${northLat},${eastLng}`;
  }

  addVectorData(data: string): void {
    mapLayerManager.addVectorLayer(data);
  }

  testLocalVectorData(): void {
    mapLayerManager.addLocalVectorData();
  }

  //! this could be used to get all pois in the tileset without the limitations of the tilequeryAPI
  //! but unfortunately not all data is visible on all layers (neither is it with the tilequeryAPI btw) but
  //! this problem remains here as well
  addMapboxStreetsVectorData(): void {
    // Add a circle layer with a vector source
    map.addLayer({
      id: "points-of-interest",
      source: {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8", // use the mapbox street tileset as the source
      },
      "source-layer": "poi_label",
      type: "circle",
    });
  }

  removeData(sourceName: string): void {
    mapLayerManager.removeSource(sourceName);
  }

  preprocessGeoData(data: FeatureCollection<GeometryObject, any>): void {
    //TODO reset the classSets so there are always only the current features in them ??
    // another option would be to let them be and use them as a client side cache later???
    this.currentPoints = new Set();
    this.currentWays = new Set();
    this.currentPolygons = new Set();

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

    //mapboxUtils.getDifferenceBetweenViewportAndFeature([...this.currentPoints]);
    mapboxUtils.showDifferenceBetweenViewportAndFeature(allFeatures);

    mapLayerManager.removeAllLayersForSource("currFeatures");

    // show the points
    const layer: Layer = {
      id: "points",
      source: "currFeatures",
      type: "circle",
      paint: {
        "circle-color": "rgba(255, 0, 0, 1)",
      },
    };

    if (map.getSource("currFeatures")) {
      // the source already exists, only update the data
      console.log(`Source ${"currFeatures"} is already used! Updating it!`);
      mapLayerManager.updateSource("currFeatures", featureCollection(allFeatures));
    } else {
      // source doesn't exist yet, create a new one
      mapLayerManager.addNewGeojsonSource("currFeatures", featureCollection(allFeatures), false);
    }

    mapLayerManager.addNewLayer(layer, true);
    //mapLayerManager.addLayers("currFeatures");
  }

  showData(data: FeatureCollection<GeometryObject, any>, sourceName: string): void {
    console.log("original Data:", data);
    console.log("now adding to map...");
    console.log(sourceName);

    //TODO macht das Sinn alle Layer zu löschen???? oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
    mapLayerManager.removeAllLayersForSource(sourceName);

    //TODO
    this.preprocessGeoData(data);
    return;

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

    //testGettingNearbyFeatures(sourceName);
  }

  blurMap(): void {
    if (!map.loaded) {
      console.error("The map is not ready yet!");
      return;
    }

    const mapCanvas = map.getCanvas();

    //const gl = mapCanvas.getContext("webgl");
    //console.log("Mapbox GL context: ", gl);
    //console.log("viewport:", gl?.VIEWPORT);
    //if (!gl) return;

    const img = new Image();
    img.src = mapCanvas.toDataURL();
    //console.log(img.src); // um bild anzuschauen copy paste in adress bar in browser

    img.onload = () => {
      img.width = mapCanvas.clientWidth; //use clientWidth and Height so the image fits the current screen size
      img.height = mapCanvas.clientHeight;

      // perf-results: 101,6 ; 101,2 ; 82,6 ; 62,7 ; 45,9 (ms) -> avg: 78,8 ms (vllt lieber median?)
      Benchmark.startMeasure("blur Image with Webgl");
      const canvas = renderAndBlur(img);
      Benchmark.stopMeasure("blur Image with Webgl");

      if (canvas) {
        // perf-results:  7,8; 12,5; 10,9; 7,3; 6,8  (ms) -> avg: 9,06 ms
        Benchmark.startMeasure("addingCanvasOverlay");
        addCanvasOverlay(canvas);
        Benchmark.stopMeasure("addingCanvasOverlay");

        // perf-results:  178; 187; 160; 93; 111 (ms) -> avg: 145,8 ms
        //addBlurredImage(img, canvas);
      }
    };
  }

  /**
   * TODO statt dem Custom Layer wäre es vllt sinnvoller auf events wie load, render oder layer added zu lauschen 
   * und bevor es gezeichnet wird in dem Moment dann das mit dem Canvas und dem Blurren etc. zu machen?
   * Beispiel:
   map.on("render", function() {
    if(map.loaded()) {
      map.featuresIn(...);
    }
   });
   */

  /**
   * TODO 21.09
   * 1. geojson daten speichern bevor zu layer hinzufügen, am besten separat pro layer und per type (point, linestring, polygon)
   * 2. diese dann an vertex shader übergeben
   * 3. in fragment shader dann kreis um alle punkte zeichnen -> fill gray -> am ende dann blur
   */

  /**
   * * für linestring könnte man einen buffer mit der vom nutzer angegebenen breite an beide seiten des linestrings anfügen und den blurren?
   * * bei polygon entweder auch das oder vllt das zentrum der umschließenden bounding box nehmen?
   */

  //TODO mal mit requestAnimationFrame versuchen zum updaten statt ein neues Layer bei jeder Bewegung zu machen?
  /*
  requestAnimationFrame(function draw() {
    requestAnimationFrame(draw);

    clear(gl, {
        color: [0, 0, 0, 1]
    });
    customLayer.draw();
  });
  */

  addWebGlLayer(): void {
    if (map.getLayer("webglCustomLayer")) {
      // the layer exists already; remove it
      map.removeLayer("webglCustomLayer");
    }

    console.log("adding webgl data...");

    const mapData = getDataFromMap(this.activeFilters);

    const customLayer = new MapboxCustomLayer(mapData) as CustomLayerInterface;

    //const firstSymbolId = mapLayerManager.findLayerByType(map, "symbol");
    // Insert the layer beneath the first symbol layer in the layer stack if one exists.
    //map.addLayer(customLayer, firstSymbolId);
    map.addLayer(customLayer, "waterway-label");

    console.log("Finished adding webgl data!");
  }

  //TODO
  addHeatmap(data?: string): void {
    mapLayerManager.addHeatmapLayer(data);
    mapboxUtils.addLegend();
  }

  addDeckLayer(): void {
    //* für normale Deck Layer:
    const deck = getDeckGlLayer("GeojsonLayer", "../assets/data.geojson", "geojsonLayer-1");
    const layer = (deck as unknown) as CustomLayerInterface;

    //const deck2 = createOverlay("../assets/data.geojson");
    //const layer2 = (deck2 as unknown) as CustomLayerInterface;

    //* für Mapbox Layer:
    //const layer = createMapboxLayer("../assets/data.geojson", HeatmapLayer);  //TODO um die heatmap auszuprobieren brauch ich andere Daten als Geojson
    //const layer = createMapboxLayer("../assets/data.geojson", GeoJsonLayer);
    //const layerAround = createNewMapboxLayer("../assets/data.geojson", GeoJsonLayer, 500);

    //* add the layer before the waterway-label to make sure it is placed below map labels!
    map.addLayer(layer, "waterway-label");
    //map.addLayer(layerAround, "mapboxLayer");
    //map.addLayer(layer2, "waterway-label");

    //* Alternative für Mapbox Layer:
    //createMapboxDeck("../assets/data.geojson");
  }

  addLumaGlLayer(): void {
    console.log("adding luma layer ...");

    const uniSouthWest = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: 12.089283,
      lat: 48.9920256,
    });
    const uniSouthEast = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: 12.1025303,
      lat: 48.9941069,
    });
    const uniNorthWest = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: 12.0909411,
      lat: 49.0012031,
    });

    const data = [uniSouthEast, uniNorthWest, uniSouthWest];

    const animationLoop = new LumaLayer(data);
  }
}
