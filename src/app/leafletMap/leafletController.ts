/* eslint-env browser */
import L, { LatLng } from "leaflet";
import type {
  LatLngExpression,
  Map as LeafletMap, // rename to prevent clashes with the ES6 built-in Map
  LeafletEvent,
  LeafletMouseEvent,
  LayerEvent,
  Layer,
} from "leaflet";
import Tangram from "tangram";
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  GeoJsonProperties,
  Geometry,
  Point,
  Polygon,
} from "geojson";
import Benchmark from "../../shared/benchmarking";
import { blurCanvas, blurImage } from "../mapboxMap/testMapFunctionsTODO";
import "leaflet-maskcanvas";
import * as StackBlur from "stackblur-canvas";
import html2canvas from "html2canvas";
import geojsonCoords from "@mapbox/geojson-coords";
import "../vendors/fast-gauss-blur.js";

/**
 * TODO wie blur effekte mit Tangram?
 *    -> man kann in der scene custom shader einbauen und die auch dynamisch setzen
 *    -> bzw. wäre der Ablauf: blur-shader in custom style oben in scene file deklarieren, dann zur Laufzeit
 *       in der sceneFile durch die updateConfig - Methode unten ein neues Layer einzufügen in den layers-block
 *       (mit den Daten die geblurrt werden sollen) oder alternativ ein bestehendes Layer filtern durch Hinzufügen
 *       eines Filters, dann diesem layer den eigenen custom style zuweisen (damit dieses layer geblurred wird)
 */

//TODO 2: Zeit messen, wie schnell Leaflet + Tangram ist (v.a. beim laden und zeigen von geojson von overpass)
// und beim image canvas overlay

export default class LeafletController {
  // readonly local map instance which is accessible from outside only via getter
  private readonly map: LeafletMap;
  private tangramLayer: any;
  private scene: any;

  // map that stores all active map layers
  private activeLayers: Map<string, Layer> = new Map();

  constructor() {
    Benchmark.startMeasure("load map");

    const initialZoom = 12;
    const coordinatesRegensburg: LatLngExpression = [49.008, 12.1];
    this.map = L.map("map", { zoomControl: false }).setView(coordinatesRegensburg, initialZoom);
    new L.Control.Zoom({ position: "topright" }).addTo(this.map); // move the zoom control to the right

    this.handleEvents();
    this.setupMap();
  }

  get mapInstance() {
    return this.map;
  }

