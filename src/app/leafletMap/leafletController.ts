/* eslint-env browser */
import L, { LatLngExpression, Map, LeafletEvent, LeafletMouseEvent } from "leaflet";
import Tangram from "tangram";
import { Config } from "../../shared/config";

/**
 * TODO 0: wie blur effekte mit Tangram?
 * TODO 1: kann ich Blur effekte, bzw. alles, besser mit Leaflet + Tangram umsetzen?
 * TODO 2: Zeit messen, wie schnell Leaflet + Tangram ist (v.a. beim laden und zeigen von geojson von overpass)
 * TODO 3: bringen mir einige der Leaflet Plugins was?
 */
export default class LeafletController {
  private map: Map;

  constructor() {
    const initialZoom = 12;
    const coordinatesRegensburg: LatLngExpression = [49.008, 12.1];
    this.map = L.map("map").setView(coordinatesRegensburg, initialZoom);

    this.setupMap();
  }

  setupMap() {
    /*
    L.tileLayer(
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
    ).addTo(this.map);
    */

    const tangramLayer = Tangram.leafletLayer({
      scene: "../scene.yaml",
      /*
      webGLContextOptions: {
        preserveDrawingBuffer: true,
        antialias: false
      },*/
      attribution:
        '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors',
    });
    tangramLayer.addTo(this.map);

    this.handleEvents();
  }

  handleEvents() {
    this.map.on("click", this.onMapClick.bind(this));
  }

  onMapClick(e: LeafletMouseEvent) {
    const popup = L.popup();

    popup
      .setLatLng(e.latlng)
      .setContent("You clicked the map at " + e.latlng.toString())
      .openOn(this.map);
  }
}
