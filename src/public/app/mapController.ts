/* eslint-env browser */
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import * as webglUtils from "./utils/webglUtils";
import * as mapboxUtils from "./utils/mapboxUtils";
import Benchmark from "./benchmarking";
import { chunk } from "lodash";
import FrameRateControl from "../libs/mapbox-gl-framerate";
import MapboxFPS = require("../libs/MapboxFPS");
import { parameterSelection } from "./main";
import { fetchOsmData } from "./utils/networkUtils";
//import U from "mapbox-gl-utils";

export default class MapController {
  public readonly map: mapboxgl.Map;
  private defaultCoordinates: [number, number];
  //private mapUtils: any;

  constructor(accessToken: string, containerId: string) {
    mapboxUtils.checkGLSupport();

    // provide Mapbox accessToken
    mapboxgl.accessToken = accessToken;

    // default api to request tiles, styles, ...
    // could be used to load tiles from own tileserver
    mapboxgl.baseApiUrl = "https://api.mapbox.com";

    const lat = 49.008;
    const lng = 12.1;
    this.defaultCoordinates = [lng, lat];
    // remove unused layers and features with ?optimize=true
    const mapStyle = "mapbox://styles/mapbox/streets-v11";
    const defaultZoom = 12;

    console.time("load map");

    this.map = new mapboxgl.Map({
      container: containerId,
      style: mapStyle, // stylesheet location
      center: this.defaultCoordinates, // starting position [lng, lat]
      zoom: defaultZoom, // starting zoom
      antialias: false, // set to true for antialiasing custom layers but has a negative impact on performance
    });

    //this.mapUtils = U.init(this.map, mapboxgl);
  }