  setupMap() {
    /*
    const mapboxLayer = L.tileLayer(
      "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/streets-v11",
        tileSize: 512,
        zoomOffset: -1,
        accessToken: process.env.MapboxToken,
      }
    );
    //this.addLayer("osmLayer", mapboxLayer);
    */

    const configJson = {
      //TODO not working, probably because i dont have a nextzen account
      // Nextzen (nee Mapzen) basemaps
      import: [
        "https://www.nextzen.org/carto/bubble-wrap-style/10/bubble-wrap-style.zip",
        "https://www.nextzen.org/carto/bubble-wrap-style/10/themes/label-10.zip",
        "https://www.nextzen.org/carto/bubble-wrap-style/10/themes/bubble-wrap-road-shields-usa.zip",
        "https://www.nextzen.org/carto/bubble-wrap-style/10/themes/bubble-wrap-road-shields-international.zip",
      ],
      scene: {
        background: {
          color: "grey",
        },
      },
    };

    this.tangramLayer = Tangram.leafletLayer({
      //scene: "../scene.yaml",
      scene: {
        import: [
          // Bubble Wrap Style
          //"https://www.nextzen.org/carto/bubble-wrap-style/10/bubble-wrap-style.zip",
          //"https://www.nextzen.org/carto/bubble-wrap-style/10/themes/bubble-wrap-road-shields-international.zip",
          //"https://www.nextzen.org/carto/bubble-wrap-style/10/themes/label-10.zip",

          // Cinnabar Style
          "https://www.nextzen.org/carto/cinnabar-style/10/cinnabar-style.zip",
          "https://www.nextzen.org/carto/cinnabar-style/10/themes/label-10.zip",
          //"https://www.nextzen.org/carto/cinnabar-style/10/themes/cinnabar-road-shields-international.zip",
        ],
        sources: {
          mapzen: {
            type: "MVT",
            url: "https://{s}.tile.nextzen.org/tilezen/vector/v1/512/all/{z}/{x}/{y}.mvt",
            url_subdomains: ["a", "b", "c", "d"],
            url_params: { api_key: "NaqqS33fTUmyQcvbuIUCKA" },
            tile_size: 512,
            max_zoom: 16,
          },
        },
        /*
        layers: {
          pois: {
            data: { source: "mapzen" },
            filter: { kind: ["restaurant", "mall", "bus_stop"] },
            draw: {
              polygons: {
                order: 1,
                color: "yellow",
              },
            },
          },
        },
        */
      },
      events: {
        //hover: onHover, // hover event (defined below)
        //click: onClick, // click event (defined below)
      },
      // debug: {
      //     layer_stats: true // enable to collect detailed layer stats, access w/`scene.debug.layerStats()`
      // },
      logLevel: "debug",
      /*
      webGLContextOptions: {
        preserveDrawingBuffer: true,
        antialias: false
      },*/

      attribution:
        '<a href="https://github.com/tangrams" target="_blank">Tangram</a> | <a href="http://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a> | <a href="https://www.nextzen.org/" target="_blank">Nextzen</a>',
    });
    this.scene = this.tangramLayer.scene;

    //this.tangramLayer.scene.load(configJson);
    this.addLayer("tangramLayer", this.tangramLayer);

    // Useful events to subscribe to
    this.tangramLayer.scene.subscribe({
      load: (config: any) => {
        // scene was loaded
        console.log("scene loaded:", config);
        Benchmark.stopMeasure("load map");
      },
      update: function (msg: any) {
        // scene updated
      },
      pre_update: function (will_render: any) {
        // before scene update
      },
      post_update: function (will_render: any) {
        // after scene update
      },
      view_complete: (config: any) => {
        // new set of map tiles was rendered
        //this.showMajorRoads();    // TODO damit laggts gewaltig lol
        console.log("scene loaded_view_complete:", this.scene.config);
        var results = [];

        var toSearch = "mall";

        for (var i = 0; i < this.scene.config.length; i++) {
          for (var key in this.scene.config[i]) {
            if (this.scene.config[i][key].indexOf(toSearch) != -1) {
              results.push(this.scene.config[i]);
            }
          }
        }
        console.log(results);
      },
      error: function (msg: any) {
        // on error
      },
      warning: function (msg: any) {
        // on warning
      },
    });

    //TODO show blur layer after every move ?
    /*
    this.map.on("moveend", (e) => {
      this.getFeaturesFromMap();
    });*/
  }

  getFeaturesFromMap() {
    Benchmark.startMeasure("Tangram - getVisibleFeatures");
    this.getVisibleFeatures();
    Benchmark.stopMeasure("Tangram - getVisibleFeatures");
  }

  // Util-Method that adds a layer to the Leaflet map as well as the activeLayers map
  addLayer(layerName: string, layer: Layer) {
    this.activeLayers.set(layerName, layer);
    this.map.addLayer(layer);
  }

  updateScene() {
    //TODO update objects simply by assigning new values
    //this.scene.config.styles. ... = ...;

    // force the scene to redraw so the changes become visible
    this.scene.updateConfig();
  }

  showMajorRoads() {
    //Add Leaflet polylines (SVG) for major roads
    this.scene
      .queryFeatures({
        filter: { $layer: "roads", kind: "major_road" },
        unique: false,
        visible: true,
        geometry: true,
      })
      .then((results: any[]) => {
        results.forEach((feature: GeoJsonObject | undefined) => {
          L.geoJSON(feature, {
            style: function () {
              return { color: "red" };
            },
          }).addTo(this.map);
        });
      });
  }

