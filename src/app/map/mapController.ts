/* eslint-env browser */
//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import { map } from "./mapConfig";
import * as webglUtils from "../utils/webglUtils";
import * as mapboxUtils from "../utils/mapboxUtils";
import Benchmark from "../../shared/benchmarking";
import { chunk } from "lodash";
import FrameRateControl from "../vendors/mapbox-gl-framerate";
import MapboxFPS = require("../vendors/MapboxFPS");
import { parameterSelection } from "../main";
import { Config } from "../../shared/config";
import { addWebglCircle } from "../utils/webglCircle";
import { testTurfFunctions, getPointsInRadius } from "./mapFunctions";
import { getDataFromMap } from "../utils/mapboxUtils";
import { loadSidebar } from "./mapStoreTest";

export default class MapController {
  setupMap(callbackFunc: (controller: this) => void): void {
    console.time("load map");

    //set cursor style to mouse pointer
    map.getCanvas().style.cursor = "default";

    // Add navigation controls to the map
    map.addControl(new mapboxgl.NavigationControl());

    map.on("load", () => {
      console.timeEnd("load map");

      // start measuring the frame rate
      this.measureFrameRate();

      // call the callbackFunction after the map has loaded
      callbackFunc(this);

      //TODO
      loadSidebar();

      /*
      map.on("sourcedata", function (e) {
        console.log(e.source);
        if (e.isSourceLoaded) {
          // Do something when the source has finished loading
          console.log(e.sourceId);
          console.log(e.source);
          console.log(e.coord);
          console.log(e.tile);
        }
      });
      */

      map.on("movestart", () => {
        console.log("Move start event fired!");
      });

      map.on("moveend", async () => {
        console.log("Move end event fired!");
        // show current zoom level
        console.log("ZoomLevel:");
        console.log(map.getZoom());

        /*
        //TODO: test
        const features = map.queryRenderedFeatures({ layers: ["points-l1"] });

        if (features) {
          const uniqueFeatures = this.getUniqueFeatures(features, "id");
          console.table(uniqueFeatures);
        }
        */

        /*
        //TODO: load data new on every move, works but needs another source than overpass api mirror
        parameterSelection.forEach(async (param) => {
          Benchmark.startMeasure("Fetching data on moveend");
          const data = await fetchOsmData(this.getViewportBounds(), param);
          console.log(Benchmark.stopMeasure("Fetching data on moveend"));

          if (data) {
            const t0 = performance.now();
            this.showData(data, param);
            const t1 = performance.now();
            console.log("Adding data to map took " + (t1 - t0).toFixed(3) + " milliseconds.");

            console.log("Finished adding data to map!");
          }
        });
        */

        getPointsInRadius(map);
      });
    });

    // fired when any map data begins loading or changing asynchronously.
    /*
    map.on("dataloading", () => {
      console.log("A dataloading event occurred.");
    });
    */

    //TODO idee: alle häuser in abstand bekommen, indem erst mit tilequery api landuse oder building extrahiert und dann z.b. mit turf distanz oder der LatLng.distanceto()-Methode zu allen queryRendered features bekommen und dann diese gebiete markieren

    map.on("click", (e) => {
      console.log("Click:", e);

      testTurfFunctions();
      //addWebglCircle(map);
    });
  }

  //TODO: promisses: await this function at the start
  mapLoad(map) {
    return new Promise((resolve, reject) => {
      map.on("load", () => resolve());
    });
  }

  measureFrameRate(): void {
    //TODO: first measurer
    const fpsControl = new MapboxFPS.FPSControl();
    map.addControl(fpsControl, "bottom-right");
    setInterval(function () {
      const report = fpsControl.measurer.getMeasurementsReport();
      console.log("Report:", report);
    }, 5000); // alle 5 Sekunden

    //TODO: second measurer
    const fps: any = new FrameRateControl({});
    map.addControl(fps);
  }

  /**
   * Get the current bounding box, in order:
   * southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude.
   * @return string representation of the bounds in the above order
   */
  getViewportBounds(): string {
    const currBounds = map.getBounds();
    const southLat = currBounds.getSouth();
    const westLng = currBounds.getWest();
    const northLat = currBounds.getNorth();
    const eastLng = currBounds.getEast();

    return `${southLat},${westLng},${northLat},${eastLng}`;
  }

