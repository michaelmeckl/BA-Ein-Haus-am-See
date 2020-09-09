/* eslint-env browser */

//TODO use dynamic imports to make file size smaller? (vgl. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
// e.g. const circle = await import("@turf/circle");
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import { map } from "./mapboxConfig";
import * as webglUtils from "../webgl/webglUtils";
import * as mapboxUtils from "./mapboxUtils";
import Benchmark from "../../shared/benchmarking";
import { chunk } from "lodash";
import FrameRateControl from "../vendors/mapbox-gl-framerate";
import MapboxFPS = require("../vendors/MapboxFPS");
import { parameterSelection } from "../main";
import { Config } from "../../shared/config";
import { addWebglCircle } from "../webgl/webglCircle";
import {
  testTurfFunctions,
  getPointsInRadius,
  addImageOverlay,
  addCanvasOverlay,
} from "./testMapFunctionsTODO";
import { getDataFromMap } from "./mapboxUtils";
import { loadSidebar, sortDistances } from "./mapStoreTest";
import { fetchOsmData } from "../network/networkUtils";
import * as createjs from "createjs-module";
import {
  createShader,
  vertexShaderCanvas,
  fragmentShaderCanvas,
  createProgram,
  resizeCanvas,
} from "../webgl/webglUtils";

export default class MapController {
  private mapIsReady: Boolean = false;