  getVisibleFeatures() {
    // signature: queryFeatures({ filter = null, visible = null, unique = true, group_by = null, geometry = false })

    // get all
    this.scene
      .queryFeatures({ unique: true, geometry: true })
      .then((features: any) => console.log(features));

    /*
    //This example will return all restaurants in the pois layer in the visible tiles:
    this.scene
      .queryFeatures({ filter: { $layer: "pois", kind: "restaurant" } })
      .then((features: any) => console.log(features));

    // group
    this.scene
      .queryFeatures({ filter: { $layer: "pois" }, group_by: "kind" })
      .then((features: any) => console.log(features));
    */

    //TODO restaurants etc. sind offenbar nicht vorhanden oder erst auf niedrigeren Zoom-Leveln??
    const layer = "pois";
    const kind = "mall";

    Benchmark.startMeasure("Tangram - addOverlay");
    Benchmark.startMeasure("Tangram - addOverlay_2");
    this.scene
      .queryFeatures({
        filter: { $layer: layer, kind: kind },
        geometry: true,
        unique: true,
        //this would prevent it from working for some reason: visible: true,
      })
      .then((features: any) => {
        console.log(features);
        const allPoints: L.Point[] = [];
        const allLatLngs: any = [];

        features.forEach((feature: { geometry: { coordinates: number[] } }) => {
          allLatLngs.push(feature.geometry.coordinates);

          const latLng = [
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
          ] as LatLngExpression;

          //* circle Marker scales on zoom, circle does not!
          //L.circleMarker(latLng, { radius: 10 }).addTo(this.map);
          //L.circle(latLng, { radius: 700 }).addTo(this.map);

          const point = this.map.latLngToLayerPoint(latLng);
          allPoints.push(point);
        });
        //console.log("allPoints: ", allPoints);

        //this.addGridLayer(allPoints);
        this.addImageLayer(allPoints);
        //this.addMaskLayer(allLatLngs);
        Benchmark.stopMeasure("Tangram - addOverlay_2");
      });
  }

  takeScreenshot() {
    // make a canvas screenshot
    this.scene
      .screenshot({ background: "transparent" })
      .then((screenshot: { url: string | undefined }) => {
        if (!screenshot.url) return;

        //window.open(screenshot.url);
        console.log(screenshot.url);

        /*
        const newCanvas = document.createElement("canvas"); // in-memory canvas
        const size = this.map.getSize();
        newCanvas.width = size.x;
        newCanvas.height = size.y;

        const bounds = this.map.getBounds();
        const image = new Image();

        image.src = screenshot.url;

        StackBlur.image(image, newCanvas, 8);

        image.onload = () => {
          console.log("blurred canvas: ", image.src);
          L.imageOverlay(image.src, bounds).addTo(this.map);
        };
        */
      });
  }

  /**
   * Adds a new source or updates an already existing one
   */
  addNewSource(geojson_data: GeoJsonObject) {
    this.scene.setDataSource("osm", {
      type: "TopoJSON",
      url: "https://tile.nextzen.org/tilezen/vector/v1/256/all/{z}/{x}/{y}.topojson",
    });

    //this.scene.setDataSource("dynamic_data", { type: "GeoJSON", data: geojson_data });
  }

  addGeoJsonLayer(data: GeoJsonObject, queryInput: string) {
    Benchmark.startMeasure("Tangram - addGeojsonLayer");
    console.log(data);

    const geojsonLayer = L.geoJSON(data, {
      style: function (feature) {
        return { color: feature?.properties.color };
      },
      onEachFeature: function (feature, layer) {
        //A Function that will be called once for each created Feature, after it has been created and styled.
        // Useful for attaching events and popups to features.
        console.log(feature);
        //console.log(feature.properties);
        //console.log(feature.geometry);
      },
    });

    this.addLayer(queryInput, geojsonLayer);
    Benchmark.stopMeasure("Tangram - addGeojsonLayer");
  }

  addGeoJsonAndBlurLayer(data: FeatureCollection, queryInput: string) {
    Benchmark.startMeasure("Tangram - addGeojsonAndBlurLayer");
    const allGeoData: number[][] = geojsonCoords(data);
    /*
    data.features.forEach((el: Feature<Geometry, GeoJsonProperties>) => {
      const geom = el.geometry;
      if (!geom.coordinates) return;
      for (let coords of geom.coordinates) {
        console.log(coords);
      }
    });
    */

    const allPoints: L.Point[] = [];
    for (const el of allGeoData) {
      const latLng = [el[1], el[0]] as LatLngExpression;

      const point = this.map.latLngToLayerPoint(latLng);
      allPoints.push(point);
    }

    this.addImageLayer(allPoints);
  }