  /**
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

  removeData(sourceName: string): void {
    if (!map.getSource(sourceName)) {
      return;
    }
    mapboxUtils.removeAllLayersForSource(map, sourceName);
    map.removeSource(sourceName);
  }

  // * um ein bestimmtes tile an einer position zu bekommen: https://github.com/mapbox/tilebelt
  showData(data: string, sourceName: string): void {
    console.log("now adding to map...");
    console.log(sourceName);

    //TODO maybe ask user and don't remove if its the same?
    //TODO macht das Sinn alle Layer zu löschen????
    // oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
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
        "fill-color": "#00dd00",
      },
    });

    // with "has", "name" it can be tested if something exists in the properties

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

    map.on("mouseenter", "points-l1", () => {
      // Change the cursor style as a UI indicator.
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "points-l1", () => {
      map.getCanvas().style.cursor = "default";
    });

    /*
    // Add a circle layer with a vector source
    map.addLayer({
    id: "points-of-interest",
    source: {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
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
    */

    const layerName = sourceName + "-l1";

    map.on("sourcedata", () => {
      const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
      const everyPoint2 = map.querySourceFeatures(sourceName, { sourceLayer: layerName });
      console.log(everyPoint);
      console.log(everyPoint2);

      //TODO: dont do it like this -> endlossschleife
      /*
      for (let index = 0; index < everyPoint.length; index++) {
        const point = everyPoint[index].geometry.coordinates;
        console.log(point);
        this.addTurfCircle(point, 0.2);
      }
      */
    });

    const allPoints = this.getAllPoints(sourceName, sourceName + "-l1");
    console.log(allPoints);
  }

  //TODO: has to be called after layer is loaded!
  getAllPoints(src: string, layerName: string) {
    map.once("sourcedata", (e) => {
      if (map.getSource(layerName) && map.isSourceLoaded(layerName)) {
        console.log("source loaded!");
        const features = map.querySourceFeatures(layerName);
        console.log(features);
        const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
        const everyPoint2 = map.querySourceFeatures(src, { sourceLayer: layerName });
        console.log(everyPoint);
        console.log(everyPoint2);
      }
    });
    /*
    console.log(layerName);
    const everyPoint = map.queryRenderedFeatures({ layers: [layerName] });
    const everyPoint2 = map.querySourceFeatures(src, { sourceLayer: layerName });
    console.log(everyPoint);
    console.log(everyPoint2);
    */
  }

  addWebGlLayer(): void {
    if (map.getLayer("webglCustom")) {
      map.removeLayer("webglCustom");
    }

    //TODO: test this:
    const canvasContainer = map.getCanvasContainer();
    const mapCanvas = map.getCanvas();
    console.log(canvasContainer);
    console.log(mapCanvas);

    //TODO: this should work?
    /*
    const img = new Image();
    const canvas = MAP.getCanvas(document.querySelector('.mapboxgl-canvas'));
    img.src = canvas.toDataURL();
    */

    console.log("adding webgl data...");

    let program: WebGLProgram;
    let aPos: number;
    let buffer: WebGLBuffer | null;

    const customData = getDataFromMap();

    const glCustomLayer: CustomLayerInterface = {
      id: "webglCustom",
      type: "custom",
      // method called when the layer is added to the map
      // https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
      onAdd: (map: mapboxgl.Map, gl: WebGL2RenderingContext) => {
        const vertexSource = webglUtils.createVertexShaderSource();
        const fragmentSource = webglUtils.createFragmentShaderSource();

        //TODO: test what i can do here!
        console.log(gl.canvas);

        // create a vertex and a fragment shader
        const vertexShader = webglUtils.createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = webglUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

        // link the two shaders into a WebGL program
        program = webglUtils.createProgram(gl, vertexShader, fragmentShader);

        // look up where the vertex data needs to go.
        aPos = gl.getAttribLocation(program, "a_pos");

        // create and initialize a WebGLBuffer to store vertex and color data
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(customData), gl.STATIC_DRAW);
      },

      // method fired on each animation frame
      // https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
      render: function (gl: WebGL2RenderingContext, matrix: number[]): void {
        gl.useProgram(program);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_matrix"), false, matrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(aPos); // this command tells WebGL we want to supply data from a buffer.

        const size = 2; // always 1 to 4
        const stride = 0; // stride = how many bytes to skip to get from one piece of data to the next piece of data)
        // 0 for stride means "use a stride that matches the type and size".
        const normalized = false;
        //this command tells WebGL to get data from the buffer that was last bound with gl.bindBuffer,
        gl.vertexAttribPointer(aPos, size, gl.FLOAT, normalized, stride, 0);
        //enable alpha blending
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const primitiveType = gl.TRIANGLE_STRIP;
        const offset = 0; // 0 for offset means start at the beginning of the buffer.
        const count = customData.length / 2;
        gl.drawArrays(primitiveType, offset, count);
      },
    };

    //const firstSymbolId = mapboxUtils.findLayerByType(map, "symbol");
    // Insert the layer beneath the first symbol layer in the layer stack if one exists.
    //map.addLayer(glCustomLayer, firstSymbolId);
    map.addLayer(glCustomLayer);

    console.log("Finished adding webgl data!");
  }
}