  setupMap(callbackFunc: (controller: this) => void): void {
    console.time("load map");

    //set cursor style to mouse pointer
    map.getCanvas().style.cursor = "default";

    // Add navigation controls to the map
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
      })
    );
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    //map.addControl(new mapboxgl.ScaleControl(), "bottom-left");
    //map.addControl(new mapboxgl.GeolocateControl(), "bottom-right");

    //map.showTileBoundaries = true;

    map.on("load", () => {
      console.timeEnd("load map");
      this.mapIsReady = true;

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

        //TODO use this instead of the code above to reload on every move?
        /*
        // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
map.on('data', function(e) {
if (e.sourceId !== 'earthquakes' || !e.isSourceLoaded) return;
 
map.on('move', updateMarkers);
map.on('moveend', updateMarkers);
updateMarkers();
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

    //TODO idee: alle häuser in abstand bekommen, indem erst mit tilequery api landuse oder building extrahiert
    // und dann z.b. mit turf distanz oder der LatLng.distanceto()-Methode zu allen queryRendered features
    // bekommen und dann diese gebiete markieren

    map.on("click", (e) => {
      console.log("Click:", e);

      //TODO not working rigth now
      //sortDistances(e.lngLat);

      testTurfFunctions();
      //addWebglCircle(map);
    });
  }

  //TODO: To use promises instead of callbacks: await this function at the start
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

  // example with createJS (aber vermutlich nicht sonderlich nützlich)
  handleImageLoad(canvas: HTMLCanvasElement, img: HTMLImageElement) {
    // create a new stage and point it at our canvas:
    const exportCanvas = document.getElementById("test_canvas") as HTMLCanvasElement;
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const stage = new createjs.Stage(exportCanvas);

    if (stage == null) return;

    var bmp = new createjs.Bitmap(img); //.set({ scaleX: 0.5, scaleY: 0.5 });
    stage.addChild(bmp);

    /*
    var colorMatrix = new createjs.ColorMatrix();
    colorMatrix.adjustSaturation(-100);
    colorMatrix.adjustContrast(50);
    */

    var blurFilter = new createjs.BlurFilter(4, 4, 1);
    bmp = bmp.clone();
    bmp.filters = [blurFilter];
    bmp.cache(0, 0, img.width, img.height);
    //bmp.y = 200;
    stage.addChild(bmp);

    // draw to the canvas:
    stage.update();

    canvas.classList.add(Config.CSS_HIDDEN);
  }

  getBlurFilter(name: string = "gaussianBlur") {
    // prettier-ignore
    const kernels = {
      // Define several convolution kernels
      gaussianBlur: [
        0.045, 0.122, 0.045,
        0.122, 0.332, 0.122,
        0.045, 0.122, 0.045
      ],
      gaussianBlur2: [
        1, 2, 1,
        2, 4, 2,
        1, 2, 1
      ],
      gaussianBlur3: [
        0, 1, 0,
        1, 1, 1,
        0, 1, 0
      ],
      boxBlur: [
          0.111, 0.111, 0.111,
          0.111, 0.111, 0.111,
          0.111, 0.111, 0.111
      ],
      triangleBlur: [
          0.0625, 0.125, 0.0625,
          0.125,  0.25,  0.125,
          0.0625, 0.125, 0.0625
      ]
    };

    switch (name) {
      case "gaussianBlur2":
        return kernels.gaussianBlur2;
      case "gaussianBlur3":
        return kernels.gaussianBlur3;
      case "boxBlur":
        return kernels.boxBlur;
      case "triangleBlur":
        return kernels.triangleBlur;
      case "gaussianBlur":
      default:
        return kernels.gaussianBlur;
    }
  }

  computeKernelWeight(kernel: number[]): number {
    const weight = kernel.reduce(function (prev: number, curr: number) {
      return prev + curr;
    });
    return weight <= 0 ? 1 : weight;
  }

  render(image: HTMLImageElement): HTMLCanvasElement | null {
    const newCanvas = document.querySelector("#test_canvas") as HTMLCanvasElement;
    // const newCanvas = document.createElement("canvas"); // in-memory canvas
    const glContext = newCanvas.getContext("webgl");

    if (!glContext) {
      console.log("No gl context available!");
      return null;
    }

    // adjust canvas size to the image size
    newCanvas.width = image.width;
    newCanvas.height = image.height;

    const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexShaderCanvas());
    const fragmentShader = createShader(
      glContext,
      glContext.FRAGMENT_SHADER,
      fragmentShaderCanvas()
    );

    const program = createProgram(glContext, vertexShader, fragmentShader);

    const positionLocation = glContext.getAttribLocation(program, "a_position");
    const texcoordLocation = glContext.getAttribLocation(program, "a_texCoord");

    // create and initialize a WebGLBuffer to store vertex and color data
    const positionBuffer = glContext.createBuffer();
    // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
    glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
    // Set a rectangle the same size as the image at (0, 0). Necessary to show the image on the canvas.
    this.setRectangle(glContext, 0, 0, image.width, image.height);

    // provide texture coordinates for the rectangle.
    const texcoordBuffer = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, texcoordBuffer);
    glContext.bufferData(
      glContext.ARRAY_BUFFER,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
      glContext.STATIC_DRAW
    );

    function createTexture() {
      if (!glContext) return;

      // Create a texture.
      const texture = glContext.createTexture();
      glContext.bindTexture(glContext.TEXTURE_2D, texture);

      // Set the parameters so we can render any size image.
      glContext.texParameteri(
        glContext.TEXTURE_2D,
        glContext.TEXTURE_WRAP_S,
        glContext.CLAMP_TO_EDGE
      );
      glContext.texParameteri(
        glContext.TEXTURE_2D,
        glContext.TEXTURE_WRAP_T,
        glContext.CLAMP_TO_EDGE
      );
      glContext.texParameteri(
        glContext.TEXTURE_2D,
        glContext.TEXTURE_MIN_FILTER,
        glContext.NEAREST
      );
      glContext.texParameteri(
        glContext.TEXTURE_2D,
        glContext.TEXTURE_MAG_FILTER,
        glContext.NEAREST
      );
    }

    //TODO var originalImageTexture = createAndSetupTexture(gl);

    // Upload the image into the texture.
    glContext.texImage2D(
      glContext.TEXTURE_2D,
      0,
      glContext.RGBA,
      glContext.RGBA,
      glContext.UNSIGNED_BYTE,
      image
    );

    // lookup uniforms
    const resolutionLocation = glContext.getUniformLocation(program, "u_resolution");
    const textureSizeLocation = glContext.getUniformLocation(program, "u_textureSize");
    const kernelLocation = glContext.getUniformLocation(program, "u_kernel[0]");
    const kernelWeightLocation = glContext.getUniformLocation(program, "u_kernelWeight");

    //const blurKernel = this.getBlurFilter("triangleBlur");
    const blurKernel = this.getBlurFilter();
    const kernelWeight = this.computeKernelWeight(blurKernel);

    drawWithKernel();

    function drawWithKernel() {
      if (!glContext) return;

      resizeCanvas(newCanvas);

      // Tell WebGL how to convert from clip space to pixels
      glContext.viewport(0, 0, glContext.canvas.width, glContext.canvas.height);

      // Clear the canvas
      glContext.clearColor(0, 0, 0, 0);
      glContext.clear(glContext.COLOR_BUFFER_BIT);

      // Tell it to use our program (pair of shaders)
      glContext.useProgram(program);

      // Turn on the position attribute
      glContext.enableVertexAttribArray(positionLocation);

      // Bind the position buffer.
      glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);

      // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
      var size = 2; // 2 components per iteration
      var type = glContext.FLOAT; // the data is 32bit floats
      var normalize = false; // don't normalize the data
      var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
      var offset = 0; // start at the beginning of the buffer
      glContext.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

      // Turn on the texcoord attribute
      glContext.enableVertexAttribArray(texcoordLocation);

      // bind the texcoord buffer.
      glContext.bindBuffer(glContext.ARRAY_BUFFER, texcoordBuffer);

      // Tell the texcoord attribute how to get data out of texcoordBuffer (ARRAY_BUFFER)
      var size = 2; // 2 components per iteration
      var type = glContext.FLOAT; // the data is 32bit floats
      var normalize = false; // don't normalize the data
      var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
      var offset = 0; // start at the beginning of the buffer
      glContext.vertexAttribPointer(texcoordLocation, size, type, normalize, stride, offset);

      // set the resolution
      glContext.uniform2f(resolutionLocation, glContext.canvas.width, glContext.canvas.height);

      // set the size of the image
      glContext.uniform2f(textureSizeLocation, image.width, image.height);

      // set the kernel and it's weight
      glContext.uniform1fv(kernelLocation, blurKernel);
      glContext.uniform1f(kernelWeightLocation, kernelWeight);

      // Draw the rectangle.
      var primitiveType = glContext.TRIANGLES;
      var offset = 0;
      var count = 6; // 6 means two triangles
      glContext.drawArrays(primitiveType, offset, count);
    }

    return newCanvas;
  }

  setRectangle(gl: WebGLRenderingContext, x: number, y: number, width: number, height: number) {
    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
      gl.STATIC_DRAW
    );
  }

  //TODO 1. alternativ kann auch der Canvas weggelassen werden und nur der Weichzeichner auf das Bild angewendet werden, wenn WebGl nicht nötig
  //TODO 2. oder man nutzt einfach das CustomLayer unten (das ist vermutlich fast am sinnvollsten?)
  //TODO 3. testen ob zoomen dann überhaupt möglich ist, wenn als canvas / image layer drübergelegt ?? wenn nein bleibt eh nur option 2
  //  -> zu 3. das overlay muss ja sowieso bei jeder bewegung entfernt und neu geladen werden, also sollte das nicht das problem sein
  /**
   * Einen Canvas darüber zu legen ist laut https://github.com/mapbox/mapbox-gl-js/issues/6456 nicht allzu 
   * gut für die Performance, stattdessen Custom Layer verwenden! Probleme:
        - Severe performance hit; browsers have a hard time compositing two GL contexts.
        - You can only draw on top of a Mapbox map — there’s no way to draw something in between
   */

  //TODO andere Idee: ich will ja die Kreise blurren (die ich mit Turf.js zeichne oder halt direkt mit Canvas?)
  //TODO  -> d.h. ich kann einfach die Kreise blurren und die dann als Image/canvassource darüberlegen

  /**
   * Idee (ich glaub die drüber is besser):
   * 1. vor neuem Layer ein Bild machen und das kurz anzeigen (also diesen canvas visible und die echte karte nicht)
   * 2. karten kontext clearen und dann neues Layer adden
   * 3. bild von neuem Layer (mit weißem Hintergrund) und das blurren
   * 4. dieses dann als image layer auf karte
   * -> bringt aber nichts weil bild ja nicht interaktiv
   *
   * -> karte wieder anzeigen mit geblurrtem CustomLayer stattdessen?
   * -> irgendwie müsste halt nur der unterschied zw. baselayer und neuem Layer geblurrt werden oder?
   */
  blurMap() {
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

      const canvas = this.render(img);
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

  // * If the layer needs to render to a texture, it should implement the `prerender` method
  // to do this and only use the `render` method for drawing directly into the main framebuffer.
  addWebGlLayer(): void {
    if (map.getLayer("webglCustom")) {
      // the layer exists already; remove it
      map.removeLayer("webglCustom");
    }

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
      onAdd: (map: mapboxgl.Map, gl: WebGLRenderingContext) => {
        const vertexSource = webglUtils.createVertexShaderSource();
        const fragmentSource = webglUtils.createFragmentShaderSource();

        //console.log("in onAdd: ", gl.canvas);

        // create a vertex and a fragment shader
        const vertexShader = webglUtils.createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = webglUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

        //TODO: die vertex und fragment shader sollten nachdem sie nicht mehr benutzt werden, sofort gelöscht werden, s. WebGL Best Practices

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
      render: function (gl: WebGLRenderingContext, matrix: number[]): void {
        //console.log("in render: ", gl.canvas);

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