  addImageLayer(allPoints: L.Point[]) {
    this.removeData("imageLayer");

    const canvas = document.createElement("canvas"); // in-memory canvas
    const context = canvas.getContext("2d");

    if (!context) {
      console.log("No context available!");
      return;
    }

    const size = this.map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    //context.globalCompositeOperation = "source-over";
    //context.globalCompositeOperation = "xor"; //TODO funtioniert so nicht

    // clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    /*
    context.fillStyle = "black";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "white";
    context.strokeStyle = "white";
    */
    context.fillStyle = "rgba(60, 60, 60, 0.4)";
    context.strokeStyle = "rgba(150, 150, 150, 0.9)";
    //context.fillStyle = "white";
    //context.strokeStyle = "white";

    blurCanvas(canvas, 9);

    Benchmark.startMeasure(`Rendering ${allPoints.length} Circles took `);
    for (let point of allPoints) {
      //draw a circle
      this.renderCircle(context, point, 30);
    }
    Benchmark.stopMeasure(`Rendering ${allPoints.length} Circles took `);

    //sthis._blurCanvas(canvas, 3);

    const bounds = this.map.getBounds();
    const image = new Image();

    image.src = canvas.toDataURL();

    image.onload = () => {
      //console.log(image.src);
      const imageOverlay = L.imageOverlay(image.src, bounds);
      this.addLayer("imageLayer", imageOverlay);
      //this.blurMap();

      Benchmark.stopMeasure("Tangram - addGeojsonAndBlurLayer");
    };
  }

  _blurCanvas = function (viewportCanvas, size) {
    var ctx = viewportCanvas.getContext("2d");
    var imgData = ctx.getImageData(0, 0, viewportCanvas.width, viewportCanvas.height);

    var redChannel = [];

    for (var i = 0; i < imgData.data.length; i += 4) {
      redChannel.push(imgData.data[i]);
    }

    var blurredRedChannel = [];

    console.time("fastgaussblur");
    window.FastGaussBlur.apply(
      redChannel,
      blurredRedChannel,
      viewportCanvas.width,
      viewportCanvas.height,
      size
    );
    console.timeEnd("fastgaussblur");

    for (var i = 0; i < imgData.data.length; i += 4) {
      var colorValue = blurredRedChannel[i / 4];
      imgData.data[i] = colorValue;
      imgData.data[i + 1] = colorValue;
      imgData.data[i + 2] = colorValue;
    }

    ctx.putImageData(imgData, 0, 0);
  };

  //! dieses layer bringt nichts, da hier nur für jedes Tile separat und nicht das gesamte bild
  addGridLayer(allPoints: L.Point[]) {
    const canvasLayer = L.GridLayer.extend({
      createTile: function (coords: any, error: any) {
        // create a <canvas> element for drawing
        var tile = L.DomUtil.create("canvas", "leaflet-tile") as HTMLCanvasElement;

        // setup tile width and height according to the options
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        var context = tile.getContext("2d");

        if (!context) return;

        // clear canvas
        context.clearRect(0, 0, tile.width, tile.height);

        /*
        var error; 
        //* asynchron für bessere Performance?
        // draw something asynchronously and pass the tile to the done() callback
        setTimeout(function() {
            done(error, tile);
        }, 1000);
        */

        blurCanvas(tile as HTMLCanvasElement, 9);

        const radius = 30;
        for (let point of allPoints) {
          //draw a circle
          context.fillStyle = "rgba(60, 60, 60, 0.4)";
          context.strokeStyle = "rgba(150, 150, 150, 0.9)";
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
          //context.closePath();
          context.fill();
          context.stroke();
        }

        console.log(tile);

        // return the tile so it can be rendered on screen
        return tile;
      },
    });

    const layer = new canvasLayer() as L.GridLayer;
    this.addLayer("gridLayer", layer);
  }

  blurMap() {
    const mapID = document.getElementById("map");
    if (!mapID) return;

    html2canvas(mapID, {
      useCORS: true,
      logging: true,
    }).then((canvas) => {
      console.log("snapshot taken with html2canvas");
      var ocanvas = document.createElement("canvas");

      const size = this.map.getSize();
      const w = size.x;
      const h = size.y;

      ocanvas.width = w;
      ocanvas.height = h;
      ocanvas.style.left = 0 + "px";
      ocanvas.style.top = 0 + "px";
      ocanvas.id = "blurred";

      var ctx = ocanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(canvas, 0, 0, w, h, 0, 0, w, h);

      const radius = 6;
      StackBlur.canvasRGB(ocanvas, 0, 0, w, h, radius);

      console.log("at the end");
      const bounds = this.map.getBounds();
      const image = new Image();

      image.src = ocanvas.toDataURL();

      image.onload = () => {
        console.log("blurred canvas: ", image.src);
        L.imageOverlay(image.src, bounds).addTo(this.map);
      };
    });
  }

