/* eslint-env browser */
import L from "leaflet";
import type {
  LatLngExpression,
  Map as LeafletMap, // rename to prevent clashes with the ES6 built-in Map
  LeafletEvent,
  LeafletMouseEvent,
  LayerEvent,
  Layer,
} from "leaflet";
import Tangram from "tangram";
import { Config } from "../../shared/config";
import type { GeoJsonObject } from "geojson";

/**
 * TODO 0: wie blur effekte mit Tangram?
 * TODO 1: kann ich Blur effekte, bzw. alles, besser mit Leaflet + Tangram umsetzen?
 * TODO 2: Zeit messen, wie schnell Leaflet + Tangram ist (v.a. beim laden und zeigen von geojson von overpass)
 * TODO 3: bringen mir einige der Leaflet Plugins was?
 */
export default class LeafletController {
  // readonly local map instance which is accessible from outside only via getter
  private readonly map: LeafletMap;
  private tangramLayer: any;
  private scene: any;

  // map that stores all active map layers
  private activeLayers: Map<string, Layer> = new Map();

  constructor() {
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
    const osmLayer = L.tileLayer(
      "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/streets-v11",
        tileSize: 512,
        zoomOffset: -1,
        accessToken: Config.MAPBOX_TOKEN,
      }
    );
    //this.addLayer("osmLayer", osmLayer);

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
      //scene: "../nextzen_scene.yaml",
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
      load: (msg: any) => {
        // scene was loaded
        this.getVisibleFeatures();
        this.showMajorRoads();
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
      view_complete: function (msg: any) {
        // new set of map tiles was rendered
      },
      error: function (msg: any) {
        // on error
      },
      warning: function (msg: any) {
        // on warning
      },
    });
  }

  // Util-Method that adds a layer to the Leaflet map as well as the activeLayers map
  addLayer(layerName: string, layer: Layer) {
    this.activeLayers.set(layerName, layer);
    this.map.addLayer(layer);
  }

  updateLayer() {
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
        results.forEach((feature: GeoJsonObject | undefined) =>
          L.geoJSON(feature, {
            style: function () {
              return { color: "red" };
            },
          }).addTo(this.map)
        );
      });
  }

  //TODO funktioniert noch nicht!
  getVisibleFeatures() {
    // signature: queryFeatures({ filter = null, visible = null, unique = true, group_by = null, geometry = false })

    //This example will return all restaurants in the pois layer in the visible tiles:
    this.scene
      .queryFeatures({ filter: { $layer: "pois", kind: "restaurant" } })
      .then((features: any) => console.log(features));

    // remove all duplicates
    this.scene
      .queryFeatures({ unique: true, geometry: true })
      .then((features: any) => console.log(features));

    // group
    this.scene
      .queryFeatures({ filter: { $layer: "pois", kind: "restaurant" }, group_by: "kind" })
      .then((features: any) => console.log(features));

    // get geometry information as well by setting geometry to true!
    this.scene
      .queryFeatures({ filter: { $layer: "pois", kind: "restaurant" }, geometry: true })
      .then((features: any) => console.log(features));

    // get all
    this.scene.queryFeatures().then((features: any) => console.log(features));

    //Add Leaflet markers for visible restaurant POIs
    this.scene
      .queryFeatures({
        filter: { $layer: "pois", kind: "restaurant" },
        visible: true,
        geometry: true,
      })
      .then((results: any[]) => {
        results.forEach((feature: { geometry: { coordinates: number[] } }) => {
          const marker = L.marker([
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
          ]);
          marker.addTo(this.map);
        });
      });
  }

  addBlur() {
    // make a canvas screenshot
    this.scene
      .screenshot({ background: "transparent" })
      .then((screenshot: { url: string | undefined }) => {
        //window.open(screenshot.url);
        console.log(screenshot.url);
      });
  }

  addGeoJsonLayer(data: GeoJsonObject, queryInput: string) {
    const geojsonLayer = L.geoJSON(data, {
      style: function (feature) {
        return { color: feature?.properties.color };
      },
      onEachFeature: function (feature, layer) {
        //A Function that will be called once for each created Feature, after it has been created and styled.
        // Useful for attaching events and popups to features.
        //TODO draw circle and blur here?
      },
    });

    this.addLayer(queryInput, geojsonLayer);
  }

  addCanvasLayer() {
    //TODO wie benutze ich das? iwie createTile function? oder kann ich das canvas layer jetzt als neuen Type nehmen?
    const canvasLayer = L.GridLayer.extend({
      createTile: function (coords: any) {
        // create a <canvas> element for drawing
        var tile = L.DomUtil.create("canvas", "leaflet-tile");

        // setup tile width and height according to the options
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        var ctx = tile.getContext("2d");

        // return the tile so it can be rendered on screen
        return tile;
      },
    });

    //this.addLayer("canvasLayer", canvasLayer);
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
    console.log("new layer added!");
  }

  onAdded(e: LeafletEvent) {
    console.log("new thing added!");
  }

  onOverlayAdded(e: LayerEvent) {
    console.log("new overlay added!");
  }
}
