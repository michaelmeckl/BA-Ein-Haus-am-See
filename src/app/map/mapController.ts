/* eslint-env browser */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
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
import mapboxgl, { CustomLayerInterface, Layer, LngLatLike } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import { fetchMaskData, fetchOsmData } from "../network/networkUtils";
import { renderAndBlur } from "../webgl/blurFilter";
import LumaLayer from "../webgl/lumaLayer";
import { MapboxCustomLayer } from "../webgl/mapboxCustomLayer";
import { addBlurredImage, addCanvasOverlay } from "./canvasUtils";
import ClusterManager from "./clusterManager";
import CustomScatterplotLayer, { createMapboxLayer, getDeckGlLayer } from "./deckLayer";
import { getAllRenderedFeatures, getAllSourceFeatures, getDataFromMap } from "./featureUtils";
import { map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import mapLayerManager from "./mapLayerManager";
import { loadLocations } from "./locationsPanel";
import { PerformanceMeasurer } from "./performanceMeasurer";
import { featureCollection, point } from "@turf/helpers";
import circle from "@turf/circle";
import bbpolygon from "@turf/bbox-polygon";
import bbox from "@turf/bbox";
import geojsonCoords from "@mapbox/geojson-coords";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { addWebglCircle } from "../webgl/webglCircle";
import { testCampusExampes } from "../webgl/successfulExamples";
import createOverlay from "../webgl/overlayCreator";
import { resolve } from "path";
import { reject } from "lodash";
import html2canvas from "html2canvas";
import { FilterLayer, FilterRelevance } from "../mapData/filterLayer";
import createCanvasOverlay from "./canvasRenderer";
import FilterManager from "../mapData/filterManager";

//! add clear map data button or another option (or implement the removeMapData method correct) because atm
//! a filter can be deleted while fetching data which still adds the data but makes it impossible to delete the data on the map!!

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
    //this.reloadData();
    //this.blurMap();
    //this.addLumaGlLayer();
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

  async onMapClick(e: mapboxgl.MapMouseEvent & mapboxgl.EventData): Promise<void> {
    console.log("Click:", e);

    //addWebglCircle(map);

    //testCampusExampes();

    //this.showCurrentViewportCircle();

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

  //TODO
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

    //@ts-expect-error
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
    this.allPolygonFeatures.set(dataName, polyFeatures); //überflüssign wenn mit filterLayers

    const layer = FilterManager.getFilterLayer(dataName);
    if (layer) {
      layer.Features = polyFeatures;
    }

    //this.calculateMaskAndShowData(allFeatures);
    //this.showPreprocessedData(dataName, polyFeatures);
  }

  calculateMaskAndShowData(
    allFeatures: (
      | Feature<Point, GeoJsonProperties>
      | Feature<LineString, GeoJsonProperties>
      | Feature<Polygon, GeoJsonProperties>
    )[]
  ): void {
    //mapboxUtils.getDifferenceBetweenViewportAndFeature([...this.currentPoints]);
    mapboxUtils.showDifferenceBetweenViewportAndFeature(allFeatures).then((data) => {
      console.log("returned data: ", data);
      //this.addDeckLayer(data);

      let newData = geojsonCoords(data);
      console.log("Data after geojson coords: ", newData);
      newData = newData.slice(5, newData.length); //remove the first 5 because they are clipspace coords from turf.mask
      console.log("Data after slice: ", newData);
      const MercatorCoordinates = newData.map((el: any) =>
        mapboxgl.MercatorCoordinate.fromLngLat(el)
      );
      const customData = MercatorCoordinates.flatMap((x: any) => [x.x, x.y]);
      this.addWebGlLayer(customData);
    });
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

  blurMap(): void {
    if (!map.loaded) {
      console.error("The map is not ready yet!");
      return;
    }

    const mapCanvas = map.getCanvas();

    //const gl = mapCanvas.getContext("webgl2");
    //console.log("Mapbox GL context: ", gl);
    //console.log("viewport:", gl?.VIEWPORT);
    //if (!gl) return;

    const img = new Image();

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
    img.src = mapCanvas.toDataURL();
    //console.log(img.src); // um bild anzuschauen copy paste in adress bar in browser
  }

  /**
   * TODO test this again!
   * 1. geojson daten speichern bevor zu layer hinzufügen, am besten separat pro layer und per type (point, linestring, polygon)
   * 2. diese dann an vertex shader übergeben
   * 3. in fragment shader dann kreis um alle punkte zeichnen -> fill gray -> am ende dann blur
   */

  addWebGlLayer(data: any): void {
    if (map.getLayer("webglCustomLayer")) {
      // the layer exists already; remove it
      map.removeLayer("webglCustomLayer");
    }

    console.log("adding webgl data...");

    const mapData = getDataFromMap(FilterManager.activeFilters);
    const customLayer = new MapboxCustomLayer(mapData) as CustomLayerInterface;
    map.addLayer(customLayer, "waterway-label");

    //TODO das rendert immer nur eines!
    /*
    for (const element of this.allPolygonFeatures) {
      const newData = geojsonCoords(element);
      //console.log("Data after geojson coords: ", newData);
      const MercatorCoordinates = newData.map((el: any) =>
        mapboxgl.MercatorCoordinate.fromLngLat(el)
      );
      const mapData = MercatorCoordinates.flatMap((x: any) => [x.x, x.y]);

      //console.log("MapData: ", mapData);
      const customLayer = new MapboxCustomLayer(mapData) as CustomLayerInterface;
      //TODO zieht mit den mask-Daten nur Triangles zwischen den einzelnen punkten, was dazu führt,
      //TODO dass letzlich nur eine Art dünne linie um alle gezogen wird
      //const customLayer = new MapboxCustomLayer(data) as CustomLayerInterface;

      //const firstSymbolId = mapLayerManager.findLayerByType(map, "symbol");
      // Insert the layer beneath the first symbol layer in the layer stack if one exists.
      map.addLayer(customLayer, "waterway-label");
    }
    */

    console.log("Finished adding webgl data!");
  }

  //TODO
  addHeatmap(data?: string): void {
    mapLayerManager.addHeatmapLayer(data);
    mapboxUtils.addLegend();
  }

  //TODO die polygon maske sollte am besten direkt vom server (und da aus der lokalen datei) ins deckgl geojson layer
  // geladen werden!
  addDeckLayer(data: any): void {
    //* für normale Deck Layer:
    //const deck = getDeckGlLayer("GeojsonLayer", data, "geojsonLayer-1");
    //const deck = getDeckGlLayer("GeojsonLayer", "../assets/data.geojson", "geojsonLayer-1");
    const deck = getDeckGlLayer("ScatterplotLayer", "../assets/data.geojson", "customscatterplot");
    const layer = (deck as unknown) as CustomLayerInterface;

    //const deck2 = createOverlay("../assets/data.geojson");
    //const layer2 = (deck2 as unknown) as CustomLayerInterface;

    //* für Mapbox Layer:
    //const layer = createMapboxLayer("../assets/data.geojson", HeatmapLayer);  //TODO um die heatmap auszuprobieren brauch ich andere Daten als Geojson
    //const layer = createMapboxLayer("../assets/data.geojson", CustomScatterplotLayer);
    //const layerAround = createNewMapboxLayer("../assets/data.geojson", GeoJsonLayer, 500);

    //* add the layer before the waterway-label to make sure it is placed below map labels!
    map.addLayer(layer, "waterway-label");
    //map.addLayer(layerAround, "mapboxLayer");
    //map.addLayer(layer2, "waterway-label");

    //* Alternative für Mapbox Layer:
    //createMapboxDeck("../assets/data.geojson");
  }

  addLumaGlLayer(): void {
    const usw = {
      lng: 12.089283,
      lat: 48.9920256,
    };
    const use = {
      lng: 12.1025303,
      lat: 48.9941069,
    };
    const unw = {
      lng: 12.0909411,
      lat: 49.0012031,
    };

    const uniSouthWest = mapboxgl.MercatorCoordinate.fromLngLat(usw);
    const uniSouthEast = mapboxgl.MercatorCoordinate.fromLngLat(use);
    const uniNorthWest = mapboxgl.MercatorCoordinate.fromLngLat(unw);

    const data = [uniSouthEast, uniNorthWest, uniSouthWest];

    const data2 = [
      mapboxgl.MercatorCoordinate.fromLngLat({
        lng: 12.091103196144104,
        lat: 49.01015216135008,
      }),
      mapboxgl.MercatorCoordinate.fromLngLat({
        lng: 12.10141897201538,
        lat: 49.0095997290631,
      }),
      mapboxgl.MercatorCoordinate.fromLngLat({
        lng: 12.095990180969238,
        lat: 49.016689397702294,
      }),

      mapboxgl.MercatorCoordinate.fromLngLat({
        lng: 12.12177370071411,
        lat: 49.0198169751917,
      }),
    ];

    //TODO this should of course happen somewhere else later but for now just test it here:
    // ########################  Overlay Stuff starts #######################

    const ab = {
      lng: 12.09822,
      lat: 49.006714,
    };

    const cd = {
      lng: 12.09299,
      lat: 49.006714,
    };

    const ef = {
      lng: 12.084302,
      lat: 49.017167,
    };

    const gh = {
      lng: 12.083916,
      lat: 49.015225,
    };

    const ij = {
      lng: 12.0873,
      lat: 49.014634,
    };

    const kl = {
      lng: 12.088203,
      lat: 49.015844,
    };

    const aa = { lng: 12.106899071216729, lat: 49.011636152227666 };
    const aaa = { lng: 12.106187741742344, lat: 49.012298273504406 };
    const ac = { lng: 12.105293115952813, lat: 49.012856640245396 };
    const ad = { lng: 12.104249578251874, lat: 49.01328978965319 };
    const ae = { lng: 12.103097240488244, lat: 49.013581072390174 };
    const af = { lng: 12.101880399066786, lat: 49.01371929295886 };
    const ag = { lng: 12.100645830727052, lat: 49.013699140192415 };
    const ah = { lng: 12.099440992775836, lat: 49.01352139127261 };
    const aj = { lng: 12.098312197267857, lat: 49.01319288144877 };
    const ak = { lng: 12.097302829613584, lat: 49.01272624068412 };
    const al = { lng: 12.096451680322966, lat: 49.012139407453525 };
    const am = { lng: 12.095791454144237, lat: 49.011454938505246 };
    const an = { lng: 12.095347513915694, lat: 49.01069914124463 };

    console.log(this.allPolygonFeatures);
    console.log(this.allPolygonFeatures.size);

    const overlayAlternative: mapboxgl.Point[][][] = [];

    const poly0 = [usw, use, ab];
    const poly1 = [usw, use, unw, ab, cd];
    const poly2 = [ef, gh, ij, kl];
    const poly3 = [usw, use, ab, cd];
    const kreis = [aa, aa, aaa, ac, ad, ae, af, ag, ah, aj, ak, al, am, an];

    // layer 1
    overlayAlternative[0] = []; //! WICHTIG
    overlayAlternative[0].push(poly1.map((el) => mapboxUtils.convertToPixelCoord(el)));
    overlayAlternative[0].push(poly2.map((el) => mapboxUtils.convertToPixelCoord(el)));
    // layer 2
    overlayAlternative[1] = [];
    overlayAlternative[1].push(poly0.map((el) => mapboxUtils.convertToPixelCoord(el)));
    overlayAlternative[1].push(kreis.map((el) => mapboxUtils.convertToPixelCoord(el)));
    // layer 3
    overlayAlternative[2] = [];
    overlayAlternative[2].push(poly3.map((el) => mapboxUtils.convertToPixelCoord(el)));

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
          //TODO Multipolygone führen aber so zum Beispiel bei der Donau zu vollkommen falschen Renderergebnissen!!
          //TODO vllt doch direkt im shader statt mit turf ?
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

    /**********
     * Structure for overlayData looks like this:
     * [
     *  [ ### Park
     *    [
     *      {x: 49.1287; y: 12.3591}, {x: 49.1211; y: 12.4563}, ... // type: mapboxgl.Point
     *    ],
     *    [
     *      {x: 49.1287; y: 12.3591}, {x: 49.1211; y: 12.4563}, ... // type: mapboxgl.Point
     *    ],
     *    [
     *      {x: 49.1287; y: 12.3591}, {x: 49.1211; y: 12.4563}, ... // type: mapboxgl.Point
     *    ],
     *    ...
     *  ],
     *  [ ### Restaurant
     *    [{x: 49.1287; y: 12.3591}, ...], [{x: 49.1287; y: 12.3591}, ...], ...
     *  ],
     *  ...
     * ]
     **********/

    console.log("OverlayData: ", overlayData);
    console.log("OverlayAlternative: ", overlayAlternative);

    //TODO
    createCanvasOverlay(overlayData);

    // check that there is data to overlay the map with
    if (overlayData.length > 0) {
      //createOverlay(overlayData);
    } else {
      console.warn("Creating an overlay is not possible because overlayData is empty!");
    }

    // ########################  Overlay Stuff ends #######################

    //* Lumagl code:
    /*
    console.log("adding luma layer ...");

    const animationLoop = new LumaLayer(data, data2);
    */
  }
}