  addMaskLayer(allPoints: any) {
    //delete old layer first
    this.removeData("maskLayer");

    // typescript isn't able to detect this without a correct typings file so just cast it to any as a dirty solution
    const maskLayer = new (L.GridLayer as any).MaskCanvas({
      opacity: 0.5,
      radius: 500,
      useAbsoluteRadius: true, // in meter, if false in pixel
      color: "#000", // the color of the layer
      noMask: false, // true results in normal (filled) circled, instead masked circles
      lineColor: "#A00", // color of the circle outline if noMask is true
    });

    //* auch individuelle Radien können gesetzt werden!
    const data = allPoints.map((el: number[]) => [el[1], el[0]]);
    maskLayer.setData(data);
    console.log(maskLayer);

    //TODO wie blurren?
    /*
    const newLayer = maskLayer.extend({
      createTile: function (coords: any, error: any) {
        // create a <canvas> element for drawing
        var tile = L.DomUtil.create("canvas", "leaflet-tile");

        // setup tile width and height according to the options
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        var context = tile.getContext("2d");

        blurCanvas(tile as HTMLCanvasElement, 9);

        console.log(tile);

        // return the tile so it can be rendered on screen
        return tile;
      },
    });
    const newMaskLayer = new newLayer();
    */

    this.addLayer("maskLayer", maskLayer);
    //this.map.fitBounds(maskLayer.bounds);

    Benchmark.stopMeasure("Tangram - addOverlay");
  }

  //! eigentlich mit webgl machen, auch den blur oben
  renderCircle(context: CanvasRenderingContext2D, point: L.Point, radius: number = 20) {
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    //context.closePath();
    //context.fill();
    context.fill("evenodd");
    context.stroke();
  }

  removeData(layerName: string) {
    //TODO als layer wird im moment amenity=restaurant übergeben -> funktioniert also nur bei geojson layern!
    if (!this.activeLayers.has(layerName)) {
      console.warn(`Tried to remove layer ${layerName} which doesn't exist! This may be a bug!`);
      return;
    }

    const layer = this.activeLayers.get(layerName);
    if (layer) this.map.removeLayer(layer);
  }

  getViewportBounds() {
    const currBounds = this.map.getBounds();
    const southLat = currBounds.getSouth();
    const westLng = currBounds.getWest();
    const northLat = currBounds.getNorth();
    const eastLng = currBounds.getEast();
    //console.log(currBounds.toBBoxString());
    return `${southLat},${westLng},${northLat},${eastLng}`;
  }

  handleEvents() {
    this.map.on("click", this.onMapClick.bind(this));
    this.map.on("layeradd", this.onLayerAdded.bind(this));
    this.map.on("add", this.onAdded.bind(this));
    this.map.on("overlayadd", this.onOverlayAdded.bind(this));
  }

  onMapClick(e: LeafletMouseEvent) {
    const popup = L.popup();

    const point = this.map.latLngToLayerPoint(e.latlng);
    //console.log("Clicked point on canvas:", point);

    const coordinatesRegensburg: LatLngExpression = [49.008, 12.1];
    const dist = this.map.distance(coordinatesRegensburg, e.latlng);
    console.log(`Distance to center from clicked point: ${dist}`);

    popup
      .setLatLng(e.latlng)
      .setContent("You clicked the map at " + e.latlng.toString())
      .openOn(this.map);
  }

  onLayerAdded(e: LayerEvent) {
    //console.log("new layer added: ", e.layer);
    /*
    //* hier nicht!
    this.scene
      .screenshot({ background: "transparent" })
      .then((screenshot: { url: string | undefined }) => {
        console.log("after screenshot");
        if (!screenshot.url) return;

        console.log("Screenshot: ", screenshot.url);

        const bounds = this.map.getBounds();
        const image = new Image();

        image.src = screenshot.url;

        blurImage(image, 40);

        image.onload = () => {
          console.log("Image.Src", image.src);
          L.imageOverlay(image.src, bounds).addTo(this.map);
        };
      });
      */
  }

  onAdded(e: LeafletEvent) {
    console.log("new thing added!");
  }

  onOverlayAdded(e: LayerEvent) {
    console.log("new overlay added!");
  }
}
