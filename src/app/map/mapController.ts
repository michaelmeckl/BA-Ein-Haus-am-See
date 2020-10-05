/* eslint-env browser */
/* eslint-disable no-magic-numbers */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import type { RGBAColor } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import type { Point } from "geojson";
import mapboxgl, { CustomLayerInterface, GeoJSONSource, LngLat, LngLatLike } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import { fetchOsmData } from "../network/networkUtils";
import { renderAndBlur } from "../webgl/blurFilter";
import LumaLayer from "../webgl/lumaLayer";
import { MapboxCustomLayer } from "../webgl/mapboxCustomLayer";
import { addCanvasOverlay } from "./canvasUtils";
import ClusterManager from "./clusterManager";
import {
  createMapboxDeck,
  createMapboxLayer,
  createNewMapboxLayer,
  createOverlay,
  getDeckGlLayer,
} from "./deckLayer";
import { getDataFromMap } from "./featureUtils";
import { initialPosition, map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import { loadSidebar } from "./mapTutorialStoreTest";
import { PerformanceMeasurer } from "./performanceMeasurer";

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

    map.on("sourcedata", function (e) {
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
    });

    map.on("movestart", async () => {
      //console.log("Move start event fired!");
      //const pois = await getPoiTypes();
      //console.log(pois);
    });

    map.on("moveend", async () => {
      //use tilequery API
      //mapboxUtils.testTilequeryAPI();
      //this.reloadData();
    });

    // fired when any map data begins loading or changing asynchronously.
    map.once("dataloading", () => {
      //console.log("A dataloading event occurred.");
    });

    //TODO idee: alle häuser in abstand bekommen, indem erst mit tilequery api landuse oder building extrahiert
    // und dann z.b. mit turf distanz oder der LatLng.distanceto()-Methode zu allen queryRendered features
    // bekommen und dann diese gebiete markieren

    /*
    map.on("click", (e) => {
      console.log("Click:", e);

      getPointsInRadius(map);

      //TODO not working rigth now
      //sortDistances(e.lngLat);

      testTurfFunctions();
      //addWebglCircle(map);
    });
    */

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

  addMapControls(): void {
    // Add navigation controls to the map
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
      })
    );
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    //map.addControl(new mapboxgl.ScaleControl(), "bottom-left");
    //map.addControl(new mapboxgl.GeolocateControl(), "bottom-right");

    // Add the geocoder to the map
    map.addControl(Geocoder.geocoderControl, "bottom-left");
  }

  addActiveFilter(filter: string): void {
    this.activeFilters.add(filter);
  }

  //TODO remove map data in here? so everything is in one place
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

    //TODO use this instead of the code above to reload on every move?
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

  addPopupOnHover(): void {
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.on("mouseenter", "places", function (e) {
      // Change the cursor style as a UI indicator.
      map.getCanvas().style.cursor = "pointer";

      // @ts-expect-error
      const coordinates = e.features[0].geometry.coordinates.slice();
      // @ts-expect-error
      const description = e.features[0].properties.description;

      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Populate the popup and set its coordinates
      // based on the feature found.
      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    });

    map.on("mouseleave", "places", function () {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
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

  /**
   * * Um vektor sources hinzuzufügen müssen die sourcelayer angegeben werden!
   * * Um das sourceLayer herauszufinden, könnte das tileinfo-package nützlich sein (https://www.npmjs.com/package/tileinfo)
   * * oder alternativ auch https://github.com/mapbox/vector-tile-js
   */
  addVectorData(data: string): void {
    /*
    map.addSource("tv", {
      type: "vector",
      url: data,
    });

    map.addLayer({
      id: "tv",
      type: "circle",
      source: "tv",
      "source-layer": "Regensburg_Test",
      paint: {
        "circle-color": "#ff69b4",
      },
    });*/

    // Test für eigenen TileServer
    map.addSource("customTiles", {
      type: "vector",
      tiles: [data],
    });

    map.addLayer({
      id: "customTiles",
      type: "line",
      source: "customTiles",
      "source-layer": "state",
      paint: {
        "line-color": "#ff69b4",
      },
    });
  }

  addLocalVectorSource(): void {
    map.addSource("vector", {
      type: "vector",
      tiles: ["./assets/ny_extract.osm.pbf"],
    });

    /*
      map.addLayer({
        id: "vector",
        type: "line",
        source: "vector",
        "source-layer": "state",
        paint: {
          "line-color": "#ff69b4",
        },
      });*/
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
      paint: {
        // Mapbox Style Specification paint properties
      },
      layout: {
        // Mapbox Style Specification layout properties
      },
    });
  }

  //TODO
  addHeatmapLayer(data?: string): void {
    // Heatmap layers work with a vector tile source as well as geojson.
    map.addSource("bars", {
      type: "geojson",
      data: "../assets/data.geojson",
    });

    map.addLayer(
      {
        id: "bars-heat",
        type: "heatmap",
        source: "bars",
        maxzoom: 15,
        paint: {
          // Increase the heatmap weight based on frequency and property magnitude
          // heatmap-weight is a measure of how much an individual point contributes to the heatmap
          //! both do not work with text values
          /*
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "type"],
            "point",
            0,
            "way",
            0.5,
            "polygon",
            1,
          ],
          */
          /*
          "heatmap-weight": {
            property: "type",
            type: "exponential",
            stops: [
              [0, 0.2],
              [62, 1],
            ],
          },*/
          // Increase the heatmap color weight weight by zoom level
          // heatmap-intensity is a multiplier on top of heatmap-weight
          //"heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
          "heatmap-intensity": {
            stops: [
              [11, 1],
              [15, 3],
            ],
          },
          // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
          // Begin color ramp at 0-stop with a 0-transparancy color
          // to create a blur-like effect.
          // prettier-ignore
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(33,102,172,0)",
            0.2, "rgb(103,169,207)",
            0.4, "rgb(209,229,240)",
            0.6, "rgb(253,219,199)",
            0.8, "rgb(239,138,98)",
            1, "rgb(178,24,43)",
          ],
          /*
          // Adjust the heatmap radius by zoom level
          // prettier-ignore
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            0, 2,
            9, 20,
            15, 50, 
            18, 70,
          ],
          */
          // increase radius as zoom increases
          "heatmap-radius": {
            //default radius is 30 (pixel)
            stops: [
              [11, 15],
              [15, 20],
            ],
          },
          // Transition from heatmap to circle layer by zoom level
          //"heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0],
          // decrease opacity to transition into the circle layer
          "heatmap-opacity": {
            default: 1,
            stops: [
              [14, 1],
              [15, 0],
            ],
          },
        },
      },
      "waterway-label"
    );

    map.addLayer(
      {
        id: "bars-point",
        type: "circle",
        source: "bars",
        minzoom: 14,
        paint: {
          "circle-radius": {
            property: "type",
            type: "exponential",
            stops: [
              [{ zoom: 15, value: 1 }, 5],
              [{ zoom: 15, value: 62 }, 10],
              [{ zoom: 22, value: 1 }, 20],
              [{ zoom: 22, value: 62 }, 50],
            ],
          },
          "circle-color": {
            property: "type",
            type: "exponential",
            stops: [
              [0, "rgba(236,222,239,0)"],
              [10, "rgb(236,222,239)"],
              [20, "rgb(208,209,230)"],
              [30, "rgb(166,189,219)"],
              [40, "rgb(103,169,207)"],
              [50, "rgb(28,144,153)"],
              [60, "rgb(1,108,89)"],
            ],
          },
          "circle-stroke-color": "white",
          "circle-stroke-width": 1,
          // Transition from heatmap to circle layer by zoom level
          //"circle-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 16, 1],
          "circle-opacity": {
            stops: [
              [14, 0],
              [15, 1],
            ],
          },
        },
      },
      "waterway-label"
    );

    map.on("mouseover", "bars-point", (e) => {
      // change the cursor style to show the user this is clickable
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("click", "bars-point", function (e) {
      if (!e.features) {
        return;
      }
      const clickedPoint = e.features[0];

      //* nested geojson properties need to be parsed because Mapbox doesn't support nested objects or arrays
      // see https://stackoverflow.com/questions/52859961/display-properties-of-nested-geojson-in-mapbox
      const props = clickedPoint.properties;
      if (props === null) {
        return;
      }
      Object.keys(props).forEach(function (key) {
        //only parse the tags key as the other properties are no obejcts and would only result in an error!
        if (key === "tags") {
          props[key] = JSON.parse(props[key]);
        }
      });

      new mapboxgl.Popup()
        // cast to point so coordinates is safe to access
        .setLngLat((clickedPoint.geometry as Point).coordinates as LngLatLike)
        .setHTML(
          "<h3>Name: </h3> " +
            clickedPoint.properties?.tags.name +
            "<p>Amenity: " +
            clickedPoint.properties?.tags.amenity +
            "</p>"
        )
        .addTo(map);
    });

    this.addLegend();
  }

  addLegend(): void {
    //TODO sinnvolle Werte
    const layers = ["0-10", "10-20", "20-50", "50-100", "100-200", "200-500", "500-1000", "1000+"];
    //prettier-ignore
    const colors = ["rgba(33,102,172,0)", "rgb(103,169,207)", "rgb(209,229,240)", "rgb(253,219,199)", "rgb(239,138,98)", "rgb(178,24,43)"];

    const legend = document.querySelector("#legend");

    if (!legend) {
      return;
    }

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const color = colors[i];
      const item = document.createElement("div");
      const key = document.createElement("span");
      key.className = "legend-key";
      key.style.backgroundColor = color;

      const value = document.createElement("span");
      value.innerHTML = layer;
      item.appendChild(key);
      item.appendChild(value);
      legend.appendChild(item);
    }
  }

  //! mit turf.bbpolygon die bounding box des viewports zu einem Polygon machen, dann mit turf.distance
  //! den Unterschied vom Circle und der Bounding Box nehmen und das dann einfärben mit fill-color!!!
  // oder vllt damit auch den stroke dazwischen erzeugen und das blurren?

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

  removeData(sourceName: string): void {
    mapboxUtils.removeSource(sourceName);
  }

  // * um ein bestimmtes tile an einer position zu bekommen: https://github.com/mapbox/tilebelt

  showData(data: string, sourceName: string): void {
    //! idee:
    //! den geojson string mit turf zu einer featurecollection machen und diese dann gleich preprocessen / filtern / etc.
    //! z.B. könnte man alle mity geometryType="way" separat speichern, mit foreach und turf.buffer jeder eine stroke geben
    //!      und diese dann an das Line Layer übergeben, um es zu stylen, so könnte nur der Buffer gestyled werden vllt
    //! turf can add properties mit turf.point([...], {additional Props hierher})

    console.log(data);
    console.log("now adding to map...");
    console.log(sourceName);

    //this.currentData = data;

    //TODO hier schon das geojson parsen und lokal speichern, damit später gequeriet werden kann?
    //TODO reex oder programm zum parsen finden!
    //this.mapData.set("point", [1, 2]);

    //TODO macht das Sinn alle Layer zu löschen???? oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
    mapboxUtils.removeAllLayersForSource(map, sourceName);

    if (map.getSource(sourceName)) {
      console.log(map.getSource(sourceName));
      console.log(`Source ${sourceName} is already used! Updating it!`);
      mapboxUtils.updateLayerSource(map, sourceName, data);
      console.log(map.getSource(sourceName));
      this.addLayers(sourceName);
      return;
    }

    // declare some filters for clustering
    const bar = ["==", ["get", "amenity"], "Bar"];
    const restaurant = ["==", ["get", "amenity"], "Restaurant"];
    const supermarket = ["==", ["get", "amenity"], "Supermarket"];
    const cafe = ["==", ["get", "amenity"], "Cafe"];
    const other = ["==", ["get", "amenity"], ""]; //TODO oder null statt leerstring?

    // Add a geojson source, see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    map.addSource(sourceName, {
      type: "geojson",
      buffer: 70, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
      tolerance: 0.45, // higher means simpler geometries and increased performance
      data: data, // url or inline geojson

      cluster: true, // Cluster near points (default: false). The point_count property will be added to the source data.
      clusterRadius: 20, //default is 50
      clusterMaxZoom: 14, // don't show clusters above zoom level 14
      clusterMinPoints: 3, // at least 3 points necessary for clustering
      //clusterProperties: { sum: ["+", ["get", "scalerank"]] },
      clusterProperties: {
        // keep separate counts for each category in a cluster
        Bar: ["+", ["case", bar, 1, 0]],
        Restaurant: ["+", ["case", restaurant, 1, 0]],
        Supermarket: ["+", ["case", supermarket, 1, 0]],
        Cafe: ["+", ["case", cafe, 1, 0]],
        Other: ["+", ["case", other, 1, 0]],
      },
    });
    //console.log("Source: ", map.getSource(sourceName));

    this.addLayers(sourceName);

    const clusterManager = new ClusterManager(sourceName);
    clusterManager.addClusterLayer();
    /*
    clusterManager.addOtherClusterLayer();
    clusterManager.updateMarkers();
    */
  }

  addLayers(sourceName: string): void {
    //TODO extract the layer props and filters to a separate class?

    //point-layer
    map.addLayer({
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      // 'all' checks 2 conditions:  on this layer show only points or multipoints and only if not clustered
      filter: [
        "all",
        ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        ["!", ["has", "point_count"]],
      ],
      //interactive: true,
      layout: {
        //"visibility": "visible",
      },
      //prettier-ignore
      paint: {
        //increase circle radius (in pixels) when zooming in
        // see https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          0, 0.0, 
          8, 4.0, // 4px at zoom level 8
          //12, ["/", ["get", "zoom"], 3], //TODO adjust expression values
          16, 25.0,
        ],
        // style color based on amenity type
        "circle-color": [
          "match",
          //["get", "amenity", ["get", "tags"]],    //* wird automatisch "geflattened"!
          ["get", "amenity"], 
          "bar", "#fbb03b",
          "restaurant", "#223b53",
          "supermarket", "#3bb2d0",
          "#ff0000", // fallback color for others
        ],
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          4, 0.0, 
          10, 15,
          15, 52,
          20, 90,
        ],
        "circle-stroke-color": "rgba(100, 100, 100, 100)",
        "circle-stroke-opacity": [
          "interpolate", ["linear"], ["zoom"],
          4, 0.0, 
          6, 0.08,
          15, 0.2,
          20, 0.25,
        ],
        "circle-opacity": [
          "interpolate", ["linear"], ["zoom"],
          4, 0.0, 
          12, 0.5,
          20, 1.0,
        ],
        "circle-blur": 0.3,
      },
    });

    //line - layer
    map.addLayer({
      id: sourceName + "-l2",
      type: "line",
      source: sourceName,
      filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      paint: {
        "line-color": "rgba(255, 0, 0, 255)",
        "line-width": 8,
        "line-blur": 8,
        //"line-offset": 3,
        //"line-opacity": 0.5,
        //"line-gap-width": 20, // renders a second line 20 pixes away
      },
    });

    //polygon-layer
    map.addLayer({
      id: sourceName + "-l3",
      type: "fill",
      //TODO extract types as an enum
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      source: sourceName,
      paint: {
        //"fill-outline-color": "rgba(0,0,0,0.3)",
        "fill-outline-color": "rgba(255,255,255,0.9)", //to render white outlines around the polygon
        "fill-color": "rgba(0,210,237,0.1)",
        "fill-opacity": 0.6,
      },
    });
    //add line strokes around polygons as there is no stroke paint property for polygons for performance reasons
    /*
    map.addLayer({
      id: sourceName + "-l4",
      type: "line",
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      source: sourceName,
      paint: {
        "line-color": "rgba(13, 13, 13, 60)",
        "line-width": 50,
        "line-blur": 4,
        "line-opacity": 0.5,
        //"line-gap-width": 20,
      },
    });*/

    //* with ["has", "name"] it can be tested if something exists in the properties

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
        //this.addBlurredImage(img, canvas);
      }
    };
  }

  addBlurredImage(img: HTMLImageElement, canvas: HTMLCanvasElement): void {
    Benchmark.startMeasure("addingImageOverlay");
    img.src = canvas.toDataURL();

    const bounds = map.getBounds();
    const viewportBounds = [
      bounds.getNorthWest().toArray(),
      bounds.getNorthEast().toArray(),
      bounds.getSouthEast().toArray(),
      bounds.getSouthWest().toArray(),
    ];
    //console.log("ViewportBounds: ", viewportBounds);

    img.onload = () => {
      map.addSource("canvasSource", {
        type: "image",
        coordinates: viewportBounds,
        url: img.src,
      });
      //TODO save this source in the class and only use updateImage(options: ImageSourceOptions): this;
      // to update the image instead of rerendering the whole source

      map.addLayer({
        id: "overlay",
        source: "canvasSource",
        type: "raster",
        paint: {
          "raster-opacity": 0.85,
          //"raster-resampling": "linear",
        },
      });

      Benchmark.stopMeasure("addingImageOverlay");
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

    const mapData = getDataFromMap();
    const customLayer = new MapboxCustomLayer(mapData) as CustomLayerInterface;

    //const firstSymbolId = mapboxUtils.findLayerByType(map, "symbol");
    // Insert the layer beneath the first symbol layer in the layer stack if one exists.
    //map.addLayer(customLayer, firstSymbolId);
    map.addLayer(customLayer, "waterway-label");

    console.log("Finished adding webgl data!");
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
