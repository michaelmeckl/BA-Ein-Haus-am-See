import { HeatmapLayer } from "@deck.gl/aggregation-layers";
/* eslint-env browser */
/* eslint-disable no-magic-numbers */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import type { RGBAColor } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxLayer } from "@deck.gl/mapbox";
import type { Point } from "geojson";
import mapboxgl, { CustomLayerInterface, LngLatLike } from "mapbox-gl";
import Benchmark from "../../shared/benchmarking";
import { parameterSelection } from "../main";
import { fetchOsmData } from "../network/networkUtils";
import { render as renderAndBlur } from "../webgl/blurFilter";
import LumaLayer from "../webgl/lumaLayer";
import { MapboxCustomLayer } from "../webgl/mapboxCustomLayer";
import { createMapboxLayer, createNewMapboxLayer, getDeckGlLayer } from "./deckLayer";
import { getDataFromMap } from "./featureUtils";
import { initialPosition, map } from "./mapboxConfig";
import Geocoder from "./mapboxGeocoder";
import * as mapboxUtils from "./mapboxUtils";
import { loadSidebar } from "./mapTutorialStoreTest";
import { PerformanceMeasurer } from "./performanceMeasurer";

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

  reloadData(): void {
    //TODO load data new on every move, works but needs another source than overpass api mirror
    parameterSelection.forEach(async (param) => {
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

      const coordinates = e.features[0].geometry.coordinates.slice();
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
          // Size circle radius by earthquake magnitude and zoom level
          /*
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, ["interpolate", ["linear"], ["get", "mag"], 1, 1, 6, 4],
            16, ["interpolate", ["linear"], ["get", "mag"], 1, 5, 6, 50],
          ],
          */
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

  addDeckLayer(): void {
    /*
    const firstLabelLayerId = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;

    map.addLayer(
      new MapboxLayer({
        id: "deckgl-circle",
        //@ts-expect-error
        type: ScatterplotLayer,
        data: [
          { position: [initialPosition[0], initialPosition[1]], color: [255, 0, 0], radius: 1000 },
        ],
        getPosition: (d: { position: number[] }): number[] => d.position,
        getFillColor: (d: { color: RGBAColor }) => d.color,
        getRadius: (d: { radius: number }) => d.radius,
        opacity: 0.3,
      }),
      firstLabelLayerId
    );
    */

    //* für normale Deck Layer:
    /*
    const deck = getDeckGlLayer("GeojsonLayer", "../assets/data.geojson");
    console.log("Deck:", deck);
    console.log("Props:", deck.props);
    const layer = (deck as unknown) as CustomLayerInterface;
    */
    //* für Mapbox Layer:
    //const layer = createMapboxLayer("../assets/data.geojson", HeatmapLayer);  //TODO um die heatmap auszuprobieren brauch ich andere Daten als Geojson
    const layer = createMapboxLayer("../assets/data.geojson", GeoJsonLayer);
    //const layerAround = createNewMapboxLayer("../assets/data.geojson", GeoJsonLayer, 500);

    //* add the layer before the waterway-label to make sure it is placed below map labels!
    map.addLayer(layer, "waterway-label");
    //map.addLayer(layerAround, "mapboxLayer");
  }

  removeData(sourceName: string): void {
    mapboxUtils.removeSource(sourceName);
  }

  // * um ein bestimmtes tile an einer position zu bekommen: https://github.com/mapbox/tilebelt

  showData(data: string, sourceName: string): void {
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

    // add geojson source
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    map.addSource(sourceName, {
      type: "geojson",
      //maxzoom: 13, // default: 18
      cluster: false, // TODO: cluster near points (default: false)
      clusterRadius: 10, //default is 50
      buffer: 70, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
      tolerance: 0.45, // higher means simpler geometries and increased performance
      data: data, // url or inline geojson
      //data: "../assets/data.geojson",
    });

    this.addLayers(sourceName);
  }

  addLayers(sourceName: string): void {
    //visualize source
    map.addLayer({
      id: sourceName + "-l1",
      type: "circle",
      source: sourceName,
      //interactive: true,
      layout: {
        //"visibility": "visible",  //TODO: damit vllt am anfang alles unsichtbar und wenn fertig alle auf visible?
      },
      paint: {
        //increase circle radius when zooming in
        "circle-radius": 25,
        /*{
          base: 1,
          stops: [
            [8, 4],
            [16, 25],
          ],
        },*/
        // style color based on wheelchair access
        "circle-color": [
          "match",
          ["get", "wheelchair", ["get", "tags"]],
          "yes",
          "#fbb03b",
          "limited",
          "#223b53",
          "no",
          "#3bb2d0",
          "#ff0000", // other
        ],
        //"circle-stroke-width": 4,
        "circle-blur": 1,
        "circle-opacity": 0.5,
        /*
        "circle-opacity": {
          stops: [
            [2, 0.2],
            [16, 0.8],
          ],
        },
        */
      },
    });

    map.addLayer({
      id: sourceName + "-l2",
      type: "line",
      source: sourceName,
      paint: {
        "line-color": "#ff0000",
        "line-width": 8,
        "line-blur": 8,
        //"line-offset": 3,
      },
      //filter: ["==", "$type", "Polygon"],
    });

    map.addLayer({
      id: sourceName + "-l3",
      type: "fill",
      source: sourceName,
      paint: {
        //"fill-color": "#00dd00",
        //TODO this creates a small outline effect, maybe useful?
        "fill-outline-color": "rgba(0,0,0,0.1)",
        "fill-color": "rgba(0,0,0,0.1)",
      },
    });

    // with ["has", "name"] it can be tested if something exists in the properties

    //TODO: extract types as an enum

    map.setFilter(sourceName + "-l1", [
      "match",
      ["geometry-type"],
      ["Point", "MultiPoint"],
      true,
      false,
    ]);
    map.setFilter(sourceName + "-l2", [
      "match",
      ["geometry-type"],
      ["LineString", "MultiLineString"],
      true,
      false,
    ]);
    map.setFilter(sourceName + "-l3", [
      "match",
      ["geometry-type"],
      ["Polygon", "MultiPolygon"],
      true,
      false,
    ]);

    /*
    map.addLayer({
      id: sourceName + "-l4",
      type: "symbol",
      source: sourceName,
      layout: {
        // see https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
        "text-field": ["get", "name", ["get", "tags"]],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-offset": [0, 0.6],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
    });
    */

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

      const canvas = renderAndBlur(img);
      /*
        //TODO:
        if (canvas) {
          addCanvasOverlay(canvas);
        }*/
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