  setupMap(callbackFunc: (controller: this) => void): void {
    //set cursor style to mouse pointer
    this.map.getCanvas().style.cursor = "default";

    // Add navigation controls to the map
    this.map.addControl(new mapboxgl.NavigationControl());

    // start measuring the frame rate
    this.measureFrameRate();

    this.map.on("load", () => {
      console.timeEnd("load map");

      // call the callbackFunction after the map has loaded
      callbackFunc(this);

      /*
      this.map.on("sourcedata", function (e) {
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

      this.map.on("movestart", () => {
        console.log("Move start event fired!");
      });

      this.map.on("moveend", async () => {
        console.log("Move end event fired!");
        /*
        //TODO: test
        const features = this.map.queryRenderedFeatures({ layers: ["points-l1"] });

        if (features) {
          const uniqueFeatures = this.getUniqueFeatures(features, "id");
          console.table(uniqueFeatures);
        }
        */

        //TODO: load data new on every move
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

        mapboxUtils.getPointsInRadius(this.map);
      });
    });

    // fired when any map data begins loading or changing asynchronously.
    /*
    this.map.on("dataloading", () => {
      console.log("A dataloading event occurred.");
    });
    */

    this.map.on("click", (e) => {
      console.log("Click:", e);
    });
  }

  measureFrameRate(): void {
    //TODO:
    const fpsControl = new MapboxFPS.FPSControl();
    this.map.addControl(fpsControl, "bottom-right");
    setInterval(function () {
      const report = fpsControl.measurer.getMeasurementsReport();
      console.log("Report:", report);
    }, 5000); // alle 5 Sekunden

    //TODO:
    const fps: any = new FrameRateControl({});
    this.map.addControl(fps);
  }

  /**
   * Get the current bounding box, in order:
   * southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude.
   * @return string representation of the bounds in the above order
   */
  getViewportBounds(): string {
    const currBounds = this.map.getBounds();
    const southLat = currBounds.getSouth();
    const westLng = currBounds.getWest();
    const northLat = currBounds.getNorth();
    const eastLng = currBounds.getEast();

    return `${southLat},${westLng},${northLat},${eastLng}`;
  }

  addVectorData(data: string): void {
    /*
    this.map.addSource("tv", {
      type: "vector",
      url: data,
    });

    this.map.addLayer({
      id: "tv",
      type: "circle",
      source: "tv",
      "source-layer": "Regensburg_Test",
      paint: {
        "circle-color": "#ff69b4",
      },
    });*/

    // Test für eigenen TileServer
    this.map.addSource("customTiles", {
      type: "vector",
      tiles: [data],
    });

    this.map.addLayer({
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
    mapboxUtils.removeAllLayersForSource(this.map, sourceName);
    this.map.removeSource(sourceName);
  }

  showData(data: string, sourceName: string): void {
    console.log("now adding to map...");
    console.log(sourceName);

    //TODO: maybe ask user and don't remove if its the same?
    //TODO: macht das Sinn alle Layer zu löschen????
    // oder sollten alle angezeigt bleiben, zumindest solange sie noch in dem Viewport sind?
    mapboxUtils.removeAllLayersForSource(this.map, sourceName);

    if (this.map.getSource(sourceName)) {
      console.log(this.map.getSource(sourceName));
      console.log(`Source ${sourceName} is already used! Updating it!`);
      mapboxUtils.updateLayerSource(this.map, sourceName, data);
      console.log(this.map.getSource(sourceName));
      this.addLayers(sourceName);
      return;
    }

    // add geojson source
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    this.map.addSource(sourceName, {
      type: "geojson",
      //maxzoom: 13, // default: 18
      cluster: false, // TODO: cluster near points (default: false)
      clusterRadius: 10, //default is 50
      buffer: 70, // higher means fewer rendering artifacts near tile edges and decreased performance (max: 512)
      tolerance: 0.45, // higher means simpler geometries and increased performance
      data: data, // url or inline geojson
      //data: "./data.geojson",
    });

    this.addLayers(sourceName);
  }

  addLayers(sourceName: string): void {
    //visualize source
    this.map.addLayer({
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

    this.map.addLayer({
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

    this.map.addLayer({
      id: sourceName + "-l3",
      type: "fill",
      source: sourceName,
      paint: {
        "fill-color": "#00dd00",
      },
    });

    // with "has", "name" it can be tested if something exists in the properties

    //TODO: extract types as an enum
    this.map.setFilter(sourceName + "-l1", [
      "match",
      ["geometry-type"],
      ["Point", "MultiPoint"],
      true,
      false,
    ]);
    this.map.setFilter(sourceName + "-l2", [
      "match",
      ["geometry-type"],
      ["LineString", "MultiLineString"],
      true,
      false,
    ]);
    this.map.setFilter(sourceName + "-l3", [
      "match",
      ["geometry-type"],
      ["Polygon", "MultiPolygon"],
      true,
      false,
    ]);

    /*
    this.map.addLayer({
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

    this.map.on("mouseenter", "points-l1", () => {
      // Change the cursor style as a UI indicator.
      this.map.getCanvas().style.cursor = "pointer";
    });

    this.map.on("mouseleave", "points-l1", () => {
      this.map.getCanvas().style.cursor = "default";
    });

    /*
    // Add a circle layer with a vector source
    this.map.addLayer({
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
  }

  addWebGlLayer(): void {
    if (this.map.getLayer("webglCustom")) {
      this.map.removeLayer("webglCustom");
    }

    console.log("adding webgl data...");

    let program: WebGLProgram;
    let aPos: number;
    let buffer: WebGLBuffer | null;

    // define vertices to be rendered in the custom style layer
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
    const uniNorthEast = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: 12.0989967,
      lat: 49.0016276,
    });

    // TODO:
    // lat lng coordinates aus den tiles, bzw. den sources bekommen!
    // alternativ auch über x,y,z möglich
    // => dann könnten alle ganz einfach an WebGl übergeben werden
    console.log(parameterSelection.entries);

    const allGeoData: mapboxgl.MapboxGeoJSONFeature[] = [];
    for (const el of parameterSelection) {
      const features = this.map.querySourceFeatures(el);
      allGeoData.push(...features);
    }

    console.log("QuerySourceFeatures: ");
    console.log(allGeoData);

    //console.log(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3)));
    const testData: number[] = [].concat(
      ...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))
    );
    console.log(testData);
    const newArray = chunk(testData, 2);
    console.log("newArray after lodash:", newArray);
    const MercatorCoordinates = newArray.map((el) => mapboxgl.MercatorCoordinate.fromLngLat(el));
    console.log("Mercator:", MercatorCoordinates);
    /*
    console.log([].concat(...allGeoData.flatMap((el) => el.geometry.coordinates.flat(3))));
    console.log(allGeoData.flatMap((el) => [].concat(el.geometry.coordinates.flat(3))));

    console.log(allGeoData.flatMap((el) => [].concat(...el.geometry.coordinates.flat(3))));
    console.log(
      allGeoData.flatMap((el) =>
        [].concat(...el.geometry.coordinates.flatMap((li) => [li.x, li.y]))
      )
    );
    */

    //TODO:
    /*
    allGeoData.forEach((el) => {
      console.log(el.properties?.type);
      console.log(el.geometry.coordinates);
      console.log(...el.geometry.coordinates);
    });

    for (const el of allGeoData) {
      console.log(...this.flatten(el.geometry.coordinates));
    }
    */

    //const test = mapboxgl.MercatorCoordinate.fromLngLat({geoData});

    /*
    const data = [uniSouthWest, uniSouthEast, uniNorthWest, uniNorthEast];
    const flatData = data.flatMap((x) => [x.x, x.y]);
    */

    //const customData = [uniNorthEast.x, uniNorthEast.y, uniSouthWest.x, uniSouthWest.y];
    const customData = MercatorCoordinates.flatMap((x) => [x.x, x.y]);
    console.log(customData);

    const glCustomLayer: CustomLayerInterface = {
      id: "webglCustom",
      type: "custom",
      // method called when the layer is added to the map
      // https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
      onAdd: (map: mapboxgl.Map, gl: WebGL2RenderingContext) => {
        const vertexSource = webglUtils.createVertexShaderSource();
        const fragmentSource = webglUtils.createFragmentShaderSource();

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

    //const firstSymbolId = mapboxUtils.findLayerByType(this.map, "symbol");
    // Insert the layer beneath the first symbol layer in the layer stack if one exists.
    //this.map.addLayer(glCustomLayer, firstSymbolId);
    this.map.addLayer(glCustomLayer);

    console.log("Finished adding webgl data!");
  }
}
